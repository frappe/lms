import { computed } from 'vue'
import { FLOWS, getFlow } from '@/onboarding/flows'
import { CARDS, getCard } from '@/onboarding/cards'
import type {
	FlowCard,
	FlowId,
	FlowStep,
	OnboardingFlow,
} from '@/onboarding/types'
import {
	cardFlow,
	handles,
	isSetUp,
	isSkipped,
	openCardId,
	requestedScreen,
	stepsOf,
	storage,
	type Screen,
} from '@/onboarding/onboardingState'

type StepStatus = 'done' | 'skipped' | 'current' | 'upcoming'

interface Progress {
	resolved: number
	total: number
	skipped: number
}

export const activeCard = computed<FlowCard | null>(
	() => getCard(storage().activeCard.value) ?? null
)

export const openCard = computed<FlowCard | null>(
	() => getCard(openCardId.value) ?? null
)

export const openFlow = computed<OnboardingFlow | null>(() =>
	openCard.value ? cardFlow(openCard.value) : null
)

// A stored card that no longer resolves (a flow renamed or removed later)
// falls back to the list rather than an empty screen.
export const screen = computed<Screen>(() => {
	if (requestedScreen.value === 'help') return 'help'
	if (requestedScreen.value === 'flow' && openFlow.value) return 'flow'
	return 'list'
})

export function isFlowComplete(id: FlowId): boolean {
	if (!handles[id]) return false
	const steps = stepsOf(id)
	return steps.length > 0 && steps.every((step) => step.completed)
}

export function flowProgress(id: FlowId): Progress {
	const flow = getFlow(id)
	const steps = stepsOf(id)
	const completed = steps.filter((step) => step.completed)
	const skipped = flow
		? completed.filter((step) => isSkipped(flow, step.name))
		: []
	return {
		resolved: isFlowComplete(id) ? steps.length : completed.length,
		total: steps.length,
		skipped: skipped.length,
	}
}

export function percentOf(progress: Progress): number {
	if (!progress.total) return 0
	return Math.floor((progress.resolved / progress.total) * 100)
}

export function blocker(id: FlowId, step: FlowStep): FlowStep | undefined {
	if (!step.dependsOn || step.completed) return undefined
	const parent = stepsOf(id).find((s) => s.name === step.dependsOn)
	return parent && !parent.completed ? parent : undefined
}

/** The step to do next: the first one neither resolved nor blocked. */
export function nextStep(id: FlowId): FlowStep | null {
	return (
		stepsOf(id).find((step) => !step.completed && !blocker(id, step)) ?? null
	)
}

export function stepStatus(id: FlowId, step: FlowStep): StepStatus {
	const flow = getFlow(id)
	if (step.completed)
		return flow && isSkipped(flow, step.name) ? 'skipped' : 'done'
	const current = stepsOf(id).find((s) => !s.completed)
	return current?.name === step.name ? 'current' : 'upcoming'
}

// A card's pre-choice flow only leads to the choice; finishing it never
// finishes the card. These are the flows that can.
function answerFlows(card: FlowCard): OnboardingFlow[] {
	return card.flows.filter((f) => f !== card.defaultFlow)
}

/** Done when its answered flow is done, or, unanswered, when any answer's is. */
export function isCardComplete(card: FlowCard): boolean {
	const flow = cardFlow(card)
	if (flow && flow !== card.defaultFlow) return isFlowComplete(flow.id)
	return answerFlows(card).some((f) => isFlowComplete(f.id))
}

/** The flow a card's counts come from, answered or not. */
function countedFlow(card: FlowCard): OnboardingFlow {
	const flow = cardFlow(card)
	if (flow && flow !== card.defaultFlow) return flow
	const finished = answerFlows(card).find((f) => isFlowComplete(f.id))
	return finished ?? flow ?? card.flows[0]
}

/** A card's "{resolved}/{total}", or null while its question is unanswered. */
export function cardProgress(card: FlowCard): Progress | null {
	const flow = cardFlow(card)
	return flow ? flowProgress(flow.id) : null
}

export const completedCards = computed<number>(
	() => CARDS.filter((card) => isCardComplete(card)).length
)

export const hasAnyProgress = computed<boolean>(
	() =>
		Object.keys(storage().answers.value).length > 0 ||
		FLOWS.some((flow) => flowProgress(flow.id).resolved > 0)
)

/** Resolved steps over all steps, across each card's counted flow. */
export const overallPercent = computed<number>(() => {
	const total: Progress = { resolved: 0, total: 0, skipped: 0 }
	for (const card of CARDS) {
		const progress = flowProgress(countedFlow(card).id)
		total.resolved += progress.resolved
		total.total += progress.total
	}
	return percentOf(total)
})

/** The first unfinished card in this card's `next` order, then registry order. */
export function nextCard(card: FlowCard): FlowCard | null {
	const rest = CARDS.map((c) => c.id).filter((id) => !card.next.includes(id))
	for (const id of [...card.next, ...rest]) {
		const candidate = getCard(id)
		if (candidate && candidate.id !== card.id && !isCardComplete(candidate))
			return candidate
	}
	return null
}

// With an active flow the banner shows that flow, so it never disagrees with
// the panel. It hides once that flow is done and its flag is set.
export const bannerFlow = computed<OnboardingFlow | null>(() => {
	if (!isSetUp.value) return null
	const activeFlow = activeCard.value ? cardFlow(activeCard.value) : null
	if (activeFlow) {
		const dismissed = handles[activeFlow.id]?.isOnboardingStepsCompleted.value
		return dismissed ? null : activeFlow
	}
	const pending = CARDS.find((card) => !isCardComplete(card))
	return pending ? countedFlow(pending) : null
})
