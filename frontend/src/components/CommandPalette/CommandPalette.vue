<template>
	<CommandPalette
		v-model:open="show"
		v-model:query="query"
		:filterable="false"
		:title="__('Command palette')"
		@select="onSelect"
	>
		<div ref="paletteRef" @keydown="onKeydown">
			<CommandPaletteInput :placeholder="__('Search')" />

			<CommandPaletteList class="max-h-96 mb-2">
				<CommandPaletteGroup
					v-for="group in groups"
					:key="group.title"
					:label="group.title"
				>
					<CommandPaletteItem
						v-for="(item, index) in group.items"
						:key="index"
						:value="item"
						:disabled="item.isStale"
					>
						<div class="flex items-center gap-x-3">
							<span
								v-if="item.icon"
								:class="[item.icon, 'size-4 text-ink-gray-6']"
							/>
							<div v-safe-html:rich="item.title"></div>
						</div>
						<template v-if="item.modified" #suffix>
							<div class="text-ink-gray-5">
								{{ dayjs.unix(item.modified).fromNow(true) }}
							</div>
						</template>
					</CommandPaletteItem>
				</CommandPaletteGroup>
			</CommandPaletteList>

			<p
				v-if="showsErrorState"
				class="px-4.5 py-2 text-ink-gray-5"
				role="status"
			>
				{{ __('Could not search just now. Try again.') }}
			</p>
			<p
				v-if="showsEmptyState"
				class="px-4.5 py-2 text-ink-gray-5"
				role="status"
			>
				{{ __('No results found') }}
			</p>

			<CommandPaletteFooter>
				<div class="flex items-center gap-x-2">
					<span :class="chipClass">
						<span class="lucide-move-up size-3.5 text-ink-gray-7" />
					</span>
					<span :class="chipClass">
						<span class="lucide-move-down size-3.5 text-ink-gray-7" />
					</span>
					<span>
						{{ __('to navigate') }}
					</span>
				</div>
				<div class="flex items-center gap-x-2">
					<span :class="chipClass">
						<span class="lucide-corner-down-left size-3.5 text-ink-gray-7" />
					</span>
					<span>
						{{ __('to select') }}
					</span>
				</div>
				<div class="flex items-center gap-x-2">
					<span :class="[wideChipClass, 'text-xs text-ink-gray-7']">
						{{ __('esc') }}
					</span>
					<span>
						{{ __('to close') }}
					</span>
				</div>
			</CommandPaletteFooter>
		</div>
	</CommandPalette>
</template>
<script setup lang="ts">
import { createResource, debounce } from 'frappe-ui'
import {
	CommandPalette,
	CommandPaletteFooter,
	CommandPaletteGroup,
	CommandPaletteInput,
	CommandPaletteItem,
	CommandPaletteList,
	type CommandPaletteSelectEvent,
} from 'frappe-ui/experimental'
import {
	computed,
	inject,
	nextTick,
	onUnmounted,
	ref,
	useTemplateRef,
	watch,
} from 'vue'
import type dayjsType from 'dayjs'
import { useRouter } from 'vue-router'
import { usersStore } from '@/stores/user'
import { useSettings } from '@/stores/settings'
// @ts-expect-error utils/index.js has no type declarations yet
import { getSidebarLinks } from '@/utils'
import type { PaletteGroup, PaletteItem, PaletteRoute } from './paletteTypes'
import { MODAL_FORM_ROUTES, routeForSearchHit } from './paletteTypes'
import {
	categoryById,
	visibleCategories,
	visibleNavTargets,
} from './categories'
import { openFormRoute } from '@/composables/useFormRoute'
import { pushSettingsHash } from '@/composables/useSettingsHash'

const dayjs = inject<typeof dayjsType>('$dayjs')!

const chipClass =
	'inline-flex size-5 shrink-0 items-center justify-center rounded-1 bg-surface-gray-2'

