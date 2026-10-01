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
	flowForAnswer,
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

export type Screen = 'list' | 'question' | 'flow'
export type StepStatus = 'done' | 'skipped' | 'current' | 'upcoming'
export type ListState = 'fresh' | 'progress' | 'done'

export interface Progress {
	resolved: number
	total: number
	skipped: number
}

type FlowTargets = Partial<
	Pick<OnboardingFacts, 'first_course' | 'first_batch'>
>

// One set of flows per app load, shared by the sidebar and every form that
// completes a step, like the framework's own per-key onboarding state.
const facts = reactive<Partial<OnboardingFacts>>({})
const handles = shallowReactive<Partial<Record<FlowId, UseOnboarding>>>({})
const flowSteps = shallowReactive<Partial<Record<FlowId, FlowStep[]>>>({})
const isSetUp = ref(false)

// Which screen the panel shows, and for which card. Not persisted.
const requestedScreen = ref<Screen>('list')
const openCardId = ref<CardId | null>(null)

function sessionUser(): string {
	const cookies = new URLSearchParams(document.cookie.split('; ').join('&'))
	return cookies.get('user_id') ?? ''
}

// Per user, like the framework's own flags: the card last opened, each card's
// answer, and the step names skipped per flow key (the framework stores only
// `completed`, so a skip and a real completion look the same to it).
let stored: {
	activeCard: Ref<string | null>
	answers: Ref<Record<string, string>>
	skipped: Ref<Record<string, string[]>>
} | null = null

function storage() {
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
	}
	return stored
}

const activeCard = computed<FlowCard | null>(
	() => getCard(storage().activeCard.value) ?? null
)

const openCard = computed<FlowCard | null>(
	() => getCard(openCardId.value) ?? null
)

function answerOf(card: FlowCard): string | null {
	return storage().answers.value[card.id] ?? null
}

function cardFlow(card: FlowCard): OnboardingFlow | null {
	return flowForAnswer(card, answerOf(card))
}

/** The flow the flow screen shows. */
const openFlow = computed<OnboardingFlow | null>(() =>
	openCard.value ? cardFlow(openCard.value) : null
)

// What the panel shows. A stored card or answer that no longer resolves (a flow
// renamed or removed later) falls back rather than mounting an empty screen.
const screen = computed<Screen>(() => {
	const card = openCard.value
	if (requestedScreen.value === 'list' || !card) return 'list'
	if (requestedScreen.value === 'flow' && openFlow.value) return 'flow'
	return card.question ? 'question' : 'list'
})

function stepsOf(id: FlowId): FlowStep[] {
	return flowSteps[id] ?? []
}

function skippedSet(flow: OnboardingFlow): string[] {
	return storage().skipped.value[flow.key] ?? []
}

function isSkipped(flow: OnboardingFlow, step: string): boolean {
	return skippedSet(flow).includes(step)
}

function setSkipped(flow: OnboardingFlow, step: string, on: boolean): void {
	const rest = skippedSet(flow).filter((name) => name !== step)
	storage().skipped.value = {
		...storage().skipped.value,
		[flow.key]: on ? [...rest, step] : rest,
	}
}

function isFlowComplete(id: FlowId): boolean {
	const handle = handles[id]
	if (!handle) return false
	const steps = stepsOf(id)
	return (
		handle.isOnboardingStepsCompleted.value ||
		(steps.length > 0 && steps.every((step) => step.completed))
	)
}

function flowProgress(id: FlowId): Progress {
	const flow = getFlow(id)
	const steps = stepsOf(id)
	const done = isFlowComplete(id)
	return {
		resolved: done
			? steps.length
			: steps.filter((step) => step.completed).length,
		total: steps.length,
		skipped: flow
			? steps.filter((step) => step.completed && isSkipped(flow, step.name))
					.length
			: 0,
	}
}

function blocker(id: FlowId, step: FlowStep): FlowStep | undefined {
	if (!step.dependsOn || step.completed) return undefined
	const parent = stepsOf(id).find((s) => s.name === step.dependsOn)
	return parent && !parent.completed ? parent : undefined
}

