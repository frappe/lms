import { h, markRaw, type Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import type { OnboardingStep } from '@framework/ui/components/Onboarding/index'
import {
	BookOpen,
	BookText,
	Eye,
	FileText,
	FolderTree,
	Globe,
	Image,
	Laptop,
	UserPlus,
	Users,
	Video,
	KeyRound,
	CalendarCheck,
} from 'lucide-vue-next'
import InviteIcon from '@/components/Icons/InviteIcon.vue'

export type FlowId =
	| 'publish_course'
	| 'onboard_learners'
	| 'live_class_zoom'
	| 'live_class_meet'

/** A picker entry. The live class card holds one flow per meeting provider. */
export type CardId = 'publish_course' | 'onboard_learners' | 'live_class'

export const FACT_KEYS = [
	'has_course',
	'has_chapter',
	'has_lesson',
	'has_course_image',
	'has_published_course',
	'has_invited_student',
	'has_batch',
	'has_batch_course',
	'has_batch_student',
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
	complete: (step: string) => void
}

export interface FlowStep extends OnboardingStep {
	/** Fact that marks this step done for work finished before onboarding. */
	fact?: FactKey
}

export interface OnboardingFlow {
	id: FlowId
	/** The picker card this flow belongs to. */
	card: CardId
	/** Set on a card's provider flows: the choice shown before the checklist. */
	provider?: { readonly label: string; readonly description: string }
	/** `useOnboarding` key; progress is stored under `<key>_onboarding_status`. */
	key: string
	readonly title: string
	readonly description: string
	icon: Component
	readonly doneTitle: string
	doneAction: { readonly label: string; run: (nav: FlowNavigation) => void }
	/** Cards to offer once this one is done, best first. */
	next: CardId[]
	/** Order is frozen once shipped: stored progress is matched by index. */
	steps: (nav: FlowNavigation) => FlowStep[]
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
	name: 'NewBatchCourse' | 'NewBatchStudent' | 'NewLiveClass',
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

function createFirstBatch(nav: FlowNavigation): FlowStep {
	return {
		name: 'create_first_batch',
		title: __('Create your first batch'),
		icon: stepIcon(Users),
		completed: false,
		fact: 'has_batch',
		onClick: () => nav.openForm({ name: 'NewBatch' }),
	}
}

const publishCourse: OnboardingFlow = {
	id: 'publish_course',
	card: 'publish_course',
	key: 'learning_publish_course',
	get title() {
		return __('Publish my first course')
	},
	get description() {
		return __('Set up your first course and lessons.')
	},
	icon: markRaw(BookOpen),
	get doneTitle() {
		return __('Course published')
	},
	doneAction: {
		get label() {
			return __('View course')
		},
		run: (nav) => {
			const courseName = nav.facts.first_course
			if (!courseName) return nav.openRoute({ name: 'Courses' })
			nav.openRoute({ name: 'CourseDetail', params: { courseName } })
		},
	},
	next: ['onboard_learners', 'live_class'],
	steps: (nav) => [
		{
			name: 'create_first_course',
			title: __('Create your first course'),
			icon: stepIcon(BookOpen),
			completed: false,
			fact: 'has_course',
			onClick: () => nav.openForm({ name: 'NewCourse' }),
		},
		{
			name: 'create_first_chapter',
			title: __('Add your first chapter'),
			icon: stepIcon(FolderTree),
			completed: false,
			dependsOn: 'create_first_course',
			fact: 'has_chapter',
			onClick: () => openCourse(nav, '#editor'),
		},
		{
			name: 'create_first_lesson',
			title: __('Add your first lesson'),
			icon: stepIcon(FileText),
			completed: false,
			dependsOn: 'create_first_chapter',
			fact: 'has_lesson',
			onClick: () => openCourse(nav, '#editor'),
		},
		{
			name: 'add_course_image',
			title: __('Add a course image'),
			icon: stepIcon(Image),
			completed: false,
			dependsOn: 'create_first_course',
			fact: 'has_course_image',
			onClick: () => openCourse(nav, '#settings'),
		},
		{
			name: 'preview_course',
			title: __('Preview your course'),
			icon: stepIcon(Eye),
			completed: false,
			dependsOn: 'create_first_course',
			onClick: () => {
				nav.complete('preview_course')
				openCourse(nav, '#overview')
			},
		},
		{
			name: 'publish_course',
			title: __('Publish your course'),
			icon: stepIcon(Globe),
			completed: false,
			dependsOn: 'create_first_course',
			fact: 'has_published_course',
			onClick: () => openCourse(nav, '#settings'),
		},
	],
}

const onboardLearners: OnboardingFlow = {
	id: 'onboard_learners',
	card: 'onboard_learners',
	key: 'learning_onboard_learners',
	get title() {
		return __('Onboard my existing learners')
	},
	get description() {
		return __('Bring your learners into a batch.')
	},
	icon: markRaw(Users),
	get doneTitle() {
		return __('Learners onboarded')
	},
	doneAction: {
		get label() {
			return __('View batch')
		},
		run: openBatch,
	},
	next: ['live_class', 'publish_course'],
	steps: (nav) => [
		{
			name: 'invite_students',
			title: __('Invite your team and students'),
			icon: stepIcon(InviteIcon),
			completed: false,
			fact: 'has_invited_student',
			onClick: () => nav.openSettings('members'),
		},
		createFirstBatch(nav),
		{
			name: 'add_batch_course',
			title: __('Add courses to your batch'),
			icon: stepIcon(BookText),
			completed: false,
			dependsOn: 'create_first_batch',
			fact: 'has_batch_course',
			onClick: () => openBatchForm(nav, 'NewBatchCourse', '#settings'),
		},
		{
			name: 'add_batch_student',
			title: __('Add students to your batch'),
			icon: stepIcon(UserPlus),
			completed: false,
			dependsOn: 'create_first_batch',
			fact: 'has_batch_student',
			onClick: () => openBatchForm(nav, 'NewBatchStudent', '#dashboard'),
		},
	],
}

// Zoom and Google Meet need different set-up steps, and stored progress is
// matched to steps by index, so each provider is its own flow and key.
const liveClassCopy = {
	get title() {
		return __('Run my first live class')
	},
	get description() {
		return __('Connect a meeting account and schedule a class.')
	},
	icon: markRaw(Video),
	get doneTitle() {
		return __('Live class scheduled')
	},
	doneAction: {
		get label() {
			return __('View batch')
		},
		run: openBatch,
	},
	next: ['onboard_learners', 'publish_course'] as CardId[],
}

function scheduleAndPublish(nav: FlowNavigation): FlowStep[] {
	return [
		{
			name: 'schedule_live_class',
			title: __('Schedule a live class'),
			icon: stepIcon(Laptop),
			completed: false,
			dependsOn: 'create_first_batch',
			fact: 'has_live_class',
			onClick: () => openBatchForm(nav, 'NewLiveClass', '#classes'),
		},
		{
			name: 'publish_batch',
			title: __('Publish your batch'),
			icon: stepIcon(Globe),
			completed: false,
			dependsOn: 'create_first_batch',
			fact: 'has_published_batch',
			onClick: () => openBatch(nav),
		},
	]
}

// A spread would call the getters at import, before translation.js installs __.
function withLiveClassCopy(
	flow: Omit<OnboardingFlow, keyof typeof liveClassCopy>
) {
	return Object.defineProperties(
		flow,
		Object.getOwnPropertyDescriptors(liveClassCopy)
	) as OnboardingFlow
}

const liveClassZoom = withLiveClassCopy({
	id: 'live_class_zoom',
	card: 'live_class',
	key: 'learning_live_class_zoom',
	provider: {
		get label() {
			return __('Zoom')
		},
		get description() {
			return __('Host classes from a Zoom account.')
		},
	},
	steps: (nav) => [
		createFirstBatch(nav),
		{
			name: 'connect_zoom',
			title: __('Connect a Zoom account'),
			icon: stepIcon(Video),
			completed: false,
			fact: 'has_zoom_account',
			onClick: () => nav.openSettings('zoom'),
		},
		...scheduleAndPublish(nav),
	],
})

const liveClassMeet = withLiveClassCopy({
	id: 'live_class_meet',
	card: 'live_class',
	key: 'learning_live_class_meet',
	provider: {
		get label() {
			return __('Google Meet')
		},
		get description() {
			return __('Set up Google API and Calendar, then a Meet account.')
		},
	},
	steps: (nav) => [
		createFirstBatch(nav),
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
		...scheduleAndPublish(nav),
	],
})

export const FLOWS: readonly OnboardingFlow[] = [
	publishCourse,
	onboardLearners,
	liveClassZoom,
	liveClassMeet,
]

export interface FlowCard {
	id: CardId
	readonly title: string
	readonly description: string
	icon: Component
	/** One flow, or one per provider to choose between. */
	flows: OnboardingFlow[]
}

function card(id: CardId): FlowCard {
	const flows = FLOWS.filter((flow) => flow.card === id)
	const [first] = flows
	return {
		id,
		get title() {
			return first.title
		},
		get description() {
			return first.description
		},
		icon: first.icon,
		flows,
	}
}

export const CARDS: readonly FlowCard[] = [
	card('publish_course'),
	card('onboard_learners'),
	card('live_class'),
]

export function getCard(id: string | null | undefined): FlowCard | undefined {
	return CARDS.find((c) => c.id === id)
}

export function getFlow(
	id: string | null | undefined
): OnboardingFlow | undefined {
	return FLOWS.find((flow) => flow.id === id)
}