// `size-5` fixes a square, which crops a multi-letter key. Width grows instead.
const wideChipClass =
	'inline-flex h-5 min-w-5 w-auto shrink-0 items-center justify-center rounded-1 bg-surface-gray-2 px-1.5'

// Below this the palette keeps showing the jump-to list. The results pane used
// to take over at one character while the search only ran from three, so the
// dialog went blank for exactly the two keystrokes that start every search.
const MIN_QUERY_LENGTH = 2

const show = defineModel<boolean>({ required: true, default: false })
const router = useRouter()
const { userResource } = usersStore()
const settingsStore = useSettings()

// The category the search is narrowed to, or null at the root.
const scope = ref<string | null>(null)
const query = ref<string>('')
const searchResults = ref<PaletteGroup[]>([])
const paletteRef = useTemplateRef<HTMLElement>('paletteRef')

// One token per request. Comparing against the current query instead would miss
// two requests for *different* queries overlapping and landing out of order:
// frappe-ui never aborts the one already in flight. Everything that invalidates
// the search in progress — a scope change, a close, unmounting — bumps this, so
// a response already on its way lands in a scope that no longer wants it and is
// dropped.
let searchToken = 0

// The token the waiting debounced tick was holding. frappe-ui's `debounce`
// (>= 1.0.0-beta.65) returns a function with `.cancel()`, so invalidateSearch
// below cancels the pending tick outright now — it should never fire with a
// stale token. This check stays as a defense-in-depth backstop rather than
// something the normal path relies on.
let armedToken = 0
const invalidateSearch = () => {
	searchToken += 1
	debouncedSearch.cancel()
}

const searchFailed = ref(false)

// The query `searchResults` answers, which is not always the one on screen.
const resultsQuery = ref<string | null>(null)

// Whether a search for the current typing run has come back at all. Tying the
// empty message to `search.loading` instead made it blink off and on with every
// keystroke — the results area collapsed to nothing and the dialog resized on
// each letter, which read as the palette tearing itself apart.
const hasSettled = ref(false)

const search = createResource({ url: 'lms.command_palette.search_sqlite' })

// `getSidebarLinks()` is the list before the site's own on/off flags are applied
// — AppSidebar filters it a second time against these — so a site with Jobs
// switched off was still offered a Jobs row here.
const sidebarVisibility = computed(() => settingsStore.sidebarSettings.data)

const runSearch = async (token: number) => {
	// What this request is for. The response is matched back against it so the
	// rows can say whether they still answer what is in the box.
	const asked = query.value
	const params = scope.value
		? { query: query.value, category: scope.value }
		: { query: query.value }
	try {
		const data = await search.submit(params)
		if (token !== searchToken) return
		searchResults.value = toGroups(data)
		resultsQuery.value = asked
		searchFailed.value = false
		hasSettled.value = true
	} catch (error) {
		if (token !== searchToken) return
		searchResults.value = []
		resultsQuery.value = asked
		searchFailed.value = true
		hasSettled.value = true
	}
}

const isSearching = computed(() => query.value.length >= MIN_QUERY_LENGTH)

/**
 * The rows on screen answer a query the user has already replaced. Going from
 * one valid query to another leaves `isSearching` true, so the query watcher
 * never clears them — deliberately, because clearing per keystroke is the blink
 * that "stop the empty state blinking" fixed. They stay visible and stop being
 * selectable instead, so Enter cannot open a row the query no longer matches.
 */
const resultsAreStale = computed(
	() =>
		isSearching.value &&
		resultsQuery.value !== null &&
		resultsQuery.value !== query.value
)

/** The same test Programs.vue gates its own card click on. */
const routeContext = computed(() => ({
	canEditPrograms:
		!window.read_only_mode &&
		Boolean(
			userResource.data?.is_moderator || userResource.data?.is_instructor
		),
}))

/**
 * Every row the palette offers by name, in the form it takes while searching: a
 * category resolves to its own list page here rather than drilling in, because
 * typing "cour" means "take me to Courses". Account rows belong here too —
 * Settings lived only in the pre-search list, so typing its name emptied the
 * palette and reported that nothing matched.
 */
