import { computed, reactive, ref, shallowReactive, watch, type Ref } from 'vue'
import { useStorage } from '@vueuse/core'
import { call, getCachedResource } from 'frappe-ui'
import {
	minimize,
	showHelpModal,
	useOnboarding,
	type UseOnboarding,
} from '@framework/ui/components/Onboarding/index'
import {
	CARDS,
	FLOWS,
	getCard,
	getFlow,
	type CardId,
	type FlowCard,
	type FlowId,
	type FlowNavigation,
	type FlowStep,
	type OnboardingFacts,
	type OnboardingFlow,
} from '@/onboarding/flows'

export type PanelView = 'checklist' | 'picker' | 'done' | 'provider'

type FlowTargets = Partial<
	Pick<OnboardingFacts, 'first_course' | 'first_batch'>
>

// One set of flows per app load, shared by the sidebar and every form that
// completes a step, like the framework's own per-key onboarding state.
const facts = reactive<Partial<OnboardingFacts>>({})
const handles = shallowReactive<Partial<Record<FlowId, UseOnboarding>>>({})
const flowSteps: Partial<Record<FlowId, FlowStep[]>> = {}
const isSetUp = ref(false)
// A card with several flows waiting on a provider choice. Not persisted.
const pendingCard = ref<CardId | null>(null)
let flowNav: FlowNavigation | null = null
let storedFlow: Ref<string | null> | null = null

function sessionUser(): string {
	const cookies = new URLSearchParams(document.cookie.split('; ').join('&'))
	return cookies.get('user_id') ?? ''
}

function flowStorage(): Ref<string | null> {
	storedFlow ??= useStorage<string | null>(
		'learningOnboardingFlow' + sessionUser(),
		null
	)
	return storedFlow
}

const activeFlow = computed<OnboardingFlow | null>(
	() => getFlow(flowStorage().value) ?? null
)

const activeFlowId = computed<FlowId | null>(() => activeFlow.value?.id ?? null)

function isFlowComplete(id: FlowId): boolean {
	const handle = handles[id]
	if (!handle) return false
	const total = handle.totalSteps.value
	return (
		handle.isOnboardingStepsCompleted.value ||
		(total > 0 && handle.stepsCompleted.value === total)
	)
}

function isCardComplete(id: CardId): boolean {
	return Boolean(getCard(id)?.flows.some((flow) => isFlowComplete(flow.id)))
}

/** Unfinished cards other than the active one, in the active flow's order. */
const remainingCards = computed<FlowCard[]>(() => {
	const order = activeFlow.value?.next ?? []
	const rank = (card: FlowCard): number => {
		const index = order.indexOf(card.id)
		return index === -1 ? order.length : index
	}
	return CARDS.filter(
		(card) => card.id !== activeFlow.value?.card && !isCardComplete(card.id)
	).sort((a, b) => rank(a) - rank(b))
})

const providerFlows = computed<OnboardingFlow[]>(
	() => getCard(pendingCard.value)?.flows ?? []
)

const panelView = computed<PanelView>(() => {
	if (pendingCard.value) return 'provider'
	if (!activeFlow.value) return 'picker'
	return isFlowComplete(activeFlow.value.id) ? 'done' : 'checklist'
})

// The banner opens the panel, so with nothing active it borrows the next
// unfinished flow's count. Once all are done it stays on the active flow so the
// framework's "You are all set" card can be dismissed.
const bannerFlow = computed<OnboardingFlow | null>(() => {
	if (!isSetUp.value) return null
	const active = activeFlow.value
	if (active && !isFlowComplete(active.id)) return active
	const [nextCard] = remainingCards.value
	if (nextCard) return nextCard.flows[0]
	if (active && !handles[active.id]?.isOnboardingStepsCompleted.value)
		return active
	return null
})

function flowsOwning(step: string): FlowId[] {
	return FLOWS.filter((flow) =>
		flowSteps[flow.id]?.some((s) => s.name === step)
	).map((flow) => flow.id)
}

/**
 * Tick a step in every flow that has it. A no-op until the sidebar set the
 * flows up, which it only does for System Managers.
 */
