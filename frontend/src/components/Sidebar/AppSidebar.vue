<template>
	<div class="flex h-full flex-col justify-between transition-all duration-300 ease-in-out relative overflow-hidden bg-white sidebar"
		:class="sidebarStore.isSidebarCollapsed ? 'w-16' : 'w-60'">

		<!-- <div
			class="absolute bottom-0 left-0 right-0 h-screen bg-repeat-x bg-bottom pointer-events-none z-0 opacity-90"
			style="background-image: url('/sidebar-bg.png');"
		></div> -->

		<div class="flex flex-col overflow-hidden relative z-10 h-full"
			:class="sidebarStore.isSidebarCollapsed ? 'items-center' : ''">
			<div class="flex h-14 w-full items-center mb-4 shrink-0 border-b border-gray-200  backdrop-blur-sm" :class="sidebarStore.isSidebarCollapsed
					? 'justify-center px-0'
					: 'justify-between px-5'
				">
				<div class="flex items-center overflow-hidden" v-if="!sidebarStore.isSidebarCollapsed">
					<LMSLogoFull class="h-10 rounded flex-shrink-0" />
				</div>
				<div v-else class="flex items-center justify-center w-full">
					<LMSLogo class="h-5" />
				</div>
				<button v-if="!sidebarStore.isSidebarCollapsed"
					class="p-1.5 rounded-md text-gray-600 hover:text-gray-800 transition-colors" @click="toggleSidebar">
					<SidebarCollapseIcon class="w-5 h-5 stroke-1.5" />
				</button>
			</div>
			<div
				class="flex flex-col flex-1 overflow-y-auto px-3 bg-gradient-to-b from-bg-gray-200/10 via-gray-200 to-gray-200/5">
				<div v-if="sidebarSettings.data">
					<div v-for="link in sidebarLinks" class="my-0.5">
						<SidebarLink :link="link" :isCollapsed="sidebarStore.isSidebarCollapsed" />
					</div>
				</div>
				<!-- HIDE WEB PAGES -->
				<!-- <div
					v-if="sidebarSettings.data?.web_pages?.length || isModerator"
					class="mt-4"
				>
					<div
						class="flex items-center justify-between pr-2 cursor-pointer mb-1"
						:class="
							sidebarStore.isSidebarCollapsed ? 'pl-1 justify-center' : 'pl-3'
						"
						@click="toggleWebPages"
					>
						<div
							v-if="!sidebarStore.isSidebarCollapsed"
							class="flex items-center text-xs font-semibold text-gray-400 uppercase tracking-wider"
						>
							<span class="mr-2">
								{{ __('Pages') }}
							</span>
							<ChevronRight
								class="h-3 w-3 stroke-2 text-gray-400 transition-all duration-300 ease-in-out"
								:class="{ 'rotate-90': !sidebarStore.isWebpagesCollapsed }"
							/>
						</div>
						<div v-else>
							<ChevronRight
								class="h-3 w-3 stroke-2 text-gray-400 transition-all duration-300 ease-in-out"
								:class="{ 'rotate-90': !sidebarStore.isWebpagesCollapsed }"
							/>
						</div>

						<Button
							v-if="
								isModerator && !readOnlyMode && !sidebarStore.isSidebarCollapsed
							"
							variant="ghost"
							size="sm"
							@click.stop="openPageModal()"
						>
							<template #icon>
								<Plus class="h-3 w-3 text-ink-gray-7 stroke-2" />
							</template>
</Button>
</div>
<div v-if="sidebarSettings.data?.web_pages?.length" class="flex flex-col transition-all duration-300 ease-in-out"
	:class="!sidebarStore.isWebpagesCollapsed ? 'block' : 'hidden'">
	<div v-for="link in sidebarSettings.data.web_pages" class="my-0.5">
		<SidebarLink :link="link" :isCollapsed="sidebarStore.isSidebarCollapsed"
			:showControls="isModerator ? true : false" @openModal="openPageModal" @deletePage="deletePage" />
	</div>