const searchableSections = computed<PaletteItem[]>(() => {
	const links = getSidebarLinks()
	return [
		...visibleCategories(links, sidebarVisibility.value).map((entry) => ({
			title: __(entry.label),
			icon: entry.icon,
			route: { name: entry.listRoute },
		})),
		...visibleNavTargets(links, sidebarVisibility.value).map((entry) => ({
			title: __(entry.label),
			icon: entry.icon,
			route: { name: entry.route },
		})),
		...accountItems.value,
	]
})

/** Sections whose name the query is starting to spell. */
const matchingSections = computed<PaletteItem[]>(() => {
	const term = query.value.trim().toLowerCase()
	if (!term || scope.value) return []
	return searchableSections.value.filter((section) =>
		String(section.title).toLowerCase().startsWith(term)
	)
})

const groups = computed<PaletteGroup[]>(() => {
	const searched = isSearching.value
	const sections = matchingSections.value
	const stale = resultsAreStale.value
	const hits = searchResults.value.map((group) => ({
		...group,
		isStale: stale,
	}))
	const source = searched
		? sections.length
			? [{ title: __('Jump to'), items: sections }, ...hits]
			: hits
		: browseGroups.value
	return source.map((group) => ({
		title: group.title,
		items: group.items.map((item) =>
			group.isStale ? { ...item, isStale: true } : item
		),
	}))
})

/**
 * Everything drawn, stale rows included. "No results found" answers what is on
 * screen rather than what can be selected — keying it to the selectable rows
 * would blank it for every in-flight keystroke once a stale set was excluded,
 * which is the blink "stop the empty state blinking" fixed.
 */
const renderedCount = computed(() =>
	groups.value.reduce((total, group) => total + group.items.length, 0)
)

const showsEmptyState = computed(
	() =>
		isSearching.value &&
		!renderedCount.value &&
		hasSettled.value &&
		!searchFailed.value
)

/** A failed request is not an empty result set, and saying so hides an outage.
 * Not gated on an empty list either: a query that spells a section name fills
 * one row from `matchingSections`, which is enough to have hidden the failure. */
const showsErrorState = computed(
	() => isSearching.value && searchFailed.value && hasSettled.value
)

const debouncedSearch = debounce(() => {
	if (armedToken !== searchToken) return
	if (isSearching.value) runSearch(armedToken)
}, 300)

// A trailing tick used to fire its request after the dialog was gone. The token
// dropped the response, but the round trip still went out.
onUnmounted(invalidateSearch)

/** Search hits whose doctype has no route are dropped, not pointed at a wrong page. */
const toGroups = (data: unknown): PaletteGroup[] => {
	if (!Array.isArray(data)) return []
	return data
		.map((group: any) => ({
			title: group.title,
			items: (group.items ?? [])
				.map((item: any) => {
					const route = routeForSearchHit(
						item.doctype,
						item.name,
						routeContext.value
					)
					return route ? { ...item, route } : null
				})
				.filter(Boolean) as PaletteItem[],
		}))
		.filter((group) => group.items.length > 0)
}

// This also fires for the query resets `resetSearch`/`navigateTo` make
// themselves (closing, unmounting, leaving a category), which must not
// re-arm a search — only a query that is still long enough schedules one.
watch(query, () => {
	if (!isSearching.value) {
		invalidateSearch()
		searchResults.value = []
		hasSettled.value = false
		searchFailed.value = false
		return
	}
	armedToken = ++searchToken
	debouncedSearch()
})

watch(show, () => {
	if (show.value) {
		// The palette reads these flags itself rather than trusting AppSidebar to
		// have fetched them; the store hands back the one in-flight request.
		settingsStore.loadSidebarSettings()
		return
	}
	// Without this the palette reopened still narrowed to whatever category was
	// last opened, with no visible sign that it was filtering.
	scope.value = null
	resetSearch()
})

