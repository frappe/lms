import { h, markRaw, type Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import type { OnboardingStep } from '@framework/ui/components/Onboarding/index'
import {
	Banknote,
	BookOpen,
	CalendarCheck,
	CircleHelp,
	FileText,
	FolderTree,
	Globe,
	Mail,
	KeyRound,
	Laptop,
	Upload,
	Users,
	Video,
} from 'lucide-vue-next'
import InviteIcon from '@/components/Icons/InviteIcon.vue'

export type FlowId =
	| 'publish_course'
	| 'onboard_learners'
	| 'live_class_zoom'
	| 'live_class_meet'

/** A list entry. A card with a question holds one flow per answer. */
export type CardId = 'publish_course' | 'onboard_learners' | 'live_class'

export const FACT_KEYS = [
	'has_course',
	'has_chapter',
	'has_lesson',
	'has_quiz',
	'has_course_pricing',
	'has_published_course',
	'has_imported_learners',
	'has_invited_student',
	'has_sent_invitation',
	'has_batch',
	'has_zoom_account',
	'has_google_api',
	'has_google_calendar',
	'has_meet_account',
	'has_live_class',
	'has_published_batch',
] as const

export type FactKey = typeof FACT_KEYS[number]

/** `lms.lms.onboarding.get_onboarding_facts`. */
export type OnboardingFacts = Record<FactKey, boolean> & {
	first_course: string | null
	first_batch: string | null
}

/** What a step click can do. The sidebar supplies it, bound to the router. */
export interface FlowNavigation {
	/** Read at click time, so targets learnt after set-up are used. */
	facts: Partial<OnboardingFacts>
	openRoute: (to: RouteLocationRaw) => void
	openForm: (to: RouteLocationRaw) => void
	openSettings: (slug: string) => void
	/** A page outside the SPA, such as a desk form, in a new tab. */
	openExternal: (url: string) => void
	complete: (step: string) => void
}

export interface FlowStep extends OnboardingStep {
	/** Fact that marks this step done for work finished before onboarding. */
	fact?: FactKey
}

export interface OnboardingFlow {
	id: FlowId
	/** The list card this flow belongs to. */
	card: CardId
	/** `useOnboarding` key; progress is stored under `<key>_onboarding_status`. */
	key: string
	/** Order is frozen once shipped: stored progress is matched by index. */
	steps: (nav: FlowNavigation) => FlowStep[]
}

export interface QuestionOption {
	value: string
	readonly label: string
	readonly description: string
	flow: OnboardingFlow
}

export interface CardQuestion {
	readonly label: string
	readonly title: string
	options: QuestionOption[]
}

export interface FlowCard {
	id: CardId
	readonly title: string
	readonly description: string
	icon: Component
	/** Asked before the checklist; each answer has its own flow and key. */
	question?: CardQuestion
	/** Cards to offer once this one is done, best first. */
	next: CardId[]
	flows: OnboardingFlow[]
}

const iconProps = { strokeWidth: 1.5, width: 16, height: 16 }

function stepIcon(icon: Component): Component {
	return markRaw(h(icon, iconProps))
}

function openCourse(nav: FlowNavigation, hash: string): void {
	const courseName = nav.facts.first_course
	if (!courseName) return nav.openRoute({ name: 'Courses' })
	nav.openRoute({ name: 'CourseDetail', params: { courseName }, hash })
}

function openBatchForm(
	nav: FlowNavigation,
	name: 'NewLiveClass',
	hash: string
): void {
	const batchName = nav.facts.first_batch
	if (!batchName) return nav.openRoute({ name: 'Batches' })
	nav.openForm({ name, params: { batchName }, hash })
}

function openBatch(nav: FlowNavigation): void {
	const batchName = nav.facts.first_batch
	if (!batchName) return nav.openRoute({ name: 'Batches' })
	nav.openRoute({ name: 'BatchDetail', params: { batchName } })
}

function createBatch(nav: FlowNavigation): FlowStep {
	return {
		name: 'create_first_batch',
		title: __('Create a batch'),
		icon: stepIcon(Users),
		completed: false,
		fact: 'has_batch',
		onClick: () => nav.openForm({ name: 'NewBatch' }),
	}
}

function publishBatch(nav: FlowNavigation): FlowStep {
	return {
		name: 'publish_batch',
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
		title: __('Schedule a live class'),
		icon: stepIcon(Laptop),
		completed: false,
		dependsOn: 'create_first_batch',
		fact: 'has_live_class',
		onClick: () => openBatchForm(nav, 'NewLiveClass', '#classes'),
	}
}

const publishCourseFlow: OnboardingFlow = {
	id: 'publish_course',
	card: 'publish_course',
	key: 'learning_publish_course',
	steps: (nav) => [
		{
			name: 'create_first_course',
			title: __('Create a course'),
			icon: stepIcon(BookOpen),
			completed: false,
			fact: 'has_course',
			onClick: () => nav.openForm({ name: 'NewCourse' }),
		},
		{
			name: 'create_first_chapter',
			title: __('Add a chapter'),
			icon: stepIcon(FolderTree),
			completed: false,
			dependsOn: 'create_first_course',
			fact: 'has_chapter',
			onClick: () => openCourse(nav, '#editor'),
		},
		{
			name: 'create_first_lesson',
			title: __('Add a lesson'),
			icon: stepIcon(FileText),
			completed: false,
			dependsOn: 'create_first_chapter',
			fact: 'has_lesson',
			onClick: () => openCourse(nav, '#editor'),
		},
		{
			name: 'add_quiz',
			title: __('Add a quiz'),
			icon: stepIcon(CircleHelp),
			completed: false,
			fact: 'has_quiz',
			onClick: () => nav.openRoute({ name: 'NewQuiz' }),
		},
		{
			name: 'set_course_pricing',
			title: __('Set pricing'),
			icon: stepIcon(Banknote),
			completed: false,
			dependsOn: 'create_first_course',
			fact: 'has_course_pricing',
			onClick: () => openCourse(nav, '#settings'),
		},
		{
			name: 'publish_course',
			title: __('Publish the course'),
			icon: stepIcon(Globe),
			completed: false,
			dependsOn: 'create_first_course',
			fact: 'has_published_course',
			onClick: () => openCourse(nav, '#settings'),
		},
	],
}

const onboardLearnersFlow: OnboardingFlow = {
	id: 'onboard_learners',
	card: 'onboard_learners',
	key: 'learning_onboard_learners',
	steps: (nav) => [
		{
			name: 'import_learners',
			title: __('Import learners in bulk'),
			icon: stepIcon(Upload),
			completed: false,
			fact: 'has_imported_learners',
			onClick: () =>
				nav.openRoute({ name: 'NewDataImport', params: { doctype: 'User' } }),
		},
		{
			name: 'add_learner',
			title: __('Add a learner by email'),
			icon: stepIcon(InviteIcon),
			completed: false,
			fact: 'has_invited_student',
			onClick: () => nav.openSettings('members'),
		},
		{
			// The SPA has no email-invite screen; frappe's own User Invitation
			// form sends the invitation when it is saved.
			name: 'invite_learners',
			title: __('Invite learners by email'),
			icon: stepIcon(Mail),
			completed: false,
			fact: 'has_sent_invitation',
			onClick: () => nav.openExternal('/app/user-invitation/new'),
		},
	],
}

const liveClassZoomFlow: OnboardingFlow = {
	id: 'live_class_zoom',
	card: 'live_class',
	key: 'learning_live_class_zoom',
	steps: (nav) => [
		createBatch(nav),
		{
			name: 'connect_zoom',
			title: __('Connect a Zoom account'),
			icon: stepIcon(Video),
			completed: false,
			fact: 'has_zoom_account',
			onClick: () => nav.openSettings('zoom'),
		},
		scheduleLiveClass(nav),
		publishBatch(nav),
	],
}

const liveClassMeetFlow: OnboardingFlow = {
	id: 'live_class_meet',
	card: 'live_class',
	key: 'learning_live_class_meet',
	steps: (nav) => [
		createBatch(nav),
		{
			name: 'setup_google_api',
			title: __('Set up Google API'),
			icon: stepIcon(KeyRound),
			completed: false,
			fact: 'has_google_api',
			onClick: () => nav.openSettings('services'),
		},
		{
			name: 'connect_google_calendar',
			title: __('Connect Google Calendar'),
			icon: stepIcon(CalendarCheck),
			completed: false,
			dependsOn: 'setup_google_api',
			fact: 'has_google_calendar',
			onClick: () => nav.openSettings('google-calendar'),
		},
		{
			name: 'add_meet_account',
			title: __('Add a Google Meet account'),
			icon: stepIcon(Video),
			completed: false,
			dependsOn: 'connect_google_calendar',
			fact: 'has_meet_account',
			onClick: () => nav.openSettings('google-meet'),
		},
		scheduleLiveClass(nav),
		publishBatch(nav),
	],
}

export const FLOWS: readonly OnboardingFlow[] = [
	publishCourseFlow,
	onboardLearnersFlow,
	liveClassZoomFlow,
	liveClassMeetFlow,
]

// Copy is read through getters: `__` is installed on window only after every
// static import has been evaluated, so nothing here may call it at load.
export const CARDS: readonly FlowCard[] = [
	{
		id: 'publish_course',
		get title() {
			return __('Publish my first course')
		},
		get description() {
			return __('Set up your first course and lessons.')
		},
		icon: markRaw(BookOpen),
		next: ['onboard_learners', 'live_class'],
		flows: [publishCourseFlow],
	},
	{
		id: 'onboard_learners',
		get title() {
			return __('Onboard my existing learners')
		},
		get description() {
			return __('Bring your learners into a batch.')
		},
		icon: markRaw(Users),
		next: ['live_class', 'publish_course'],
		flows: [onboardLearnersFlow],
	},
	{
		id: 'live_class',
		get title() {
			return __('Start a live class')
		},
		get description() {
			return __('Create a batch, connect a meeting tool and schedule a class.')
		},
		icon: markRaw(Video),
		question: {
			get label() {
				return __('Meeting tool')
			},
			get title() {
				return __('Which meeting tool do you use?')
			},
			options: [
				{
					value: 'zoom',
					get label() {
						return __('Zoom')
					},
					get description() {
						return __('Host classes from a Zoom account.')
					},
					flow: liveClassZoomFlow,
				},
				{
					value: 'meet',
					get label() {
						return __('Google Meet')
					},
					get description() {
						return __('Set up Google API and Calendar, then a Meet account.')
					},
					flow: liveClassMeetFlow,
				},
			],
		},
		next: ['onboard_learners', 'publish_course'],
		flows: [liveClassZoomFlow, liveClassMeetFlow],
	},
]

export function getCard(id: string | null | undefined): FlowCard | undefined {
	return CARDS.find((card) => card.id === id)
}

export function getFlow(
	id: string | null | undefined
): OnboardingFlow | undefined {
	return FLOWS.find((flow) => flow.id === id)
}

/** The flow a card resolves to: its only flow, or its answer's. */
export function flowForAnswer(
	card: FlowCard,
	answer: string | null | undefined
): OnboardingFlow | null {
	if (!card.question) return card.flows[0]
	return card.question.options.find((o) => o.value === answer)?.flow ?? null
}