function stepStatus(id: FlowId, step: FlowStep): StepStatus {
	const flow = getFlow(id)
	if (step.completed)
		return flow && isSkipped(flow, step.name) ? 'skipped' : 'done'
	const current = stepsOf(id).find((s) => !s.completed)
	return current?.name === step.name ? 'current' : 'upcoming'
}

function isCardComplete(card: FlowCard): boolean {
	const flow = cardFlow(card)
	return Boolean(flow && isFlowComplete(flow.id))
}

/** A card's "{resolved}/{total}", or null while its question is unanswered. */
function cardProgress(card: FlowCard): Progress | null {
	const flow = cardFlow(card)
	return flow ? flowProgress(flow.id) : null
}

const completedCards = computed<number>(
	() => CARDS.filter((card) => isCardComplete(card)).length
)

const hasAnyProgress = computed<boolean>(
	() =>
		Object.keys(storage().answers.value).length > 0 ||
		FLOWS.some((flow) => flowProgress(flow.id).resolved > 0)
)

const listState = computed<ListState>(() => {
	if (completedCards.value === CARDS.length) return 'done'
	return hasAnyProgress.value ? 'progress' : 'fresh'
})

/** The first unfinished card in this card's `next` order, then registry order. */
function nextCard(card: FlowCard): FlowCard | null {
	const order = [
		...card.next,
		...CARDS.map((c) => c.id).filter((id) => !card.next.includes(id)),
	]
	for (const id of order) {
		const candidate = getCard(id)
		if (candidate && candidate.id !== card.id && !isCardComplete(candidate))
			return candidate
	}
	return null
}

// The banner opens the panel, so it borrows a count: the active card's flow
// while unfinished, else the next unfinished card's. Once every card is done it
// stays on the active flow so the framework's "You are all set" card shows.
const bannerFlow = computed<OnboardingFlow | null>(() => {
	if (!isSetUp.value) return null
	const active = activeCard.value
	const activeFlow = active ? cardFlow(active) : null
	if (activeFlow && !isFlowComplete(activeFlow.id)) return activeFlow
	const pending = CARDS.find((card) => !isCardComplete(card))
	if (pending) return cardFlow(pending) ?? pending.flows[0]
	if (activeFlow && !handles[activeFlow.id]?.isOnboardingStepsCompleted.value)
		return activeFlow
	return null
})

function flowsOwning(step: string): OnboardingFlow[] {
	return FLOWS.filter((flow) => stepsOf(flow.id).some((s) => s.name === step))
}

// The framework stops writing a key once its completed flag is set, so any
// change after a flow finished has to clear the flag first.
function reopen(flow: OnboardingFlow): UseOnboarding | undefined {
	const handle = handles[flow.id]
	if (handle) handle.isOnboardingStepsCompleted.value = false
	return handle
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
	for (const flow of flowsOwning(step)) {
		setSkipped(flow, step, false)
		handles[flow.id]?.updateOnboardingStep(step)
	}
}

/** Tick steps whose work exists, and un-skip them. Never un-ticks anything. */
function applyFacts(next: Partial<OnboardingFacts>): void {
	for (const key of ['first_course', 'first_batch'] as const) {
		if (next[key]) facts[key] = next[key]
	}
	for (const flow of FLOWS) {
		for (const step of stepsOf(flow.id)) {
			if (!step.fact || next[step.fact] !== true) continue
			facts[step.fact] = true
			if (isSkipped(flow, step.name)) setSkipped(flow, step.name, false)
			if (!step.completed) handles[flow.id]?.updateOnboardingStep(step.name)
		}
	}
}

function toggleStep(id: FlowId, name: string): void {
	const flow = getFlow(id)
	const step = stepsOf(id).find((s) => s.name === name)
	if (!flow || !step || blocker(id, step)) return
	if (!step.completed) return handles[id]?.updateOnboardingStep(name, true)
	if (isSkipped(flow, name)) return setSkipped(flow, name, false)
	undoStep(id, name)
}

function skipStep(id: FlowId, name: string): void {
	const flow = getFlow(id)
	if (!flow) return
	setSkipped(flow, name, true)
	handles[id]?.skip(name)
}

function undoStep(id: FlowId, name: string): void {
	const flow = getFlow(id)
	if (!flow) return
	setSkipped(flow, name, false)
	reopen(flow)?.reset(name)
}