const onKeydown = (e: KeyboardEvent) => {
	if (e.key === 'Escape') {
		if (scope.value) {
			// The dialog closes on Escape at the document level unless this is
			// stopped, which made backing out one level impossible.
			e.preventDefault()
			e.stopPropagation()
			leaveScope()
		}
	} else if (e.key === 'Backspace' && !query.value && scope.value) {
		// Only on an empty query, so Backspace stays an ordinary edit while there
		// is still something to delete.
		e.preventDefault()
		leaveScope()
	}
}

const onSelect = (value: PaletteItem, event: CommandPaletteSelectEvent) => {
	if (value.isStale) {
		event.preventDefault()
		return
	}
	if (value.category) {
		// Narrowing to a category keeps the palette open.
		event.preventDefault()
		enterScope(value.category)
		return
	}
	if (value.perform) {
		value.perform()
	} else if (value.route) {
		navigateTo(value.route)
	}
}

const enterScope = (category: string) => {
	scope.value = category
	resetSearch()
	focusInput()
}

const leaveScope = () => {
	scope.value = null
	resetSearch()
	focusInput()
}

/** Both directions across a scope boundary clear the same state. The token bump
 * is what stops the old scope's reply, which frappe-ui is still fetching, from
 * repopulating the new one. */
const resetSearch = () => {
	invalidateSearch()
	query.value = ''
	searchResults.value = []
	resultsQuery.value = null
	searchFailed.value = false
	hasSettled.value = false
}

/** Selecting a row destroys that button, so without this the caret would be left
 * on nothing. */
const focusInput = () => {
	nextTick(() => paletteRef.value?.querySelector('input')?.focus())
}

const navigateTo = (route: PaletteRoute) => {
	show.value = false
	query.value = ''
	searchResults.value = []
	const to = { name: route.name, params: route.params, query: route.query }
	// push, not replace: reaching a course through the palette should still
	// leave the page you came from on the back stack. A form route needs the
	// marker openFormRoute stamps, or closing the modal ejects the user instead
	// of returning them to the list underneath it.
	if (MODAL_FORM_ROUTES.has(route.name)) openFormRoute(router, to)
	else router.push(to)
}

const scopedCategory = computed(() => categoryById(scope.value))

/** What the palette shows before a search: the categories, or, once inside one,
 * the way out to that category's own page. */
const browseGroups = computed<PaletteGroup[]>(() => {
	const category = scopedCategory.value
	if (category) {
		return [
			{
				title: __(category.label),
				items: [
					{
						title: __('View all {0}').format(__(category.label)),
						icon: category.icon,
						route: { name: category.listRoute },
					},
				],
			},
		]
	}

	const links = getSidebarLinks()
	const groups: PaletteGroup[] = [
		{
			title: __('Jump to'),
			items: [
				...visibleCategories(links, sidebarVisibility.value).map((entry) => ({
					title: __(entry.label),
					icon: entry.icon,
					category: entry.id,
				})),
				// No records to narrow to, so these navigate rather than drill in.
				...visibleNavTargets(links, sidebarVisibility.value).map((entry) => ({
					title: __(entry.label),
					icon: entry.icon,
					route: { name: entry.route },
				})),
			],
		},
	]

	const account = accountItems.value
	if (account.length) groups.push({ title: __('Account'), items: account })
	return groups
})

/** Settings is a dialog owned by the desktop sidebar and open to moderators
 * only; on a phone nothing listens to the flag, so the row would do nothing. */
const accountItems = computed<PaletteItem[]>(() => {
	if (!userResource.data?.is_moderator || !settingsStore.isSettingsMounted) {
		return []
	}
	return [
		{
			title: __('Settings'),
			icon: 'lucide-settings',
			perform: () => {
				pushSettingsHash(router)
			},
		},
	]
})
</script>
<style>
mark {
	background-color: theme('colors.amber.100');
	font-weight: 500;
}
</style>
