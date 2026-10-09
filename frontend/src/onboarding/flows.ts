import { h, markRaw, type Component } from 'vue'
import {
	Banknote,
	BookOpen,
	CalendarCheck,
	CircleHelp,
	ClipboardList,
	Code,
	FilePlus,
	FileText,
	FolderTree,
	Globe,
	ImagePlus,
	KeyRound,
	Laptop,
	Mail,
	MonitorPlay,
	Upload,
	Users,
	Video,
} from 'lucide-vue-next'
import {
	openBatch,
	openBatchSettings,
	openChapterForm,
	openCourseEditor,
	openCourseSettings,
	openLiveClassForm,
	openNewLesson,
} from '@/onboarding/stepNavigation'
import type {
	FlowNavigation,
	FlowStep,
	OnboardingFlow,
} from '@/onboarding/types'

const iconProps = { strokeWidth: 1.5, width: 16, height: 16 }

function stepIcon(icon: Component): Component {
	return markRaw(h(icon, iconProps))
}

function createBatch(nav: FlowNavigation): FlowStep {
	return {
		name: 'create_first_batch',
		actionLabel: __('Create'),
		title: __('Create a batch'),
		icon: stepIcon(Users),
		completed: false,
		fact: 'has_batch',
		onClick: () => nav.openForm({ name: 'NewBatch' }),
	}
}

// Shared by the live class keys: the pre-choice key and both providers start
// with these three names, so their completions carry over when a tool is
// picked (stored progress is matched by index, so the order is frozen).
function liveClassHead(nav: FlowNavigation): FlowStep[] {
	return [
		createBatch(nav),
		{
			name: 'fill_batch_details',
			actionLabel: __('Fill in'),
			title: __('Fill in batch details'),
			icon: stepIcon(ImagePlus),
			completed: false,
			dependsOn: 'create_first_batch',
			fact: 'has_batch_details',
			onClick: () => openBatchSettings(nav),
		},
		{
			name: 'choose_meeting_tool',
			actionLabel: __('Choose'),
			title: __('Choose a meeting tool'),
			icon: stepIcon(MonitorPlay),
			completed: false,
			chooses: 'live_class',
		},
	]
}

function publishBatch(nav: FlowNavigation): FlowStep {
	return {
		name: 'publish_batch',
		actionLabel: __('Publish'),
		title: __('Publish the batch'),
		icon: stepIcon(Globe),
		completed: false,
		dependsOn: 'create_first_batch',
		fact: 'has_published_batch',
		onClick: () => openBatch(nav),
	}
}

function scheduleLiveClass(nav: FlowNavigation): FlowStep {
	return {
		name: 'schedule_live_class',
		actionLabel: __('Schedule'),
		title: __('Schedule a live class'),
		icon: stepIcon(Laptop),
		completed: false,
		dependsOn: 'create_first_batch',
		fact: 'has_live_class',
		onClick: () => openLiveClassForm(nav),
	}
}

export const publishCourseFlow: OnboardingFlow = {
	id: 'publish_course',
	card: 'publish_course',
	key: 'learning_publish_course',
	steps: (nav) => [
		{
			name: 'create_first_course',
			actionLabel: __('Create'),
			title: __('Create a course'),
			icon: stepIcon(BookOpen),
			completed: false,
			fact: 'has_course',
			onClick: () => nav.openForm({ name: 'NewCourse' }),
		},
		{
			name: 'create_first_chapter',
			actionLabel: __('Add'),
			title: __('Add a chapter'),
			icon: stepIcon(FolderTree),
			completed: false,
			dependsOn: 'create_first_course',
			fact: 'has_chapter',
			onClick: () => openChapterForm(nav),
		},
		{
			name: 'create_first_lesson',
			actionLabel: __('Add'),
			title: __('Add a lesson'),
			icon: stepIcon(FileText),
			completed: false,
			dependsOn: 'create_first_chapter',
			fact: 'has_lesson',
			onClick: () => openNewLesson(nav),
		},
		{
			name: 'set_course_pricing',
			actionLabel: __('Set'),
			title: __('Set pricing'),
			icon: stepIcon(Banknote),
			completed: false,
			dependsOn: 'create_first_course',
			fact: 'has_course_pricing',
			minimizeOnOpen: true,
			onClick: () => openCourseSettings(nav, { pricing: 'paid' }),
		},
		{
			name: 'publish_course',
			actionLabel: __('Publish'),
			title: __('Publish the course'),
			icon: stepIcon(Globe),
			completed: false,
			dependsOn: 'create_first_course',
			fact: 'has_published_course',
			minimizeOnOpen: true,
			onClick: () => openCourseSettings(nav, { publish: '1' }),
		},
	],
}

