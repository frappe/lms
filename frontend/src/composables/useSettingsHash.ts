import { computed, onScopeDispose, watch, type ComputedRef } from 'vue'
import {
	useRoute,
	useRouter,
	type RouteLocationNormalizedLoaded,
	type Router,
} from 'vue-router'
// @ts-expect-error stores/settings is still plain JS, so it has no declarations
import { useSettings } from '@/stores/settings'
import type {
	SettingsRoutableGroup,
	SettingsRoutableItem,
} from '@/types/settingsSchema'
import { queryEqual } from '@/composables/queryEqual'
import { withFormBackground } from '@/composables/useFormRoute'

const PREFIX = '#settings'
const DEFAULT_SLUG = 'general'

// The hash must always carry a slug. A bare '#settings' collides with batch/course
// detail pages, whose own tabs are addressed as '#<tab label>' (one of them Settings).
const isSettingsHash = (hash: string) => hash.startsWith(`${PREFIX}/`)

// '#settings/<slug>' or '#settings/<slug>/<record>'. The record is a docname, or
// the reserved id 'new' for a create form.
const partsOf = (hash: string) =>
	isSettingsHash(hash) ? hash.slice(PREFIX.length + 1).split('/') : []

const slugFromHash = (hash: string) => partsOf(hash)[0] ?? ''

const recordFromHash = (hash: string) => partsOf(hash)[1] || null

const hashFor = (slug?: string | null, record?: string | null) => {
	const base = `${PREFIX}/${slug || DEFAULT_SLUG}`
	return record ? `${base}/${record}` : base
}

// Depth of settings entries we pushed, so close() pops exactly those. replace() merges
// history.state, so a stale depth can ride onto a non-settings entry, trust it only there.
const depthOf = (router: Router) => {
	if (!isSettingsHash(router.currentRoute.value.hash)) return 0
	return Number(
		(router.options.history.state as Record<string, unknown> | null)
			?.settingsDepth ?? 0
	)
}

// Navigate into a settings tab, the one way in, used for both tab clicks and
// openSettings(). Carries route.query, or a bare location object resets it.
export function pushSettingsHash(
	router: Router,
	slug?: string | null,
	record?: string | null
) {
	const route = router.currentRoute.value
	const hash = hashFor(slug, record)
	if (route.hash === hash) return
	// No slug means "just open settings". If already open, pushing would only
	// add an entry rendering the identical panel.
	if (!slug && isSettingsHash(route.hash)) return
	// Settings never changes the path under it, so the entry it pushes must keep
	// painting whatever the entry it leaves was painting. Skipping this put a
	// modal behind a modal: settings opened on top of a form route lost the
	// stamp, so the next form route opened from settings recorded the settings
	// entry as its own background, a Dialog, which paints an empty page.
	router.push({
		query: route.query,
		hash,
		state: withFormBackground(router, {
			settingsDepth: depthOf(router) + 1,
		}),
	})
}

// Open settings from anywhere in the app. `slug` names a tab; omit it to land
// on whatever tab is showing, or the default one.
export function useOpenSettings() {
	const router = useRouter()
	return (slug: string | null = null, close: (() => void) | null = null) => {
		if (close) close()
		pushSettingsHash(router, slug)
	}
}