</div>
</div> -->
			</div>
		</div>

		<div class="m-3 flex flex-col gap-1 relative z-10" v-if="!sidebarStore.isSidebarCollapsed">
			<div v-if="readOnlyMode"
				class="z-10 mb-2 bg-amber-50 border border-amber-200 py-2.5 px-3 text-xs text-amber-800 leading-5 rounded-md">
				{{
					__(
						'This site is being updated. You will not be able to make any changes. Full access will be restored
				shortly.',
					)
				}}
			</div>
			<!-- HIDE BANNERS -->
			<!-- <TrialBanner
				v-if="
					userResource.data?.is_system_manager && userResource.data?.is_fc_site
				"
				:isSidebarCollapsed="sidebarStore.isSidebarCollapsed"
			/>
			<GettingStartedBanner
				v-if="showOnboarding && !isOnboardingStepsCompleted"
				:isSidebarCollapsed="sidebarStore.isSidebarCollapsed"
				appName="learning"
			/> -->
		</div>
		<div class="p-2 flex justify-center z-10" v-if="sidebarStore.isSidebarCollapsed">
			<button class="p-2 rounded-md text-gray-600 hover:text-gray-800 transition-colors" @click="toggleSidebar">
				<SidebarCollapseIcon class="w-5 h-5 stroke-1.5 rotate-180" />
			</button>
		</div>
		<!-- HIDE HELP MODAL -->
		<!-- <HelpModal
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
		/> -->
	</div>
	<PageModal v-model="showPageModal" v-model:reloadSidebar="sidebarSettings" :page="pageToEdit" />
</template>

<script setup>
import SidebarCollapseIcon from '@/components/Icons/SidebarCollapseIcon.vue'
import SidebarLink from '@/components/Sidebar/SidebarLink.vue'
import { getSidebarLinks } from '@/utils'
import { usersStore } from '@/stores/user'
import { sessionStore } from '@/stores/session'
import { useSidebar } from '@/stores/sidebar'
import { useSettings } from '@/stores/settings'
import { Button, call, createResource, Tooltip, toast } from 'frappe-ui'
import PageModal from '@/components/Modals/PageModal.vue'
import { capture } from '@/telemetry'
import LMSLogo from '@/components/Icons/LMSLogo.vue'
import LMSLogoFull from '@/components/Icons/LMSLogoFull.vue'
import { useRouter } from 'vue-router'
import InviteIcon from '@/components/Icons/InviteIcon.vue'
import {
	ref,
	onMounted,
	inject,
	watch,
	reactive,
	markRaw,
	h,
	onUnmounted,
} from 'vue'
import {
	BookOpen,
	CircleAlert,
	ChevronRight,
	Plus,
	CircleHelp,
	FolderTree,
	FileText,
	UserPlus,
	Users,
	BookText,
	Zap,
	Check,
} from 'lucide-vue-next'
import {
	TrialBanner,
	HelpModal,
	GettingStartedBanner,
	useOnboarding,
	showHelpModal,
	minimize,
	IntermediateStepModal,
} from 'frappe-ui/frappe'

const { user, branding } = sessionStore()
const { userResource } = usersStore()
let sidebarStore = useSidebar()
const socket = inject('$socket')
const unreadCount = ref(0)
const sidebarLinks = ref(getSidebarLinks())
const showPageModal = ref(false)
const isModerator = ref(false)
const isInstructor = ref(false)
const pageToEdit = ref(null)
const settingsStore = useSettings()
const { sidebarSettings } = settingsStore
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
	setSidebarLinks()
	setUpOnboarding()
})

const setSidebarLinks = () => {
	sidebarSettings.reload(
		{},
		{
			onSuccess(data) {
				Object.keys(data).forEach((key) => {
					if (!parseInt(data[key])) {
						sidebarLinks.value = sidebarLinks.value.filter(
							(link) => link.label.toLowerCase().split(' ').join('_') !== key,
						)
					}
				})
			},
		},
	)
}


const addQuizzes = () => {
	if (!isInstructor.value && !isModerator.value) return

	const quizzesLinkExists = sidebarLinks.value.some(
		(link) => link.label === 'Quizzes',
	)
	if (quizzesLinkExists) return

	sidebarLinks.value.splice(4, 0, {
		label: 'Quizzes',
		icon: 'CircleHelp',
		to: 'Quizzes',
		activeFor: ['Quizzes', 'QuizForm', 'QuizSubmissionList', 'QuizSubmission'],
	})
}

const addAssignments = () => {
	if (!isInstructor.value && !isModerator.value) return

	const assignmentsLinkExists = sidebarLinks.value.some(
		(link) => link.label === 'Assignments',
	)
	if (assignmentsLinkExists) return

	sidebarLinks.value.splice(5, 0, {
		label: 'Assignments',
		icon: 'Pencil',
		to: 'Assignments',
		activeFor: [
			'Assignments',
			'AssignmentForm',
			'AssignmentSubmissionList',
			'AssignmentSubmission',
		],
	})
}