export const addAssessmentsFlow: OnboardingFlow = {
	id: 'add_assessments',
	card: 'add_assessments',
	key: 'learning_add_assessments',
	steps: (nav) => [
		{
			name: 'add_quiz',
			actionLabel: __('Create'),
			title: __('Create a quiz'),
			icon: stepIcon(CircleHelp),
			completed: false,
			fact: 'has_quiz',
			minimizeOnOpen: true,
			onClick: () => nav.openRoute({ name: 'NewQuiz' }),
		},
		{
			name: 'add_programming_exercise',
			actionLabel: __('Create'),
			title: __('Create a programming exercise'),
			icon: stepIcon(Code),
			completed: false,
			fact: 'has_programming_exercise',
			minimizeOnOpen: true,
			onClick: () => nav.openRoute({ name: 'NewProgrammingExercise' }),
		},
		{
			name: 'add_assignment',
			actionLabel: __('Create'),
			title: __('Create an assignment'),
			icon: stepIcon(ClipboardList),
			completed: false,
			fact: 'has_assignment',
			minimizeOnOpen: true,
			onClick: () => nav.openForm({ name: 'NewAssignment' }),
		},
		{
			// The framework takes one dependsOn; a quiz is the first thing made.
			name: 'add_assessment_to_lesson',
			actionLabel: __('Add'),
			title: __('Add an assessment to a lesson'),
			icon: stepIcon(FilePlus),
			completed: false,
			dependsOn: 'add_quiz',
			fact: 'has_assessment_in_lesson',
			onClick: () => openCourseEditor(nav),
		},
	],
}

export const liveClassFlow: OnboardingFlow = {
	id: 'live_class',
	card: 'live_class',
	key: 'learning_live_class',
	steps: (nav) => liveClassHead(nav),
}

export const liveClassZoomFlow: OnboardingFlow = {
	id: 'live_class_zoom',
	card: 'live_class',
	key: 'learning_live_class_zoom',
	steps: (nav) => [
		...liveClassHead(nav),
		{
			name: 'connect_zoom',
			actionLabel: __('Connect'),
			title: __('Connect a Zoom account'),
			icon: stepIcon(Video),
			completed: false,
			fact: 'has_zoom_account',
			onClick: () => nav.openSettings('zoom', 'new'),
		},
		scheduleLiveClass(nav),
		publishBatch(nav),
	],
}

export const liveClassMeetFlow: OnboardingFlow = {
	id: 'live_class_meet',
	card: 'live_class',
	key: 'learning_live_class_meet',
	steps: (nav) => [
		...liveClassHead(nav),
		{
			name: 'setup_google_api',
			actionLabel: __('Set up'),
			title: __('Set up Google API'),
			icon: stepIcon(KeyRound),
			completed: false,
			fact: 'has_google_api',
			onClick: () => nav.openSettings('services'),
		},
		{
			name: 'connect_google_calendar',
			actionLabel: __('Connect'),
			title: __('Connect Google Calendar'),
			icon: stepIcon(CalendarCheck),
			completed: false,
			dependsOn: 'setup_google_api',
			fact: 'has_google_calendar',
			onClick: () => nav.openSettings('google-calendar', 'new'),
		},
		{
			name: 'add_meet_account',
			actionLabel: __('Add'),
			title: __('Add a Google Meet account'),
			icon: stepIcon(Video),
			completed: false,
			dependsOn: 'connect_google_calendar',
			fact: 'has_meet_account',
			onClick: () => nav.openSettings('google-meet', 'new'),
		},
		scheduleLiveClass(nav),
		publishBatch(nav),
	],
}

export const onboardLearnersFlow: OnboardingFlow = {
	id: 'onboard_learners',
	card: 'onboard_learners',
	key: 'learning_onboard_learners',
	steps: (nav) => [
		{
			name: 'setup_email',
			actionLabel: __('Set up'),
			title: __('Set up email'),
			icon: stepIcon(Mail),
			completed: false,
			fact: 'has_email_account',
			onClick: () => nav.openSettings('email-accounts', 'new'),
		},
		{
			name: 'import_learners',
			actionLabel: __('Import'),
			title: __('Import users in bulk'),
			icon: stepIcon(Upload),
			completed: false,
			fact: 'has_imported_learners',
			onClick: () =>
				nav.openRoute({ name: 'NewDataImport', params: { doctype: 'User' } }),
		},
	],
}

export const FLOWS: readonly OnboardingFlow[] = [
	publishCourseFlow,
	addAssessmentsFlow,
	liveClassFlow,
	liveClassZoomFlow,
	liveClassMeetFlow,
	onboardLearnersFlow,
]

export function getFlow(
	id: string | null | undefined
): OnboardingFlow | undefined {
	return FLOWS.find((flow) => flow.id === id)
}
