<template>
	<!-- h-dvh, not h-screen: 100vh is the URL-bar-retracted viewport, so the tab
	     bar sits below the visible area on a phone. Nothing above main scrolls,
	     so the browser never retracts the bar to give that band back. -->
	<div class="relative flex h-dvh flex-col">
		<a
			href="#scrollContainer"
			@click.prevent="skipToContent('scrollContainer')"
			class="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface-base focus:px-4 focus:py-2 focus:text-ink-gray-9 focus:shadow-md focus:outline-none focus:ring-2 focus:ring-outline-gray-3"
		>
			{{ __('Skip to main content') }}
		</a>
		<!-- min-h-0 lets this flex child actually shrink so its own overflow
		     scrolls. The tab bar below is a sibling in normal flow, not fixed, so
		     main simply ends where the bar begins; padding can't do that job
		     here, because Chromium drops a flex column's bottom padding from the
		     scrollable area and the last row stays hidden under the bar. -->
		<main
			class="flex min-h-0 flex-1 flex-col overflow-y-auto focus:outline-none"
			id="scrollContainer"
			tabindex="-1"
		>
			<slot />
		</main>

		<div class="relative z-20 shrink-0">
			<!-- More: the overflow destinations, grouped into sections. No header:
			     the sheet opens from a button that already says what it is, and
			     the sections name themselves. -->
			<BottomSheet v-if="showMoreTab" v-model="showMenu">
				<div class="px-3">
					<template v-for="section in menuSections" :key="section.title">
						<div
							class="px-2 pb-1 pt-3 text-p-xs font-medium uppercase tracking-wide text-ink-gray-5"
						>
							{{ __(section.title) }}
						</div>
						<button
							v-for="item in section.items"
							:key="item.label"
							type="button"
							class="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-start hover:bg-surface-gray-2 active:bg-surface-gray-3"
							@click="handleClick(item)"
						>
							<span
								class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-gray-2"
							>
								<component
									:is="icons[item.icon]"
									class="size-4 stroke-1.5 text-ink-gray-7"
								/>
							</span>
							<span class="min-w-0 flex-1">
								<span
									class="block truncate text-p-base font-medium text-ink-gray-8"
								>
									{{ __(item.label) }}
								</span>
								<span
									v-if="subtitleFor(item.label)"
									class="block truncate text-p-sm text-ink-gray-5"
								>
									{{ __(subtitleFor(item.label)) }}
								</span>
							</span>
							<span
								class="lucide-chevron-right size-4 shrink-0 text-ink-gray-4"
							/>
						</button>
					</template>
					<!-- Reachable only before the admin-configured links land, or if
					     every destination is already on the bar. -->
					<div
						v-if="!menuSections.length"
						class="py-10 text-center text-p-sm text-ink-gray-5"
					>
						{{ __('Nothing else here') }}
					</div>
				</div>
			</BottomSheet>

			<!-- Bottom bar: a few primary tabs + More -->
			<nav
				v-if="!showMoreTab || sidebarSettings.data"
				:aria-label="__('Primary')"
				class="standalone:pb-4 z-10 flex w-full items-stretch border-t border-outline-gray-2 bg-surface-base"
			>
				<button
					v-for="tab in primaryTabs"
					:key="tab.label"
					type="button"
					:aria-current="isActive(tab) ? 'page' : undefined"
					class="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2"
					@click="handleClick(tab)"
				>
					<component
						:is="icons[tab.icon]"
						class="h-6 w-6 stroke-1.5"
						:class="[isActive(tab) ? 'text-ink-gray-9' : 'text-ink-gray-5']"
					/>
					<span
						class="max-w-full truncate text-p-xs"
						:class="[
							isActive(tab) ? 'font-medium text-ink-gray-9' : 'text-ink-gray-5',
						]"
					>
						{{ __(tabLabel(tab.label)) }}
					</span>
				</button>
				<button
					v-if="showMoreTab"
					type="button"
					:aria-expanded="showMenu"
					aria-haspopup="dialog"
					class="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2"
					@click="toggleMenu"
				>
					<component
						:is="icons['Ellipsis']"
						class="h-6 w-6 stroke-1.5"
						:class="[showMenu ? 'text-ink-gray-9' : 'text-ink-gray-5']"
					/>
					<span
						class="max-w-full truncate text-p-xs"
						:class="[
							showMenu ? 'font-medium text-ink-gray-9' : 'text-ink-gray-5',
						]"
					>
						{{ __('More') }}
					</span>
				</button>
			</nav>
		</div>

		<!-- Mounted here as well as in the desk sidebar's UserDropdown: only one
		     layout is alive at a time, so this never double-mounts. -->
		<SettingsModal v-if="isModerator" v-model="settingsStore.isSettingsOpen" />
	</div>
</template>
<script setup>
import { skipToContent } from '@/utils/a11y'
import { getSidebarLinks } from '@/utils'
import { useRouter } from 'vue-router'
import { call } from 'frappe-ui'
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { sessionStore } from '@/stores/session'
import { useSettings } from '@/stores/settings'
import { usersStore } from '@/stores/user'
import * as icons from 'lucide-vue-next'
import { toggleNotifications } from '@/stores/notifications'
import BottomSheet from '@/components/BottomSheet.vue'
import SettingsModal from '@/components/Settings/Settings.vue'
import {
	buildMenuSections,
	hasMoreTab,
	pickPrimaryTabs,
	subtitleFor,
	tabLabel,
} from '@/utils/mobileNav'

