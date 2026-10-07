import { reactive, ref, shallowReactive, type Ref } from 'vue'
import { useStorage } from '@vueuse/core'
import type { UseOnboarding } from '@framework/ui/components/Onboarding/index'
import { flowForAnswer } from '@/onboarding/cards'
import type {
	CardId,
	FlowCard,
	FlowId,
	FlowStep,
	OnboardingFacts,
	OnboardingFlow,
} from '@/onboarding/types'

export type Screen = 'list' | 'flow' | 'help'

// One set of flows per app load, shared by the sidebar and every form that
// completes a step, like the framework's own per-key onboarding state.
export const facts = reactive<Partial<OnboardingFacts>>({})
export const handles = shallowReactive<Partial<Record<FlowId, UseOnboarding>>>(
	{}
)
export const flowSteps = shallowReactive<Partial<Record<FlowId, FlowStep[]>>>(
	{}
)
export const isSetUp = ref(false)

// Which screen the panel shows, and for which card. Not persisted.
export const requestedScreen = ref<Screen>('list')
export const openCardId = ref<CardId | null>(null)

function sessionUser(): string {
	const cookies = new URLSearchParams(document.cookie.split('; ').join('&'))
	return cookies.get('user_id') ?? ''
}

/** What this admin created from the steps; a chapter is kept with its course. */
interface RecordedTargets {
	course?: string
	chapter?: string
	batch?: string
}

// Per user, like the framework's own flags. The framework stores only
// `completed`, so skipped step names are kept here per flow key.
let stored: {
	activeCard: Ref<string | null>
	answers: Ref<Record<string, string>>
	skipped: Ref<Record<string, string[]>>
	targets: Ref<RecordedTargets>
} | null = null

export function storage() {
	const user = sessionUser()
	stored ??= {
		activeCard: useStorage<string | null>(
			'learningOnboardingCard' + user,
			null
		),
		answers: useStorage<Record<string, string>>(
			'learningOnboardingAnswers' + user,
			{}
		),
		skipped: useStorage<Record<string, string[]>>(
			'learningOnboardingSkipped' + user,
			{}
		),
		targets: useStorage<RecordedTargets>(
			'learningOnboardingTargets' + user,
			{}
		),
	}
	return stored
}

export function answerOf(card: FlowCard): string | null {
	return storage().answers.value[card.id] ?? null
}

export function cardFlow(card: FlowCard): OnboardingFlow | null {
	return flowForAnswer(card, answerOf(card))
}

export function stepsOf(id: FlowId): FlowStep[] {
	return flowSteps[id] ?? []
}

function skippedNames(flow: OnboardingFlow): string[] {
	return storage().skipped.value[flow.key] ?? []
}

export function isSkipped(flow: OnboardingFlow, step: string): boolean {
	return skippedNames(flow).includes(step)
}

function writeSkipped(flow: OnboardingFlow, names: string[]): void {
	storage().skipped.value = { ...storage().skipped.value, [flow.key]: names }
}

export function rememberSkip(flow: OnboardingFlow, step: string): void {
	if (!isSkipped(flow, step)) writeSkipped(flow, [...skippedNames(flow), step])
}

export function forgetSkip(flow: OnboardingFlow, step: string): void {
	writeSkipped(
		flow,
		skippedNames(flow).filter((name) => name !== step)
	)
}

export function forgetSkips(flow: OnboardingFlow): void {
	storage().skipped.value = Object.fromEntries(
		Object.entries(storage().skipped.value).filter(([key]) => key !== flow.key)
	)
}