// Keeps the settings dialog in sync with the URL hash. The URL is the source of
// truth; the store (isSettingsOpen, activeTab) is only a read-only mirror of it.
export function useSettingsHash(tabs: ComputedRef<SettingsRoutableGroup[]>) {
	const route = useRoute()
	const router = useRouter()
	const settingsStore = useSettings()

	// Set while a close unwinds our entries; carries the query we closed with,
	// since the entry popped back to predates any filter changed while open.
	let closing: { query: RouteLocationNormalizedLoaded['query'] } | null = null

	// go() is async; clear on afterEach (fires on aborts too) so an aborted pop
	// can't leave it stuck.
	let dropping = false
	// Same for close()'s own pop. `closing` can't serve as this flag: it is
	// nulled by the hash watcher, and a refused navigation never changes the
	// hash, so a refused dismiss would leave close() dead for the session.
	let popping = false
	onScopeDispose(
		router.afterEach((_to, _from, failure) => {
			dropping = false
			popping = false
			// Only on a refusal. A completed pop still needs `closing` for the hash
			// watcher below; a refused one never reaches it, and leaving it set
			// force-closes the dialog on the next hash change.
			if (failure) closing = null
		})
	)

	const items = computed(() => tabs.value.flatMap((tab) => tab.items))
	const defaultItem = computed<SettingsRoutableItem | null>(
		() => items.value[0] ?? null
	)

	const isOpen = computed(() => isSettingsHash(route.hash))

	const itemForSlug = (slug: string) =>
		items.value.find((item) => item.slug === slug) ?? null

	const activeTab = computed<SettingsRoutableItem | null>(() => {
		if (!isOpen.value) return null
		return itemForSlug(slugFromHash(route.hash)) ?? defaultItem.value
	})

	const selectTab = (item: SettingsRoutableItem | null) => {
		if (!item || item === activeTab.value) return
		pushSettingsHash(router, item.slug)
	}

	// A record only exists on a tab that takes records; elsewhere the second
	// segment is nonsense and the normalisation watcher strips it.
	const activeRecord = computed<string | null>(() => {
		if (!isOpen.value || !activeTab.value?.records) return null
		return recordFromHash(route.hash)
	})

	// Open a record in the active tab, or return to its list with null (replace = bad-id
	// fallback). INVARIANT: go(-1) assumes a record sits on its tab's list: list→record only.
	const selectRecord = (
		record: string | null,
		options: { replace?: boolean } = {}
	) => {
		const slug = activeTab.value?.slug
		if (!slug || !activeTab.value?.records) return
		const hash = hashFor(slug, record)
		if (route.hash === hash) return
		if (options.replace) {
			// Pop reuses the list entry directly behind this one; depthOf() === 0
			// means we deep-linked in, so fall back to replace instead (same as close()).
			if (depthOf(router) > 0) {
				if (dropping) return
				dropping = true
				router.go(-1)
			} else {
				router.replace({
					query: route.query,
					hash,
					state: withFormBackground(router),
				})
			}
			return
		}
		pushSettingsHash(router, slug, record)
	}

	// Rehashes the CURRENT record entry to a new docname (a rename keeps the
	// record open but changes its name), via replace() so history depth is
	// unchanged and Back still lands on the list. A real browser's replace()
	// merges history.state on its own; memory history drops it, so the current
	// depth is passed explicitly to keep both behaving the same.
	const replaceRecord = (record: string) => {
		const slug = activeTab.value?.slug
		if (!slug || !activeTab.value?.records) return
		const hash = hashFor(slug, record)
		if (route.hash === hash) return
		router.replace({
			query: route.query,
			hash,
			state: withFormBackground(router, { settingsDepth: depthOf(router) }),
		})
	}

	// router.go() is async, so the dialog is still visibly open when a second
	// dismiss arrives (Escape twice, or a backdrop click right after) while
	// depthOf() reads the same value. Popping again would overshoot by a page.
	const close = () => {
		if (!isOpen.value || popping) return
		const ours = depthOf(router)
		const query = { ...route.query }
		if (ours > 0) {
			popping = true
			closing = { query }
			router.go(-ours)
		} else {
			router.replace({ query, hash: '', state: withFormBackground(router) })
		}
	}

	watch(
		() => route.hash,
		(hash) => {
			if (!isSettingsHash(hash)) {
				// Landed back on the page; the entry popped to may predate a filter
				// changed while settings was open, restore it.
				if (closing && !queryEqual(closing.query, route.query)) {
					router.replace({
						query: closing.query,
						hash: route.hash,
						state: withFormBackground(router),
					})
				}
				closing = null
				return
			}
			// Entries gone but a settings hash remains: a deep link then a tab switch.
			// Drop it rather than treat it as a new open.
			if (closing) {
				const { query } = closing
				closing = null
				router.replace({ query, hash: '', state: withFormBackground(router) })
			}
		},
		{ immediate: true }
	)

	// An unknown or permission-hidden slug lands on the default tab (no dead entry).
	// Watches `items` too: tabs load async, so a deep link's slug can't be judged yet.
	watch(
		[() => route.hash, items],
		([hash]) => {
			if (!isSettingsHash(hash) || closing) return
			if (!defaultItem.value) return
			// An empty slug ('#settings/') is normalised too, or the URL would
			// disagree with the default-tab view and nothing else would repair it.
			const item = itemForSlug(slugFromHash(hash))
			if (!item) {
				router.replace({
					query: route.query,
					hash: hashFor(defaultItem.value.slug),
					state: withFormBackground(router),
				})
				return
			}
			// Tab is real but takes no records, drop the phantom id rather than
			// render the list with it still in the URL.
			if (!item.records && recordFromHash(hash)) {
				router.replace({
					query: route.query,
					hash: hashFor(item.slug),
					state: withFormBackground(router),
				})
			}
		},
		{ immediate: true }
	)

	watch(
		[isOpen, activeTab],
		([open, tab]) => {
			settingsStore.isSettingsOpen = open
			settingsStore.activeTab = tab?.label ?? null
		},
		{ immediate: true }
	)

	return {
		items,
		isOpen,
		activeTab,
		activeRecord,
		selectTab,
		selectRecord,
		replaceRecord,
		close,
	}
}
