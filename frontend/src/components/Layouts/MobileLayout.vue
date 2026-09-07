<template>
	<div class="relative flex h-dvh flex-col">
		<a
			href="#scrollContainer"
			@click.prevent="skipToContent('scrollContainer')"
			class="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface-base focus:px-4 focus:py-2 focus:text-ink-gray-9 focus:shadow-md focus:outline-none focus:ring-2 focus:ring-outline-gray-3"
		>
			{{ __('Skip to main content') }}
		</a>
		<main
			class="flex min-h-0 flex-1 flex-col overflow-y-auto focus:outline-none"
			id="scrollContainer"
			tabindex="-1"
		>
			<slot />
		</main>

		<div class="relative z-20 shrink-0">
			<nav
				v-if="!isSignedIn || sidebarSettings.data"
				:aria-label="__('Primary')"
				class="pb-safe-0 z-10 flex w-full items-stretch border-t border-outline-gray-2 bg-surface-base"
			>
				<button
					v-for="tab in primaryTabs"
					:key="tab.label"
					type="button"
					:aria-current="isActive(tab) ? 'page' : undefined"
					class="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2"
					@click="handleClick(tab)"
				>
					<Avatar
						v-if="tab.avatar"
						aria-hidden="true"
						data-testid="you-tab-avatar"
						:image="userResource.data?.user_image"
						:label="userResource.data?.full_name || __('You')"
						size="md"
						class="shrink-0"
						:class="[isActive(tab) ? 'ring-2 ring-outline-gray-5' : '']"
					/>
					<component
						v-else
						:is="icons[tab.icon]"
						class="h-6 w-6 stroke-1.5"
						:class="[isActive(tab) ? 'text-ink-gray-9' : 'text-ink-gray-5']"
						aria-hidden="true"
					/>
					<span
						class="max-w-full break-words text-center text-p-xs"
						:class="[
							isActive(tab) ? 'font-medium text-ink-gray-9' : 'text-ink-gray-5',
						]"
					>
						{{ __(tabLabel(tab.label)) }}
					</span>
				</button>
			</nav>
		</div>
	</div>
</template>
<script setup>
// Two browser constraints the markup depends on and neither expresses.
//
// The frame is `h-dvh`, not `h-screen`: 100vh is the URL-bar-retracted
// viewport, so the tab bar would sit below the visible area on a phone, and
// nothing above main scrolls, so the browser never retracts the bar to give
// that band back.
//
// `main` is `min-h-0` so the flex child can actually shrink and scroll its own
// overflow. The tab bar below is a sibling in normal flow, not fixed, so main
// simply ends where the bar begins. Padding cannot do that job: Chromium drops
// a flex column's bottom padding from the scrollable area and the last row
// stays hidden under the bar.
import { skipToContent } from '@/utils/a11y'
import { useRouter } from 'vue-router'
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { sessionStore } from '@/stores/session'
import { useSettings } from '@/stores/settings'
import { usersStore } from '@/stores/user'
import * as icons from 'lucide-vue-next'
import { Avatar } from 'frappe-ui'
import { ensureMobileNavLinks, sidebarLinks } from '@/stores/mobileNavLinks'
import { pickPrimaryTabs, tabLabel } from '@/utils/mobileNav'

const { isLoggedIn } = storeToRefs(sessionStore())
const settingsStore = useSettings()
const { sidebarSettings } = settingsStore
const router = useRouter()
let { userResource } = usersStore()
const isModerator = ref(false)
const isInstructor = ref(false)
const isEvaluator = ref(false)

const isSignedIn = computed(
	() => isLoggedIn.value || Boolean(userResource.data)
)

// Five real routes, no overflow affordance: Home, Courses, Batches, Programs
// and You. Whatever the bar does not hold is reached from the You page.
//
// The captions wrap rather than `truncate`. Nothing on the default bar needs
// it (the longest, "Programs", is about 56px in a 67px column), but `text-p-xs`
// is a fixed 12px inside a viewport-proportional column, so under OS text
// scaling an ellipsis would eat half the word with no way to read the rest
// (WCAG 1.4.4). `break-words` only splits a word that cannot fit a line alone.
const primaryTabs = computed(() =>
	pickPrimaryTabs(sidebarLinks.value, isSignedIn.value, sidebarSettings.data)
)

// The active You tab rings its avatar with `ring-outline-gray-5`, Gameplan's
// grey one step darker. The token has to come from the `outline-*` family:
// frappe-ui's preset extends `ringColor` with `outline`/`outline-alpha` only and
// never extends `ringOffsetColor`, so an `ink-*` ring colour, or any
// ring-offset colour, compiles to nothing and `ring-2` silently falls back to
// Tailwind's stock blue-300/50 on a white offset. That is what shipped here.
//
// gray-5 rather than Gameplan's own gray-4 because this ring is the only
// indicator here that WCAG 1.4.11 counts: `aria-current` is programmatic, and
// the label's colour shift is text, so 1.4.3 covers it instead. Without a
// ring-offset the ring also abuts an arbitrary user avatar, leaving
// `surface-base` as the only adjacency we control, and gray-4 measures
// 2.85:1 light / 2.48:1 dark against it, where gray-5 reaches 4.17 / 4.18.
//
// The links themselves live in `stores/mobileNavLinks`, because the You page
// lists the same set and is a route of its own, and so does the decision about
// whether a load is needed at all. Both watchers below announce a viewer rather
// than commanding a load: they fire two or three times per boot between them,
// and `ensureMobileNavLinks` turns the repeats into one run, so a learner is
// asked for `get_programs` once instead of once per firing. The You page
// announces the same viewer when it mounts and gets the same run back.
const updateSidebarLinks = () =>
	ensureMobileNavLinks({
		isSignedIn: isSignedIn.value,
		isModerator: isModerator.value,
		isInstructor: isInstructor.value,
		isEvaluator: isEvaluator.value,
		hasUserInfo: Boolean(userResource.data),
	})

watch(
	userResource,
	async () => {
		await userResource.promise
		if (userResource.data) {
			isModerator.value = userResource.data.is_moderator
			isInstructor.value = userResource.data.is_instructor
			isEvaluator.value = userResource.data.is_evaluator
		}
		updateSidebarLinks()
	},
	{ immediate: true }
)

watch(() => sidebarSettings.data, updateSidebarLinks, { deep: true })

// Against the whole matched chain, not just the leaf name: a tab may point at a
// parent route that redirects to a child, so the leaf never equals the tab's own
// name and it could never light up.
let isActive = (tab) => {
	if (!tab.activeFor?.length) return false
	return router.currentRoute.value.matched.some((route) =>
		tab.activeFor.includes(route.name)
	)
}

// Every tab is a route: the session actions live on the You page. Log in is the
// one exception, leaving the SPA for Frappe's own /login, which vue-router
// knows nothing about.
const handleClick = (tab) => {
	if (tab.label == 'Log in') window.location.href = '/login'
	else router.push({ name: tab.to })
}
</script>
