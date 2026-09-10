<template>
	<div
		class="flex h-full flex-col justify-between transition-all duration-300 ease-in-out border-e bg-surface-sidebar overflow-x-hidden"
		:class="sidebarStore.isSidebarCollapsed ? 'w-14' : 'w-56'"
	>
		<div
			class="flex flex-col overflow-y-auto flex-1 min-h-0"
			:class="sidebarStore.isSidebarCollapsed ? 'items-center' : ''"
		>
			<UserDropdown :isCollapsed="sidebarStore.isSidebarCollapsed" />
			<nav v-if="sidebarSettings.data" class="mx-2 my-2.5 space-y-1">
				<template v-for="row in sidebarRows" :key="row.key">
					<div v-if="row.kind === 'gap'" class="h-2.5" aria-hidden="true" />
					<div v-else-if="row.kind === 'accordion'" class="pt-2">
						<button
							type="button"
							class="flex w-full items-center pe-2 my-1 text-ink-gray-5"
							:aria-expanded="sidebarStore.isGroupOpen(row.key)"
							@click="sidebarStore.toggleGroup(row.key)"
						>
							<span class="grid h-5 w-6 flex-shrink-0 place-items-center">
								<span
									class="lucide-chevron-right h-4 w-4 text-ink-gray-9 transition-all duration-300 ease-in-out"
									:class="{
										'rotate-90': sidebarStore.isGroupOpen(row.key),
										'rtl:rotate-180': !sidebarStore.isGroupOpen(row.key),
									}"
								/>
							</span>
							<span v-if="!sidebarStore.isSidebarCollapsed" class="ms-2">
								{{ __(row.label) }}
							</span>
						</button>
						<div v-show="sidebarStore.isGroupOpen(row.key)" class="space-y-1">
							<SidebarLink
								v-for="item in row.items"
								:key="item.key"
								:link="item.link"
								:isCollapsed="sidebarStore.isSidebarCollapsed"
							/>
						</div>
					</div>
					<SidebarLink
						v-else
						:link="row.link"
						:isCollapsed="sidebarStore.isSidebarCollapsed"
					/>
				</template>
			</nav>
		</div>
		<div class="m-2 flex flex-col gap-1">
			<div
				v-if="readOnlyMode && !sidebarStore.isSidebarCollapsed"
				class="z-10 m-2 bg-surface-elevation-2 py-2.5 px-3 text-p-xs text-ink-gray-7 rounded-md"
			>
				{{
					__(
						'This site is being updated. You will not be able to make any changes. Full access will be restored shortly.'
					)
				}}
			</div>
			<div
				v-if="
					isStudent && !profileIsComplete && !sidebarStore.isSidebarCollapsed
				"
				class="flex flex-col gap-3 text-ink-gray-9 py-2.5 px-3 bg-surface-base shadow-sm rounded-md"
			>
				<div class="flex flex-col text-p-sm gap-1">
					<div class="inline-flex gap-1">
						<span class="lucide-user h-4 my-0.5 shrink-0" />
						<div class="font-medium">
							{{ __('Complete your profile') }}
						</div>
					</div>
					<div class="text-ink-gray-7">
						{{ __('Highlight what makes you unique and show your skills.') }}
					</div>
				</div>
				<router-link
					:to="{
						name: 'Profile',
						params: {
							username: userResource.data?.username,
						},
					}"
				>
					<Button :label="__('My Profile')" class="w-full">
						<template #prefix>
							<span class="lucide-chevrons-right h-4 w-4 text-ink-gray-7" />
						</template>
					</Button>
				</router-link>
			</div>
			<Tooltip
				v-if="
					isStudent && !profileIsComplete && sidebarStore.isSidebarCollapsed
				"
				:text="__('Complete your profile')"
			>
				<router-link
					:to="{
						name: 'Profile',
						params: {
							username: userResource.data?.username,
						},
					}"
					class="flex items-center justify-center"
				>
					<span class="lucide-user size-4 text-ink-gray-7 cursor-pointer" />
				</router-link>
			</Tooltip>
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
				class="flex items-center mt-4"
				:class="
					sidebarStore.isSidebarCollapsed ? 'flex-col space-y-3' : 'flex-row'
				"
			>
				<div
					class="flex items-center flex-1 gap-3"
					:class="sidebarStore.isSidebarCollapsed ? 'flex-col' : 'flex-row'"
				>
					<Tooltip v-if="readOnlyMode && sidebarStore.isSidebarCollapsed">
						<span
							class="lucide-circle-alert size-4 text-ink-gray-7 cursor-pointer"
						/>
						<template #body>
							<div
								class="max-w-[30ch] rounded bg-surface-gray-10 px-2 py-1 text-center text-p-xs text-ink-base shadow-xl"
							>
								{{
									__(
										'This site is being updated. You will not be able to make any changes. Full access will be restored shortly.'
									)
								}}
							</div>
						</template>
					</Tooltip>
					<Tooltip
						v-if="showAppointmentIcon"
						:text="__('Book a free onboarding session with the Frappe team')"
					>
						<span
							class="lucide-phone size-4 text-ink-gray-7 cursor-pointer"
							@click="redirectToAppointmentScreen()"
						/>
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
				<Tooltip
					:text="
						sidebarStore.isSidebarCollapsed ? __('Expand') : __('Collapse')
					"
				>
					<CollapseSidebar
						class="size-4 text-ink-gray-7 duration-300 stroke-1.5 ease-in-out cursor-pointer"
						:style="{
							transform:
								isRtl !== sidebarStore.isSidebarCollapsed
									? 'rotateY(180deg)'
									: '',
						}"
						@click="toggleSidebar()"
					/>
				</Tooltip>
			</div>
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
	</div>
	<CommandPalette v-model="settingsStore.isCommandPaletteOpen" />
