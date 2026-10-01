<template>
	<Sidebar
		:collapsed="sidebarStore.isSidebarCollapsed"
		width="14rem"
		:ariaLabel="__('Main')"
		class="border-e"
		@update:collapsed="setCollapsed"
	>
		<UserDropdown />
		<div class="min-h-0 flex-1 overflow-y-auto px-2 pt-2">
			<div v-if="sidebarSettings.data" class="flex flex-col gap-0.5">
				<template v-for="row in sidebarRows" :key="row.key">
					<div v-if="row.kind === 'gap'" class="h-2.5" aria-hidden="true" />
					<SidebarSection
						v-else-if="row.kind === 'accordion'"
						:label="__(row.label)"
						collapsible
						:collapsed="!sidebarStore.isGroupOpen(row.key)"
						@update:collapsed="sidebarStore.toggleGroup(row.key)"
					>
						<SidebarLink
							v-for="item in row.items"
							:key="item.key"
							:link="item.link"
						/>
					</SidebarSection>
					<SidebarLink v-else :link="row.link" />
				</template>
			</div>
		</div>
		<div class="mt-auto flex flex-col gap-1 px-2 pb-2">
			<div
				v-if="readOnlyMode && !sidebarStore.isSidebarCollapsed"
				class="z-10 m-2 bg-surface-elevation-2 py-2.5 px-3 text-p-xs text-ink-gray-7 rounded-5"
			>
				{{ readOnlyNotice }}
			</div>
			<template v-if="isStudent && !profileIsComplete">
				<SidebarItem
					v-if="sidebarStore.isSidebarCollapsed"
					:label="__('Complete your profile')"
					icon="lucide-user"
					:route="profileRoute"
					:active="false"
				/>
				<SidebarCard
					v-else
					:title="__('Complete your profile')"
					:description="
						__('Highlight what makes you unique and show your skills.')
					"
					icon="lucide-user"
					:action="{
						label: __('My Profile'),
						route: profileRoute,
						iconLeft: 'lucide-chevrons-right',
					}"
				/>
			</template>
			<TrialBanner
				v-if="
					userResource.data?.is_system_manager && userResource.data?.is_fc_site
				"
				:isSidebarCollapsed="sidebarStore.isSidebarCollapsed"
			/>
			<GettingStartedBanner
				v-if="bannerFlow"
				:key="bannerFlow.key"
				:isSidebarCollapsed="sidebarStore.isSidebarCollapsed"
				:appName="bannerFlow.key"
			/>
			<div
				class="mt-4 flex gap-3 ps-2"
				:class="
					sidebarStore.isSidebarCollapsed
						? 'flex-col items-start'
						: 'flex-row items-center'
				"
			>
				<template v-if="readOnlyMode && sidebarStore.isSidebarCollapsed">
					<Tooltip>
						<span
							class="lucide-circle-alert size-4 text-ink-gray-7 cursor-pointer"
							aria-hidden="true"
						/>
						<template #content>
							<div class="max-w-[30ch] text-center text-p-xs">
								{{ readOnlyNotice }}
							</div>
						</template>
					</Tooltip>
					<span class="sr-only">{{ readOnlyNotice }}</span>
				</template>
				<Tooltip v-if="isSetUp" :text="__('Help')">
					<button
						type="button"
						class="flex"
						:aria-label="__('Help')"
						@click="
							() => {
								showHelpModal = minimize ? true : !showHelpModal
								minimize = !showHelpModal
							}
						"
					>
						<span
							class="lucide-circle-help size-4 text-ink-gray-7 cursor-pointer"
							aria-hidden="true"
						/>
					</button>
				</Tooltip>
				<Tooltip :text="__('Powered by Frappe Learning')">
					<a
						href="https://frappe.io/learning"
						v-external
						class="flex"
						:aria-label="__('Powered by Frappe Learning')"
					>
						<span
							class="lucide-zap size-4 text-ink-gray-7 cursor-pointer"
							aria-hidden="true"
						/>
					</a>
				</Tooltip>
			</div>
			<SidebarCollapseToggle
				class="mt-1"
				:aria-label="
					sidebarStore.isSidebarCollapsed ? __('Expand') : __('Collapse')
				"
			/>
		</div>
		<OnboardingFlowPanel v-if="isSetUp && showHelpModal" />
		<IntermediateStepModal
			v-model="showIntermediateModal"
			:currentStep="currentStep"
		/>
	</Sidebar>
	<CommandPalette v-model="settingsStore.isCommandPaletteOpen" />
</template>