/** Run a step's own navigation. It does not mark the step done. */
function startStep(id: FlowId, name: string): void {
	const step = stepsOf(id).find((s) => s.name === name)
	if (!step || step.completed || blocker(id, step)) return
	step.onClick?.()
}

function skipRemaining(id: FlowId): void {
	const flow = getFlow(id)
	if (!flow) return
	for (const step of stepsOf(id)) {
		if (!step.completed) setSkipped(flow, step.name, true)
	}
	handles[id]?.skipAll()
}

/** Clear one flow's progress and skips. The card's answer stays. */
function resetFlow(id: FlowId): void {
	const flow = getFlow(id)
	if (!flow) return
	reopen(flow)?.resetAll()
	storage().skipped.value = Object.fromEntries(
		Object.entries(storage().skipped.value).filter(([key]) => key !== flow.key)
	)
}

/** Start onboarding over: every key, every answer, every skip. */
function resetEverything(): void {
	for (const flow of FLOWS) reopen(flow)?.resetAll()
	storage().answers.value = {}
	storage().skipped.value = {}
	storage().activeCard.value = null
	openCardId.value = null
	requestedScreen.value = 'list'
}

function showPanel(): void {
	minimize.value = false
	showHelpModal.value = true
}

/** Open a card: its question first if unanswered, else its checklist. */
function openCardScreen(id: CardId): void {
	const card = getCard(id)
	if (!card) return
	storage().activeCard.value = id
	openCardId.value = id
	requestedScreen.value = cardFlow(card) ? 'flow' : 'question'
	showPanel()
}

function answer(id: CardId, value: string): void {
	const card = getCard(id)
	if (!card?.question?.options.some((o) => o.value === value)) return
	storage().answers.value = { ...storage().answers.value, [id]: value }
	storage().activeCard.value = id
	openCardId.value = id
	requestedScreen.value = 'flow'
}

function showList(): void {
	requestedScreen.value = 'list'
}

function closePanel(): void {
	showHelpModal.value = false
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

// Some steps finish outside the SPA (Google's OAuth round trip, the data
// import) or in a settings dialog that never calls completeStep, so look again
// whenever the admin comes back to the window or reopens the panel.
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

/** Register every flow, so a form can complete a step whichever is open. */
async function setUpAll(nav: SidebarNavigation): Promise<void> {
	if (isSetUp.value) return
	const stepNav: FlowNavigation = { ...nav, facts, complete: completeStep }
	for (const flow of FLOWS) {
		const handle = useOnboarding(flow.key)
		if (!handle) return
		const steps = flow.steps(stepNav)
		handle.setUp(steps)
		// setUp stores the array in the framework's reactive registry; reactive()
		// returns that same proxy, so reads here track its `completed` writes.
		flowSteps[flow.id] = reactive(steps) as FlowStep[]
		handles[flow.id] = handle
	}
	isSetUp.value = true
	// Each setUp() opened or closed the panel for its own key. Open it only to
	// carry on with an unfinished card.
	const active = activeCard.value
	const resume = Boolean(active && !isCardComplete(active))
	if (active && resume) {
		openCardId.value = active.id
		requestedScreen.value = cardFlow(active) ? 'flow' : 'question'
	}
	showHelpModal.value = resume
	await statusSettled()
	for (const flow of FLOWS) handles[flow.id]?.syncStatus()
	await loadFacts()
	watchForReturns()
}

export function useLearningOnboarding() {
	return {
		facts,
		isSetUp,
		screen,
		activeCard,
		openCard,
		openFlow,
		listState,
		completedCards,
		hasAnyProgress,
		bannerFlow,
		answerOf,
		cardFlow,
		stepsOf,
		stepStatus,
		blocker,
		flowProgress,
		cardProgress,
		isFlowComplete,
		isCardComplete,
		nextCard,
		setUpAll,
		openCardScreen,
		answer,
		showList,
		closePanel,
		completeStep,
		applyFacts,
		toggleStep,
		skipStep,
		undoStep,
		startStep,
		skipRemaining,
		resetFlow,
		resetEverything,
	}
}