</template>

<script setup>
import { getSidebarLinks } from '@/utils'
import { usersStore } from '@/stores/user'
import { useSidebar } from '@/stores/sidebar'
import { useSettings } from '@/stores/settings'
import { Button, call, Tooltip } from 'frappe-ui'
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
import {
	TrialBanner,
	HelpModal,
	GettingStartedBanner,
	useOnboarding,
	showHelpModal,
	minimize,
	IntermediateStepModal,
	useTelemetry,
} from 'frappe-ui/frappe'
import InviteIcon from '@/components/Icons/InviteIcon.vue'
import UserDropdown from '@/components/Sidebar/UserDropdown.vue'
import CollapseSidebar from '@/components/Icons/CollapseSidebar.vue'
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
const isRtl = document.documentElement.dir === 'rtl'
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

const addKeyboardShortcut = () => {
	window.addEventListener('keydown', (e) => {
		if (
			e.key === 'k' &&
			(e.ctrlKey || e.metaKey) &&
			!e.target.classList.contains('ProseMirror')
		) {
			toggleCommandPalette()
			e.preventDefault()
		}
	})
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

const toggleSidebar = () => {
	sidebarStore.isSidebarCollapsed = !sidebarStore.isSidebarCollapsed
	localStorage.setItem(
		'isSidebarCollapsed',
		JSON.stringify(sidebarStore.isSidebarCollapsed)
	)
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

const profileIsComplete = computed(() => {
	return (
		userResource.data?.user_image &&
		userResource.data?.headline &&
		userResource.data?.bio
	)
})

const showAppointmentIcon = computed(() => {
	let isTrialPlan = userResource.data?.site_info?.plan?.is_trial_plan
	let trialEndDate = calculateTrialEndDays(
		userResource.data?.site_info?.trial_end_date
	)
	return (
		userResource.data?.is_system_manager &&
		userResource.data?.is_fc_site &&
		isTrialPlan &&
		trialEndDate > 0
	)
})

const calculateTrialEndDays = (trialEndDate) => {
	if (!trialEndDate) return 0

	trialEndDate = new Date(trialEndDate)
	const today = new Date()
	const diffTime = trialEndDate - today
	const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
	return diffDays
}

const redirectToAppointmentScreen = () => {
	openExternal(
		'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ0c7Z3XIpW1WgbeIuktSaoX6qudoYuSdRbIlJty5TW7p4IZaOk5viHQGwTNi6HpNVqzOZOTHcle'
	)
}

onUnmounted(() => {
	socket.off('publish_lms_notifications')
})
</script>
