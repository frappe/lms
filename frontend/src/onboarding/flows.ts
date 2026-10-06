import { h, markRaw, type Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import type { OnboardingStep } from '@framework/ui/components/Onboarding/index'
import { draftLessonNumber } from '@/utils/courseOutline'
import {
	Banknote,
	BookOpen,
	CalendarCheck,
	CircleHelp,
	ClipboardCheck,
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

export type FlowId =
	| 'publish_course'
	| 'add_assessments'
	| 'live_class'
	| 'live_class_zoom'
	| 'live_class_meet'
	| 'onboard_learners'

/** A list entry. A card with a question holds one flow per answer. */
export type CardId =
	| 'publish_course'
	| 'add_assessments'
	| 'onboard_learners'
	| 'live_class'

export const FACT_KEYS = [
	'has_course',
	'has_chapter',
	'has_lesson',
	'has_quiz',
	'has_programming_exercise',
	'has_assignment',
	'has_assessment_in_lesson',
	'has_course_pricing',
	'has_published_course',
	'has_imported_learners',
	'has_email_account',
	'has_batch',
	'has_batch_details',
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
	/** The first course's first chapter, in outline order. */
	first_chapter: string | null
	first_batch: string | null
}

/** What a step click can do. The sidebar supplies it, bound to the router. */
export interface FlowNavigation {
	/** Read at click time, so targets learnt after set-up are used. */
	facts: Partial<OnboardingFacts>
	openRoute: (to: RouteLocationRaw) => void
	openForm: (to: RouteLocationRaw) => void
	/** A settings page; `record` 'new' opens its create form. */
	openSettings: (slug: string, record?: string) => void
	complete: (step: string) => void
}

export interface FlowStep extends OnboardingStep {
	/** Fact that marks this step done for work finished before onboarding. */
	fact?: FactKey
	/** Short verb on the step's action button, e.g. "Create". */
	actionLabel: string
	/** Completed by answering this card's question, offered on the step itself. */
	chooses?: CardId
	/** Minimise the panel once the step opens its page, which needs the room. */
	minimizeOnOpen?: boolean
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
	/** Each answer has its own flow and key. */
	question?: CardQuestion
	/** Shown until the question is answered; one of its steps asks it. */
	defaultFlow?: OnboardingFlow
	/** Cards to offer once this one is done, best first. */
	next: CardId[]
	flows: OnboardingFlow[]
}

const iconProps = { strokeWidth: 1.5, width: 16, height: 16 }

function stepIcon(icon: Component): Component {
	return markRaw(h(icon, iconProps))
}

// Steps that need the first course or batch open its list until one exists.
function withCourse(nav: FlowNavigation, open: (courseName: string) => void) {
	const courseName = nav.facts.first_course
	if (!courseName) return nav.openRoute({ name: 'Courses' })
	open(courseName)
}

function withBatch(nav: FlowNavigation, open: (batchName: string) => void) {
	const batchName = nav.facts.first_batch
	if (!batchName) return nav.openRoute({ name: 'Batches' })
	open(batchName)
}

function openCourseSettings(nav: FlowNavigation): void {
	withCourse(nav, (courseName) =>
		nav.openRoute({
			name: 'CourseDetail',
			params: { courseName },
			hash: '#settings',
		})
	)
}

function openChapterForm(nav: FlowNavigation): void {
	withCourse(nav, (courseName) =>
		nav.openForm({
			name: 'ChapterForm',
			params: { courseName, chapterName: 'new' },
			hash: '#editor',
		})
	)
}

// The editor's own Add Lesson draft in the first chapter, the URL it writes
// for one: LessonForm opens empty with the caret in the title.
function openNewLesson(nav: FlowNavigation): void {
	withCourse(nav, (courseName) => {
		const chapter = nav.facts.first_chapter
		nav.openRoute({
			name: 'CourseDetail',
			params: { courseName },
			...(chapter && {
				query: { editLesson: draftLessonNumber(1), draftChapter: chapter },
			}),
			hash: '#editor',
		})
	})
}

function openLiveClassForm(nav: FlowNavigation): void {
	withBatch(nav, (batchName) =>
		nav.openForm({
			name: 'NewLiveClass',
			params: { batchName },
			hash: '#classes',
		})
	)
}

function openBatch(nav: FlowNavigation): void {
	withBatch(nav, (batchName) =>
		nav.openRoute({ name: 'BatchDetail', params: { batchName } })
	)
}

function openBatchSettings(nav: FlowNavigation): void {
	withBatch(nav, (batchName) =>
		nav.openRoute({
			name: 'BatchDetail',
			params: { batchName },
			hash: '#settings',
		})
	)
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

const publishCourseFlow: OnboardingFlow = {
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
			onClick: () => openCourseSettings(nav),
		},
		{
			name: 'publish_course',
			actionLabel: __('Publish'),
			title: __('Publish the course'),
			icon: stepIcon(Globe),
			completed: false,
			dependsOn: 'create_first_course',
			fact: 'has_published_course',
			onClick: () => openCourseSettings(nav),
		},
	],
}

// The course editor opens its stored or first lesson, where the author inserts
// the assessment.
function openCourseEditor(nav: FlowNavigation): void {
	withCourse(nav, (courseName) =>
		nav.openRoute({
			name: 'CourseDetail',
			params: { courseName },
			hash: '#editor',
		})
	)
}

const addAssessmentsFlow: OnboardingFlow = {
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

const liveClassFlow: OnboardingFlow = {
	id: 'live_class',
	card: 'live_class',
	key: 'learning_live_class',
	steps: (nav) => liveClassHead(nav),
}

const liveClassZoomFlow: OnboardingFlow = {
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

const liveClassMeetFlow: OnboardingFlow = {
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

const onboardLearnersFlow: OnboardingFlow = {
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
		next: ['add_assessments', 'live_class', 'onboard_learners'],
		flows: [publishCourseFlow],
	},
	{
		id: 'add_assessments',
		get title() {
			return __('Add assessments')
		},
		get description() {
			return __(
				'Create a quiz, a programming exercise and an assignment, then add them to a lesson.'
			)
		},
		icon: markRaw(ClipboardCheck),
		next: ['live_class', 'onboard_learners', 'publish_course'],
		flows: [addAssessmentsFlow],
	},
	{
		id: 'live_class',
		get title() {
			return __('Run my first live class')
		},
		get description() {
			return __('Create a batch, pick a meeting tool and schedule a class.')
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
		defaultFlow: liveClassFlow,
		next: ['onboard_learners', 'publish_course', 'add_assessments'],
		flows: [liveClassFlow, liveClassZoomFlow, liveClassMeetFlow],
	},
	{
		id: 'onboard_learners',
		get title() {
			return __('Onboard existing users')
		},
		get description() {
			return __('Set up email and bring your users in.')
		},
		icon: markRaw(Users),
		next: ['publish_course', 'live_class', 'add_assessments'],
		flows: [onboardLearnersFlow],
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

/** The flow a card resolves to: its only flow, its answer's, or its default. */
export function flowForAnswer(
	card: FlowCard,
	answer: string | null | undefined
): OnboardingFlow | null {
	if (!card.question) return card.flows[0]
	const chosen = card.question.options.find((o) => o.value === answer)?.flow
	return chosen ?? card.defaultFlow ?? null
}
