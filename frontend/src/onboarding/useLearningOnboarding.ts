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

export type Screen = 'list' | 'flow' | 'help'
export type StepStatus = 'done' | 'skipped' | 'current' | 'upcoming'

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
// Where the help centre returns to.
let screenBeforeHelp: Screen = 'list'
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

// What the panel shows. A stored card that no longer resolves (a flow renamed
// or removed later) falls back to the list rather than an empty screen.
const screen = computed<Screen>(() => {
	if (requestedScreen.value === 'help') return 'help'
	if (requestedScreen.value === 'flow' && openFlow.value) return 'flow'
	return 'list'
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

/** The step to do next: the first one neither resolved nor blocked. */
function nextStep(id: FlowId): FlowStep | null {
	return (
		stepsOf(id).find((step) => !step.completed && !blocker(id, step)) ?? null
	)
}

// Un-minimising on a tick is ours, not the admin reopening the panel, so it
// must not trigger another facts fetch through the minimise watcher.
let selfUnminimised = false
let watchingReturns = false

function showProgress(): void {
	if (!minimize.value) return
	selfUnminimised = watchingReturns
	minimize.value = false
}

function stepStatus(id: FlowId, step: FlowStep): StepStatus {
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
function isCardComplete(card: FlowCard): boolean {
	const flow = cardFlow(card)
	if (flow && flow !== card.defaultFlow) return isFlowComplete(flow.id)
	return answerFlows(card).some((f) => isFlowComplete(f.id))
}

/** The flow a card's counts come from, answered or not. */
function countedFlow(card: FlowCard): OnboardingFlow {
	const flow = cardFlow(card)
	if (flow && flow !== card.defaultFlow) return flow
	return (
		answerFlows(card).find((f) => isFlowComplete(f.id)) ?? flow ?? card.flows[0]
	)
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

/** Resolved steps over all steps, across each card's counted flow. */
const overallPercent = computed<number>(() => {
	let resolved = 0
	let total = 0
	for (const card of CARDS) {
		const progress = flowProgress(countedFlow(card).id)
		resolved += progress.resolved
		total += progress.total
	}
	return total ? Math.floor((resolved / total) * 100) : 0
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

const bannerFlow = computed<OnboardingFlow | null>(() => {
	if (!isSetUp.value) return null
	const active = activeCard.value
	const activeFlow = active ? cardFlow(active) : null
	// With an active flow the banner shows that flow, so it never disagrees
	// with the panel. It hides once that flow is done and its flag is set.
	if (activeFlow)
		return handles[activeFlow.id]?.isOnboardingStepsCompleted.value
			? null
			: activeFlow
	const pending = CARDS.find((card) => !isCardComplete(card))
	return pending ? countedFlow(pending) : null
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
	const owners = flowsOwning(step)
	for (const flow of owners) {
		setSkipped(flow, step, false)
		handles[flow.id]?.updateOnboardingStep(step)
	}
	// Bring the panel back so the admin sees the tick and what is next.
	if (owners.length) showProgress()
}

/** Tick steps whose work exists, and un-skip them. Never un-ticks anything. */
function applyFacts(next: Partial<OnboardingFacts>): void {
	let ticked = false
	for (const key of ['first_course', 'first_batch'] as const) {
		if (next[key]) facts[key] = next[key]
	}
	for (const flow of FLOWS) {
		for (const step of stepsOf(flow.id)) {
			if (!step.fact || next[step.fact] !== true) continue
			facts[step.fact] = true
			if (isSkipped(flow, step.name)) setSkipped(flow, step.name, false)
			if (step.completed) continue
			handles[flow.id]?.updateOnboardingStep(step.name)
			ticked = true
		}
	}
	if (ticked) showProgress()
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

/** Skip every unfinished flow, whichever answer it belongs to. */
function skipEverything(): void {
	for (const flow of FLOWS) {
		if (!isFlowComplete(flow.id)) skipRemaining(flow.id)
	}
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

/** Open a card's checklist; an unanswered live class opens its pre-choice one. */
function openCardScreen(id: CardId): void {
	const card = getCard(id)
	if (!card) return
	storage().activeCard.value = id
	openCardId.value = id
	requestedScreen.value = 'flow'
	showPanel()
}

/**
 * Pick a card's answer: its flow becomes the open one, steps already resolved
 * in the flow it replaces carry over by name, and the step that asks the
 * question is ticked.
 */
function answer(id: CardId, value: string): void {
	const card = getCard(id)
	const option = card?.question?.options.find((o) => o.value === value)
	if (!card || !option) return
	const before = cardFlow(card)
	storage().answers.value = { ...storage().answers.value, [id]: value }
	storage().activeCard.value = id
	openCardId.value = id
	requestedScreen.value = 'flow'
	if (before && before.id !== option.flow.id) carryOver(before, option.flow)
	const chooser = stepsOf(option.flow.id).find((step) => step.chooses === id)
	if (chooser) completeStep(chooser.name)
}

function carryOver(from: OnboardingFlow, to: OnboardingFlow): void {
	for (const step of stepsOf(from.id)) {
		if (!step.completed) continue
		const target = stepsOf(to.id).find((s) => s.name === step.name)
		if (!target || target.completed) continue
		if (isSkipped(from, step.name)) skipStep(to.id, step.name)
		else handles[to.id]?.updateOnboardingStep(step.name)
	}
}

/** The help centre, as the framework's HelpModal shows it in place of steps. */
function showHelp(): void {
	if (requestedScreen.value !== 'help') screenBeforeHelp = requestedScreen.value
	requestedScreen.value = 'help'
}

function hideHelp(): void {
	requestedScreen.value = screenBeforeHelp
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
	watchingReturns = true
	window.addEventListener('focus', refetchFacts)
	watch(showHelpModal, (open) => open && refetchFacts())
	watch(minimize, (minimized) => {
		if (minimized) return
		if (selfUnminimised) {
			selfUnminimised = false
			return
		}
		refetchFacts()
	})
}

// syncStatus returns early for a key whose completed flag is already set, so
// on a reload its steps keep completed: false while the flag says done. Make
// the steps agree, so the rows, counts, blocking and the banner read one state.
function settleCompletedKey(flow: OnboardingFlow): void {
	if (!handles[flow.id]?.isOnboardingStepsCompleted.value) return
	for (const step of stepsOf(flow.id)) step.completed = true
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
		requestedScreen.value = 'flow'
	}
	showHelpModal.value = resume
	await statusSettled()
	for (const flow of FLOWS) {
		handles[flow.id]?.syncStatus()
		settleCompletedKey(flow)
	}
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
		overallPercent,
		completedCards,
		hasAnyProgress,
		bannerFlow,
		answerOf,
		cardFlow,
		stepsOf,
		stepStatus,
		nextStep,
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
		showHelp,
		hideHelp,
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
		skipEverything,
	}
}
