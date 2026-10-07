import type { Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import type { OnboardingStep } from '@framework/ui/components/Onboarding/index'

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
