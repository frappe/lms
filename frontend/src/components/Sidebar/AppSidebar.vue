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
				{{
					__(
						'This site is being updated. You will not be able to make any changes. Full access will be restored shortly.'
					)
				}}
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
				v-if="showOnboarding && !isOnboardingStepsCompleted"
				:isSidebarCollapsed="sidebarStore.isSidebarCollapsed"
				appName="learning"
			/>
			<div
				class="mt-4 flex gap-3 ps-2"
				:class="
					sidebarStore.isSidebarCollapsed
						? 'flex-col items-start'
						: 'flex-row items-center'
				"
			>
				<Tooltip v-if="readOnlyMode && sidebarStore.isSidebarCollapsed">
					<span
						class="lucide-circle-alert size-4 text-ink-gray-7 cursor-pointer"
					/>
					<template #content>
						<div class="max-w-[30ch] text-center text-p-xs">
							{{
								__(
									'This site is being updated. You will not be able to make any changes. Full access will be restored shortly.'
								)
							}}
						</div>
					</template>
				</Tooltip>
				<Tooltip v-if="showOnboarding" :text="__('Help')">
					<span
						class="lucide-circle-help size-4 text-ink-gray-7 cursor-pointer"
						@click="
							() => {
								showHelpModal = minimize ? true : !showHelpModal
								minimize = !showHelpModal
							}
						"
					/>
				</Tooltip>
				<Tooltip :text="__('Powered by Frappe Learning')">
					<span
						class="lucide-zap size-4 text-ink-gray-7 cursor-pointer"
						@click="redirectToWebsite()"
					/>
				</Tooltip>
			</div>
			<SidebarCollapseToggle
				class="mt-1"
				:aria-label="
					sidebarStore.isSidebarCollapsed ? __('Expand') : __('Collapse')
				"
			/>
		</div>
		<HelpModal
			data-testid="onboarding-help-modal"
			v-if="showOnboarding && showHelpModal"
			v-model="showHelpModal"
			v-model:articles="articles"
			appName="learning"
			title="Frappe Learning"
			:logo="LMSLogo"
			:afterSkip="(step) => capture('onboarding_step_skipped_' + step)"
			:afterSkipAll="() => capture('onboarding_steps_skipped')"
			:afterReset="(step) => capture('onboarding_step_reset_' + step)"
			:afterResetAll="() => capture('onboarding_steps_reset')"
			docsLink="https://docs.frappe.io/learning"
		/>
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
	call,
	Sidebar,
	SidebarCard,
	SidebarCollapseToggle,
	SidebarItem,
	SidebarSection,
	Tooltip,
} from 'frappe-ui'
import { buildSidebarRows } from '@/utils/sidebarRows'
import LMSLogo from '@/components/Icons/LMSLogo.vue'
import { useRouter } from 'vue-router'
import { openFormRoute } from '@/composables/useFormRoute'
import {
	ref,
	onMounted,
	inject,
	watch,
	reactive,
	markRaw,
	h,
	onUnmounted,
	computed,
} from 'vue'
import {
	BookOpen,
	CircleHelp,
	FolderTree,
	FileText,
	UserPlus,
	Users,
	BookText,
} from 'lucide-vue-next'
import { TrialBanner } from '@framework/ui/components/TrialBanner/index'
import {
	HelpModal,
	GettingStartedBanner,
	useOnboarding,
	showHelpModal,
	minimize,
	IntermediateStepModal,
} from '@framework/ui/components/Onboarding/index'
import { useTelemetry } from '@framework/ui/telemetry/index'
import InviteIcon from '@/components/Icons/InviteIcon.vue'
import UserDropdown from '@/components/Sidebar/UserDropdown.vue'
import SidebarLink from '@/components/Sidebar/SidebarLink.vue'
import CommandPalette from '@/components/CommandPalette/CommandPalette.vue'
import { openExternal } from '@/utils/openExternal'
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
const { capture } = useTelemetry()
const isInstructor = ref(false)
const { sidebarSettings, programs, loadSidebarSettings } = useSettings()
const settingsStore = useSettings()
const showOnboarding = ref(false)
const showIntermediateModal = ref(false)
const currentStep = ref({})
const router = useRouter()
let onboardingDetails
let isOnboardingStepsCompleted = false
const readOnlyMode = window.read_only_mode
const iconProps = {
	strokeWidth: 1.5,
	width: 16,
	height: 16,
}

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

const getFirstCourse = async () => {
	let firstCourse = localStorage.getItem('firstCourse')
	if (firstCourse) return firstCourse
	return await call('lms.lms.onboarding.get_first_course')
}

const getFirstBatch = async () => {
	let firstBatch = localStorage.getItem('firstBatch')
	if (firstBatch) return firstBatch
	return await call('lms.lms.onboarding.get_first_batch')
}

