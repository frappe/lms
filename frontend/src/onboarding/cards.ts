import { markRaw } from 'vue'
import {
	BookOpen,
	ClipboardCheck,
	Settings2,
	Users,
	Video,
} from 'lucide-vue-next'
import {
	addAssessmentsFlow,
	basicSetupFlow,
	liveClassMeetFlow,
	liveClassZoomFlow,
	onboardLearnersFlow,
	publishCourseFlow,
} from '@/onboarding/flows'
import type { FlowCard, OnboardingFlow } from '@/onboarding/types'

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
		next: ['add_assessments', 'live_class', 'onboard_learners', 'basic_setup'],
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
		next: ['live_class', 'onboard_learners', 'publish_course', 'basic_setup'],
		flows: [addAssessmentsFlow],
	},
	{
		id: 'live_class',
		get title() {
			return __('Run my first live class')
		},
		get description() {
			return __(
				'Create a batch, add courses and assessments, then schedule a live class.'
			)
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
					flow: liveClassZoomFlow,
				},
				{
					value: 'meet',
					get label() {
						return __('Google Meet')
					},
					flow: liveClassMeetFlow,
				},
			],
		},
		next: [
			'onboard_learners',
			'publish_course',
			'add_assessments',
			'basic_setup',
		],
		flows: [liveClassZoomFlow, liveClassMeetFlow],
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
		next: ['publish_course', 'live_class', 'add_assessments', 'basic_setup'],
		flows: [onboardLearnersFlow],
	},
	{
		id: 'basic_setup',
		get title() {
			return __('Basic setup')
		},
		get description() {
			return __(
				'Set up email, your branding, sign-up, the sidebar and a contact email.'
			)
		},
		icon: markRaw(Settings2),
		next: ['publish_course', 'live_class'],
		flows: [basicSetupFlow],
	},
]

export function getCard(id: string | null | undefined): FlowCard | undefined {
	return CARDS.find((card) => card.id === id)
}

/** The flow a card resolves to: its only flow, its answer's, or the first answer's. */
export function flowForAnswer(
	card: FlowCard,
	answer: string | null | undefined
): OnboardingFlow | null {
	if (!card.question) return card.flows[0]
	const chosen = card.question.options.find((o) => o.value === answer)?.flow
	return chosen ?? card.question.options[0]?.flow ?? null
}