const { logout } = sessionStore()
const { isLoggedIn } = storeToRefs(sessionStore())
const settingsStore = useSettings()
const { sidebarSettings, loadSidebarSettings } = settingsStore
const router = useRouter()
let { userResource } = usersStore()
const sidebarLinks = ref([])
const otherLinks = ref([])
const showMenu = ref(false)
const isModerator = ref(false)
const isInstructor = ref(false)

const isSignedIn = computed(
	() => isLoggedIn.value || Boolean(userResource.data)
)
const showMoreTab = computed(() => hasMoreTab(isSignedIn.value))
const primaryTabs = computed(() =>
	pickPrimaryTabs(sidebarLinks.value, isSignedIn.value, sidebarSettings.data)
)

const menuSections = computed(() =>
	buildMenuSections(
		sidebarLinks.value,
		otherLinks.value,
		primaryTabs.value.map((tab) => tab.label)
	)
)

const destructureSidebarLinks = () => {
	let links = []
	sidebarLinks.value.forEach((link) => {
		link.items?.forEach((item) => {
			links.push(item)
		})
	})
	sidebarLinks.value = links
}

const filterLinksToShow = (data) => {
	Object.keys(data).forEach((key) => {
		if (!parseInt(data[key])) {
			sidebarLinks.value = sidebarLinks.value.filter(
				(link) => link.label.toLowerCase().split(' ').join('_') !== key
			)
		}
	})
}

const addOtherLinks = () => {
	if (isSignedIn.value) {
		addLink('Notifications', 'Bell', 'Notifications')
		addLink('Profile', 'UserRound')
		// The desk sidebar's UserDropdown is the only other way in, and it
		// isn't rendered on a phone. Without this, a moderator on mobile has
		// no route to Settings at all.
		if (isModerator.value) addLink('Settings', 'Settings')
		addLink('Log out', 'LogOut')
	} else {
		addLink('Log in', 'LogIn')
	}
}

const addLink = (label, icon, to = '') => {
	if (otherLinks.value.some((link) => link.label === label)) return
	otherLinks.value.push({
		label: label,
		icon: icon,
		to: to,
	})
}

const updateSidebarLinks = () => {
	sidebarLinks.value = getSidebarLinks(true)
	destructureSidebarLinks()
	loadSidebarSettings().then(async () => {
		const data = sidebarSettings.data
		if (!data) return
		filterLinksToShow(data)
		await addPrograms()
		if (isModerator.value || isInstructor.value) {
			addQuizzes()
			addAssignments()
			addProgrammingExercises()
		}
		addOtherLinks()
	})
}

const addQuizzes = () => {
	addLink('Quizzes', 'CircleHelp', 'Quizzes')
}

const addAssignments = () => {
	addLink('Assignments', 'Pencil', 'Assignments')
}

const addProgrammingExercises = () => {
	addLink('Programming Exercises', 'Code', 'ProgrammingExercises')
}

const addPrograms = async () => {
	if (sidebarLinks.value.some((link) => link.label === 'Programs')) return
	let canAddProgram = await checkIfCanAddProgram()
	if (!canAddProgram) return
	let activeFor = ['Programs', 'ProgramDetail']
	let index = 1

	sidebarLinks.value.splice(index, 0, {
		label: 'Programs',
		icon: 'Route',
		to: 'Programs',
		activeFor: activeFor,
	})
}

watch(
	userResource,
	async () => {
		await userResource.promise
		if (userResource.data) {
			isModerator.value = userResource.data.is_moderator
			isInstructor.value = userResource.data.is_instructor
		}
		updateSidebarLinks()
	},
	{ immediate: true }
)

watch(() => sidebarSettings.data, updateSidebarLinks, { deep: true })

const checkIfCanAddProgram = async () => {
	if (!userResource.data) return false
	if (isModerator.value || isInstructor.value) {
		return true
	}
	const programs = await call('lms.lms.utils.get_programs')
	return programs.enrolled.length > 0 || programs.published.length > 0
}

// Against the whole matched chain, not just the leaf name: Profile is a parent
// route that redirects to ProfileAbout, so the leaf never equals 'Profile' and
// the tab could never light up.
let isActive = (tab) => {
	if (!tab.activeFor?.length) return false
	return router.currentRoute.value.matched.some((route) =>
		tab.activeFor.includes(route.name)
	)
}

const handleClick = (tab) => {
	if (tab.label == 'Notifications') {
		toggleNotifications()
	} else if (tab.label == 'Settings') {
		settingsStore.isSettingsOpen = true
	} else if (tab.label == 'Log in') window.location.href = '/login'
	// `isLoggedIn` is a computed off the session user, so the store settles it
	// when logout clears that user. Assigning to it here was a hard build error
	// once it became a storeToRefs const: esbuild refuses to write a const, and
	// the dev server would not start at all.
	else if (tab.label == 'Log out') logout.submit()
	else if (tab.label == 'Profile')
		router.push({
			name: 'Profile',
			params: {
				username: userResource.data?.username,
			},
		})
	else router.push({ name: tab.to })
	showMenu.value = false
}

const toggleMenu = () => {
	showMenu.value = !showMenu.value
}
</script>