function completeStep(step: string, targets: FlowTargets = {}): void {
	for (const key of ['first_course', 'first_batch'] as const) {
		if (targets[key] && !facts[key]) facts[key] = targets[key]
	}
	if (!isSetUp.value) return
	for (const id of flowsOwning(step)) {
		handles[id]?.updateOnboardingStep(step)
	}
}

/** Tick steps whose work already exists. Never un-ticks anything. */
function applyFacts(next: Partial<OnboardingFacts>): void {
	for (const key of ['first_course', 'first_batch'] as const) {
		if (next[key]) facts[key] = next[key]
	}
	for (const flow of FLOWS) {
		for (const step of flowSteps[flow.id] ?? []) {
			if (step.fact && next[step.fact] === true && !step.completed) {
				facts[step.fact] = true
				handles[flow.id]?.updateOnboardingStep(step.name)
			}
		}
	}
}

// Every flow key shares the framework's `onboarding_status` resource, and only
// the first key's onSuccess re-syncs. Wait for it, then sync them all.
function statusSettled(): Promise<void> {
	const status = getCachedResource('onboarding_status')
	if (!status?.loading) return Promise.resolve()
	return new Promise((resolve) => {
		const stop = watch(
			() => status.loading,
			(loading) => {
				if (loading) return
				stop()
				resolve()
			}
		)
	})
}

async function loadFacts(): Promise<void> {
	try {
		const data = await call('lms.lms.onboarding.get_onboarding_facts')
		applyFacts(data as Partial<OnboardingFacts>)
	} catch {
		// Facts only save re-doing old work; the stored progress still stands.
	}
}

const FACTS_REFETCH_DELAY = 500
let refetchTimer: ReturnType<typeof setTimeout> | undefined

// Some steps finish outside the SPA (Google's OAuth round trip) or in a
// settings dialog that never calls completeStep, so look again whenever the
// admin comes back to the window or reopens the panel.
function refetchFacts(): void {
	clearTimeout(refetchTimer)
	refetchTimer = setTimeout(loadFacts, FACTS_REFETCH_DELAY)
}

function watchForReturns(): void {
	window.addEventListener('focus', refetchFacts)
	watch(showHelpModal, (open) => open && refetchFacts())
	watch(minimize, (minimized) => !minimized && refetchFacts())
}

type SidebarNavigation = Omit<FlowNavigation, 'facts' | 'complete'>

/** Register every flow, so a form can complete a step whichever is active. */
async function setUpAll(nav: SidebarNavigation): Promise<void> {
	if (isSetUp.value) return
	const stepNav: FlowNavigation = { ...nav, facts, complete: completeStep }
	for (const flow of FLOWS) {
		const handle = useOnboarding(flow.key)
		if (!handle) return
		const steps = flow.steps(stepNav)
		handle.setUp(steps)
		flowSteps[flow.id] = steps
		handles[flow.id] = handle
	}
	flowNav = stepNav
	isSetUp.value = true
	// Each setUp() opened or closed the panel for its own key; only the active
	// flow's checklist should open on load.
	showHelpModal.value = panelView.value === 'checklist'
	await statusSettled()
	for (const flow of FLOWS) handles[flow.id]?.syncStatus()
	await loadFacts()
	watchForReturns()
}

/** Start a card's flow, or ask which provider first when it has several. */
function chooseCard(id: CardId): void {
	const card = getCard(id)
	if (!card) return
	if (card.flows.length === 1) return setFlow(card.flows[0].id)
	pendingCard.value = id
	minimize.value = false
	showHelpModal.value = true
}

function cancelProvider(): void {
	pendingCard.value = null
}

function setFlow(id: FlowId | null): void {
	pendingCard.value = null
	flowStorage().value = id
	if (!id) return
	minimize.value = false
	showHelpModal.value = true
}

function runDoneAction(): void {
	if (flowNav) activeFlow.value?.doneAction.run(flowNav)
}

function closePanel(): void {
	pendingCard.value = null
	showHelpModal.value = false
}

export function useLearningOnboarding() {
	return {
		facts,
		isSetUp,
		activeFlow,
		activeFlowId,
		remainingCards,
		providerFlows,
		panelView,
		bannerFlow,
		isFlowComplete,
		isCardComplete,
		setUpAll,
		setFlow,
		chooseCard,
		cancelProvider,
		completeStep,
		applyFacts,
		closePanel,
		runDoneAction,
	}
}