const addProgrammingExercises = () => {
	if (!isInstructor.value && !isModerator.value) return
	const programmingExercisesLinkExists = sidebarLinks.value.some(
		(link) => link.label === 'Programming Exercises',
	)
	if (programmingExercisesLinkExists) return

	sidebarLinks.value.splice(3, 0, {
		label: 'Programming Exercises',
		icon: 'Code',
		to: 'ProgrammingExercises',
		activeFor: [
			'ProgrammingExercises',
			'ProgrammingExerciseForm',
			'ProgrammingExerciseSubmissions',
			'ProgrammingExerciseSubmission',
		],
	})
}

const addPrograms = async () => {
	const programsLinkExists = sidebarLinks.value.some(
		(link) => link.label === 'Programs',
	)
	if (programsLinkExists) return

	let canAddProgram = await checkIfCanAddProgram()
	if (!canAddProgram) return
	let activeFor = ['Programs', 'ProgramDetail']
	let index = 2

	sidebarLinks.value.splice(index, 0, {
		label: 'Programs',
		icon: 'Route',
		to: 'Programs',
		activeFor: activeFor,
	})
}

const addContactUsDetails = () => {
	if (!settingsStore.contactUsEmail?.data && !settingsStore.contactUsURL?.data)
		return

	const contactUsLinkExists = sidebarLinks.value.some(
		(link) => link.label === 'Contact Us',
	)
	if (contactUsLinkExists) return

	sidebarLinks.value.push({
		label: 'Contact Us',
		icon: settingsStore.contactUsURL?.data ? 'Headset' : 'Mail',
		to: settingsStore.contactUsURL?.data
			? settingsStore.contactUsURL.data
			: settingsStore.contactUsEmail?.data,
	})
}

const checkIfCanAddProgram = async () => {
	if (isModerator.value || isInstructor.value) {
		return true
	}
	const programs = await call('lms.lms.utils.get_programs')
	return programs.enrolled.length > 0 || programs.published.length > 0
}

const addHome = () => {
	const homeLinkExists = sidebarLinks.value.some(
		(link) => link.label === 'Home',
	)
	if (homeLinkExists) return
	sidebarLinks.value.unshift({
		label: 'Home',
		icon: 'HomeIcon',
		to: 'Home',
		activeFor: ['Home'],
	})
}

const openPageModal = (link) => {
	showPageModal.value = true
	pageToEdit.value = link
}

const deletePage = (link) => {
	call('lms.lms.api.delete_documents', {
		doctype: 'LMS Sidebar Item',
		documents: [link.name],
	}).then(() => {
		sidebarSettings.reload()
		toast.success(__('Page deleted successfully'))
	})
}

const toggleSidebar = () => {
	sidebarStore.isSidebarCollapsed = !sidebarStore.isSidebarCollapsed
	localStorage.setItem(
		'isSidebarCollapsed',
		JSON.stringify(sidebarStore.isSidebarCollapsed),
	)
}

const toggleWebPages = () => {
	sidebarStore.isWebpagesCollapsed = !sidebarStore.isWebpagesCollapsed
	localStorage.setItem(
		'isWebpagesCollapsed',
		JSON.stringify(sidebarStore.isWebpagesCollapsed),
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
				router.push({ name: 'CourseForm', params: { courseName: course } })
			} else {
				router.push({ name: 'CourseForm' })
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
					name: 'CourseForm',
					params: { courseName: course },
				})
			} else {
				router.push({ name: 'Courses' })
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
			settingsStore.activeTab = 'Members'
			settingsStore.isSettingsOpen = true
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
					name: 'Batch',
					params: {
						batchName: batch,
					},
				})
			} else {
				router.push({ name: 'Batch' })
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
					name: 'Batch',
					params: {
						batchName: batch,
					},
					hash: '#courses',
				})
			} else {
				router.push({ name: 'Batch' })
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

watch(userResource, () => {
	addContactUsDetails()
	if (userResource.data) {
		isModerator.value = userResource.data.is_moderator
		isInstructor.value = userResource.data.is_instructor
		addHome()
		// HIDE
		// addPrograms()
		// addProgrammingExercises()
		addQuizzes()
		addAssignments()
	}
	setUpOnboarding()
})

const redirectToWebsite = () => {
	window.open('https://frappe.io/learning', '_blank')
}


</script>