<script setup>
import { getSidebarLinks } from '@/utils'
import { usersStore } from '@/stores/user'
import { useSidebar } from '@/stores/sidebar'
import { useSettings } from '@/stores/settings'
import {
	Sidebar,
	SidebarCard,
	SidebarCollapseToggle,
	SidebarItem,
	SidebarSection,
	Tooltip,
} from 'frappe-ui'
import { buildSidebarRows } from '@/utils/sidebarRows'
import { useRouter } from 'vue-router'
import { openFormRoute } from '@/composables/useFormRoute'
import { ref, onMounted, inject, watch, onUnmounted, computed } from 'vue'
import { TrialBanner } from '@framework/ui/components/TrialBanner/index'
import {
	GettingStartedBanner,
	showHelpModal,
	minimize,
	IntermediateStepModal,
} from '@framework/ui/components/Onboarding/index'
import UserDropdown from '@/components/Sidebar/UserDropdown.vue'
import SidebarLink from '@/components/Sidebar/SidebarLink.vue'
import CommandPalette from '@/components/CommandPalette/CommandPalette.vue'
import OnboardingFlowPanel from '@/components/Onboarding/OnboardingFlowPanel.vue'
import { useLearningOnboarding } from '@/onboarding/useLearningOnboarding'
import { pushSettingsHash } from '@/composables/useSettingsHash'
import {
	loadUnreadCount,
	unreadCount,
	unreadNotifications,
} from '@/stores/notifications'

const { userResource } = usersStore()
let sidebarStore = useSidebar()
const socket = inject('$socket')
const sidebarLinks = ref(null)
const isInstructor = ref(false)
const { sidebarSettings, programs, loadSidebarSettings } = useSettings()
const settingsStore = useSettings()
const showIntermediateModal = ref(false)
const currentStep = ref({})
const router = useRouter()
const readOnlyMode = window.read_only_mode
const readOnlyNotice = __(
	'This site is being updated. You will not be able to make any changes. Full access will be restored shortly.'
)
const { isSetUp, bannerFlow, setUpAll } = useLearningOnboarding()

onMounted(() => {
	setUpOnboarding()
	addKeyboardShortcut()
	updateSidebarLinks()
	loadUnreadCount()
	socket.on('publish_lms_notifications', () => {
		unreadNotifications.reload()
	})
})

// The count lives in stores/notifications now, so the badge follows it rather
// than being written from the resource's onSuccess.
watch(unreadCount, () => updateUnreadCount())

const sidebarRows = computed(() =>
	buildSidebarRows(sidebarLinks.value ?? [], sidebarSettings.data)
)

const onKeyboardShortcut = (e) => {
	if (
		e.key === 'k' &&
		(e.ctrlKey || e.metaKey) &&
		!e.repeat &&
		!e.target.classList.contains('ProseMirror')
	) {
		toggleCommandPalette()
		e.preventDefault()
	}
}

const addKeyboardShortcut = () => {
	window.addEventListener('keydown', onKeyboardShortcut)
}

const toggleCommandPalette = () => {
	settingsStore.isCommandPaletteOpen = !settingsStore.isCommandPaletteOpen
}

const updateUnreadCount = () => {
	sidebarLinks.value?.forEach((link) => {
		link.items.forEach((item) => {
			if (item.label === 'Notifications') {
				item.count = unreadCount.value || 0
			}
		})
	})
}

const setCollapsed = (collapsed) => {
	sidebarStore.isSidebarCollapsed = collapsed
	localStorage.setItem('isSidebarCollapsed', JSON.stringify(collapsed))
}

// Step clicks tuck the panel away so the page they open is visible.
const flowNavigation = {
	openRoute: (to) => {
		minimize.value = true
		router.push(to)
	},
	openForm: (to) => {
		minimize.value = true
		openFormRoute(router, to)
	},
	openSettings: (slug) => {
		minimize.value = true
		pushSettingsHash(router, slug)
	},
}

const setUpOnboarding = () => {
	if (userResource.data?.is_system_manager) setUpAll(flowNavigation)
}

watch(userResource, async () => {
	await userResource.promise
	if (userResource.data) {
		isInstructor.value = userResource.data.is_instructor
		await programs.reload()
		setUpOnboarding()
	}
	updateSidebarLinks()
})

watch(settingsStore.settings, () => {
	updateSidebarLinks()
})

watch(
	() => sidebarSettings.data,
	() => updateSidebarLinks(),
	{ deep: true }
)

const updateSidebarLinks = () => {
	sidebarLinks.value = getSidebarLinks()
	loadSidebarSettings()
	updateUnreadCount()
}

const isStudent = computed(() => {
	return userResource.data?.is_student
})

const profileRoute = computed(() => ({
	name: 'Profile',
	params: { username: userResource.data?.username },
}))

const profileIsComplete = computed(() => {
	return (
		userResource.data?.user_image &&
		userResource.data?.headline &&
		userResource.data?.bio
	)
})

onUnmounted(() => {
	socket.off('publish_lms_notifications')
	window.removeEventListener('keydown', onKeyboardShortcut)
})
</script>
