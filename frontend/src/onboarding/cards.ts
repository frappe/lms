import { markRaw } from 'vue'
import { BookOpen, ClipboardCheck, Users, Video } from 'lucide-vue-next'
import {
	addAssessmentsFlow,
	liveClassFlow,
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

/** The flow a card resolves to: its only flow, its answer's, or its default. */
export function flowForAnswer(
	card: FlowCard,
	answer: string | null | undefined
): OnboardingFlow | null {
	if (!card.question) return card.flows[0]
	const chosen = card.question.options.find((o) => o.value === answer)?.flow
	return chosen ?? card.defaultFlow ?? null
}
