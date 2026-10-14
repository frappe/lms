import { h, markRaw, type Component } from 'vue'
import {
	AtSign,
	Banknote,
	BookOpen,
	BookPlus,
	CalendarCheck,
	CircleHelp,
	ClipboardList,
	Code,
	FilePlus,
	FileText,
	FolderTree,
	Globe,
	KeyRound,
	Laptop,
	Link2,
	ListChecks,
	LogIn,
	Mail,
	Palette,
	PanelLeft,
	Upload,
	Users,
	Video,
} from 'lucide-vue-next'
import {
	openBatchConferencing,
	openBatchPublish,
	openBatchSettingsForm,
	openChapterForm,
	openCourseEditor,
	openCourseSettings,
	openLiveClassForm,
	openNewAssignment,
	openNewBatch,
	openNewCourse,
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
		onClick: () => openNewBatch(nav),
	}
}

// Shared by both meeting tools' flows, so their completions carry over when
// the tool is switched (stored progress is matched by index, so the order is
// frozen).
function liveClassHead(nav: FlowNavigation): FlowStep[] {
	return [
		createBatch(nav),
		{
			name: 'add_batch_course',
			actionLabel: __('Add'),
			title: __('Add courses to the batch'),
			icon: stepIcon(BookPlus),
			completed: false,
			dependsOn: 'create_first_batch',
			fact: 'has_batch_course',
			onClick: () => openBatchSettingsForm(nav, 'NewBatchCourse'),
		},
		{
			name: 'add_batch_assessment',
			actionLabel: __('Add'),
			title: __('Add assessments to the batch'),
			icon: stepIcon(ListChecks),
			completed: false,
			dependsOn: 'create_first_batch',
			fact: 'has_batch_assessment',
			onClick: () => openBatchSettingsForm(nav, 'NewAssessment'),
		},
	]
}

// Shared by onboard_learners and basic_setup, so one email account ticks both.
function setupEmail(nav: FlowNavigation): FlowStep {
	return {
		name: 'setup_email',
		actionLabel: __('Set up'),
		title: __('Set up email'),
		icon: stepIcon(Mail),
		completed: false,
		fact: 'has_email_account',
		onClick: () => nav.openSettings('email-accounts', 'new'),
	}
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
		minimizeOnOpen: true,
		onClick: () => openBatchPublish(nav),
	}
}

// A live class needs the batch to name its tool and account, so each tool has
// its own step: a batch on Zoom must not tick the Meet flow's.
function accountInBatch(
	nav: FlowNavigation,
	provider: 'Zoom' | 'Google Meet'
): FlowStep {
	const zoom = provider === 'Zoom'
	return {
		name: zoom ? 'set_batch_zoom' : 'set_batch_meet',
		actionLabel: __('Add'),
		title: __('Add the account to the batch'),
		icon: stepIcon(Link2),
		completed: false,
		dependsOn: zoom ? 'connect_zoom' : 'add_meet_account',
		fact: zoom ? 'has_batch_zoom' : 'has_batch_meet',
		minimizeOnOpen: true,
		onClick: () => openBatchConferencing(nav),
	}
}

function scheduleLiveClass(
	nav: FlowNavigation,
	dependsOn: 'set_batch_zoom' | 'set_batch_meet'
): FlowStep {
	return {
		name: 'schedule_live_class',
		actionLabel: __('Schedule'),
		title: __('Schedule a live class'),
		icon: stepIcon(Laptop),
		completed: false,
		dependsOn,
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
			onClick: () => openNewCourse(nav),
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
			onClick: () => openNewAssignment(nav),
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

export const liveClassZoomFlow: OnboardingFlow = {
	id: 'live_class_zoom',
	card: 'live_class',
	key: 'learning_batch_zoom',
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
		accountInBatch(nav, 'Zoom'),
		scheduleLiveClass(nav, 'set_batch_zoom'),
		publishBatch(nav),
	],
}

export const liveClassMeetFlow: OnboardingFlow = {
	id: 'live_class_meet',
	card: 'live_class',
	key: 'learning_batch_meet',
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
		accountInBatch(nav, 'Google Meet'),
		scheduleLiveClass(nav, 'set_batch_meet'),
		publishBatch(nav),
	],
}

export const onboardLearnersFlow: OnboardingFlow = {
	id: 'onboard_learners',
	card: 'onboard_learners',
	key: 'learning_onboard_learners',
	steps: (nav) => [
		setupEmail(nav),
		{
			name: 'import_learners',
			actionLabel: __('Import'),
			title: __('Import users in bulk'),
			icon: stepIcon(Upload),
			completed: false,
			fact: 'has_imported_learners',
			minimizeOnOpen: true,
			onClick: () =>
				nav.openRoute({ name: 'NewDataImport', params: { doctype: 'User' } }),
		},
	],
}

// Sign-up and the sidebar have no fact: every value they hold is a valid
// default, so their tabs tick the steps when they save. The contact email
// step came after the first four shipped, so it stays last.
export const basicSetupFlow: OnboardingFlow = {
	id: 'basic_setup',
	card: 'basic_setup',
	key: 'learning_basic_setup',
	steps: (nav) => [
		setupEmail(nav),
		{
			name: 'add_branding',
			actionLabel: __('Add'),
			title: __('Add your branding'),
			icon: stepIcon(Palette),
			completed: false,
			fact: 'has_branding',
			onClick: () => nav.openSettings('branding'),
		},
		{
			name: 'setup_signup',
			actionLabel: __('Review'),
			title: __('Set up sign-up'),
			icon: stepIcon(LogIn),
			completed: false,
			onClick: () => nav.openSettings('signup'),
		},
		{
			name: 'customise_sidebar',
			actionLabel: __('Customize'),
			title: __('Customize the sidebar'),
			icon: stepIcon(PanelLeft),
			completed: false,
			onClick: () => nav.openSettings('sidebar'),
		},
		{
			name: 'setup_contact_email',
			actionLabel: __('Set up'),
			title: __('Set a contact email'),
			icon: stepIcon(AtSign),
			completed: false,
			fact: 'has_contact_email',
			onClick: () => nav.openSettings('communication-general'),
		},
	],
}

export const FLOWS: readonly OnboardingFlow[] = [
	publishCourseFlow,
	addAssessmentsFlow,
	liveClassZoomFlow,
	liveClassMeetFlow,
	onboardLearnersFlow,
	basicSetupFlow,
]

export function getFlow(
	id: string | null | undefined
): OnboardingFlow | undefined {
	return FLOWS.find((flow) => flow.id === id)
}