const steps = reactive([
	{
		name: 'create_first_course',
		title: __('Create your first course'),
		icon: markRaw(h(BookOpen, iconProps)),
		completed: false,
		onClick: () => {
			minimize.value = true
			router.push({
				name: 'Courses',
			})
		},
	},
	{
		name: 'create_first_chapter',
		title: __('Add your first chapter'),
		icon: markRaw(h(FolderTree, iconProps)),
		completed: false,
		dependsOn: 'create_first_course',
		onClick: async () => {
			minimize.value = true
			let course = await getFirstCourse()
			if (course) {
				router.push({
					name: 'CourseDetail',
					params: { courseName: course },
					hash: '#settings',
				})
			} else {
				openFormRoute(router, { name: 'NewCourse' })
			}
		},
	},
	{
		name: 'create_first_lesson',
		title: __('Add your first lesson'),
		icon: markRaw(h(FileText, iconProps)),
		completed: false,
		dependsOn: 'create_first_chapter',
		onClick: async () => {
			minimize.value = true
			let course = await getFirstCourse()
			if (course) {
				router.push({
					name: 'CourseDetail',
					params: { courseName: course },
					hash: '#settings',
				})
			} else {
				openFormRoute(router, { name: 'NewCourse' })
			}
		},
	},
	{
		name: 'create_first_quiz',
		title: __('Create your first quiz'),
		icon: markRaw(h(CircleHelp, iconProps)),
		completed: false,
		dependsOn: 'create_first_course',
		onClick: () => {
			minimize.value = true
			router.push({ name: 'Quizzes' })
		},
	},
	{
		name: 'invite_students',
		title: __('Invite your team and students'),
		icon: markRaw(h(InviteIcon, iconProps)),
		completed: false,
		onClick: () => {
			minimize.value = true
			pushSettingsHash(router, 'members')
		},
	},
	{
		name: 'create_first_batch',
		title: __('Create your first batch'),
		icon: markRaw(h(Users, iconProps)),
		completed: false,
		onClick: () => {
			minimize.value = true
			router.push({ name: 'Batches' })
		},
	},
	{
		name: 'add_batch_student',
		title: __('Add students to your batch'),
		icon: markRaw(h(UserPlus, iconProps)),
		completed: false,
		dependsOn: 'create_first_batch',
		onClick: async () => {
			minimize.value = true
			let batch = await getFirstBatch()
			if (batch) {
				router.push({
					name: 'BatchDetail',
					params: {
						batchName: batch,
					},
				})
			} else {
				router.push({ name: 'Batches' })
			}
		},
	},
	{
		name: 'add_batch_course',
		title: __('Add courses to your batch'),
		icon: markRaw(h(BookText, iconProps)),
		completed: false,
		dependsOn: 'create_first_batch',
		onClick: async () => {
			minimize.value = true
			let batch = await getFirstBatch()
			if (batch) {
				router.push({
					name: 'BatchDetail',
					params: {
						batchName: batch,
					},
					hash: '#courses',
				})
			} else {
				router.push({ name: 'Batches' })
			}
		},
	},
])

const articles = ref([
	{
		title: __('Introduction'),
		opened: false,
		subArticles: [
			{ name: 'introduction', title: __('Introduction') },
			{ name: 'setting-up', title: __('Setting up') },
		],
	},
	{
		title: __('Creating a course'),
		opened: false,
		subArticles: [
			{ name: 'create-a-course', title: __('Create a course') },
			{ name: 'add-a-chapter', title: __('Add a chapter') },
			{ name: 'add-a-lesson', title: __('Add a lesson') },
		],
	},
	{
		title: __('Creating a batch'),
		opened: false,
		subArticles: [
			{ name: 'create-a-batch', title: __('Create a batch') },
			{ name: 'create-a-live-class', title: __('Create a live class') },
		],
	},
	{
		title: __('Learning Paths'),
		opened: false,
		subArticles: [{ name: 'add-a-program', title: __('Add a program') }],
	},
	{
		title: __('Assessments'),
		opened: false,
		subArticles: [
			{ name: 'quizzes', title: __('Quizzes') },
			{ name: 'assignments', title: __('Assignments') },
		],
	},
	{
		title: __('Certification'),
		opened: false,
		subArticles: [
			{ name: 'issue-a-certificate', title: __('Issue a Certificate') },
			{
				name: 'custom-certificate-templates',
				title: __('Custom Certificate Templates'),
			},
		],
	},
	{
		title: __('Monetization'),
		opened: false,
		subArticles: [
			{
				name: 'setting-up-payment-gateway',
				title: __('Setting up payment gateway'),
			},
		],
	},
	{
		title: __('Settings'),
		opened: false,
		subArticles: [{ name: 'roles', title: __('Roles') }],
	},
])

const setUpOnboarding = () => {
	if (userResource.data?.is_system_manager) {
		onboardingDetails = useOnboarding('learning')
		onboardingDetails.setUp(steps)
		isOnboardingStepsCompleted = onboardingDetails.isOnboardingStepsCompleted
		showOnboarding.value = true
	}
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

const redirectToWebsite = () => {
	openExternal('https://frappe.io/learning')
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
