import { reactive, watch } from 'vue'
import { call, getCachedResource } from 'frappe-ui'
import { useTelemetry } from '@framework/ui/telemetry/index'
import {
	minimize,
	showHelpModal,
	useOnboarding,
	type UseOnboarding,
} from '@framework/ui/components/Onboarding/index'
import {
	FLOWS,
	getCard,
	getFlow,
	type CardId,
	type FlowId,
	type FlowNavigation,
	type FlowStep,
	type OnboardingFacts,
	type OnboardingFlow,
} from '@/onboarding/flows'
import {
	answerOf,
	cardFlow,
	facts,
	flowSteps,
	forgetSkip,
	forgetSkips,
	handles,
	isSetUp,
	isSkipped,
	openCardId,
	rememberSkip,
	requestedScreen,
	stepsOf,
	storage,
	type Screen,
} from '@/onboarding/onboardingState'
import {
	activeCard,
	bannerFlow,
	blocker,
	cardProgress,
	completedCards,
	flowProgress,
	hasAnyProgress,
	isCardComplete,
	isFlowComplete,
	nextCard,
	nextStep,
	openCard,
	openFlow,
	overallPercent,
	screen,
	stepStatus,
} from '@/onboarding/onboardingProgress'

type FlowTargets = Partial<
	Pick<OnboardingFacts, 'first_course' | 'first_chapter' | 'first_batch'>
>

const TARGET_KEYS = ['first_course', 'first_chapter', 'first_batch'] as const

// What a step opens. The course is the one the facts were read for: the
// course this admin created from the flow, which the facts call sends, else
// the site's newest. A chapter only ever goes with its own course.
const stepTargets: FlowTargets = {
	get first_course() {
		return facts.first_course || storage().targets.value.course
	},
	get first_chapter() {
		const { course, chapter } = storage().targets.value
		const current = stepTargets.first_course
		if (chapter && course === current) return chapter
		return facts.first_course === current ? facts.first_chapter : null
	},
	get first_batch() {
		return storage().targets.value.batch || facts.first_batch
	},
}

// A new course is the flow's course from now on: aim the steps at it at once,
// then read its facts.
function recordTargets(created: FlowTargets): void {
	const targets = storage().targets
	if (created.first_course) {
		targets.value = {
			...targets.value,
			course: created.first_course,
			chapter: created.first_chapter || undefined,
		}
		if (created.first_course !== facts.first_course) {
			facts.first_course = created.first_course
			facts.first_chapter = null
			refetchFacts()
		}
	}
	if (created.first_batch)
		targets.value = { ...targets.value, batch: created.first_batch }
}

const FACTS_REFETCH_DELAY = 500

// Where the help centre returns to.
let screenBeforeHelp: Screen = 'list'
// Un-minimising on a tick is ours, not the admin reopening the panel, so it
// must not trigger another facts fetch through the minimise watcher.
let selfUnminimised = false
let watchingReturns = false
let refetchTimer: ReturnType<typeof setTimeout> | undefined

function capture(event: string): void {
	useTelemetry().capture(event)
}

function showProgress(): void {
	if (!minimize.value) return
	selfUnminimised = watchingReturns
	minimize.value = false
}

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

/** Tick a step in every flow that has it. A no-op until the sidebar set up the flows. */
function completeStep(step: string, created: FlowTargets = {}): void {
	if (!isSetUp.value) return
	recordTargets(created)
	const owners = flowsOwning(step)
	for (const flow of owners) {
		forgetSkip(flow, step)
		handles[flow.id]?.updateOnboardingStep(step)
	}
	if (owners.length) showProgress()
}

function tickFromFacts(
	flow: OnboardingFlow,
	next: Partial<OnboardingFacts>
): boolean {
	let ticked = false
	for (const step of stepsOf(flow.id)) {
		if (!step.fact || next[step.fact] !== true) continue
		facts[step.fact] = true
		if (isSkipped(flow, step.name)) forgetSkip(flow, step.name)
		if (step.completed) continue
		handles[flow.id]?.updateOnboardingStep(step.name)
		ticked = true
	}
	return ticked
}

/** Tick steps whose work exists, and un-skip them. Never un-ticks anything. */
function applyFacts(next: Partial<OnboardingFacts>): void {
	for (const key of TARGET_KEYS) {
		if (key in next) facts[key] = next[key]
	}
	let ticked = false
	for (const flow of FLOWS) {
		if (tickFromFacts(flow, next)) ticked = true
	}
	if (ticked) showProgress()
}

function toggleStep(id: FlowId, name: string): void {
	const flow = getFlow(id)
	const step = stepsOf(id).find((s) => s.name === name)
	if (!flow || !step || blocker(id, step)) return
	if (!step.completed) return handles[id]?.updateOnboardingStep(name, true)
	if (isSkipped(flow, name)) return forgetSkip(flow, name)
	undoStep(id, name)
}

function markSkipped(id: FlowId, name: string): void {
	const flow = getFlow(id)
	if (!flow) return
	rememberSkip(flow, name)
	handles[id]?.skip(name)
}

function skipStep(id: FlowId, name: string): void {
	markSkipped(id, name)
	capture('onboarding_step_skipped_' + name)
}

function undoStep(id: FlowId, name: string): void {
	const flow = getFlow(id)
	if (!flow) return
	forgetSkip(flow, name)
	reopen(flow)?.reset(name)
	capture('onboarding_step_reset_' + name)
}

/** Run a step's own navigation. It does not mark the step done. */
function startStep(id: FlowId, name: string): void {
	const step = stepsOf(id).find((s) => s.name === name)
	if (!step || step.completed || blocker(id, step)) return
	step.onClick?.()
	if (step.minimizeOnOpen) minimize.value = true
}

function skipOpenSteps(id: FlowId): void {
	const flow = getFlow(id)
	if (!flow) return
	for (const step of stepsOf(id)) {
		if (!step.completed) rememberSkip(flow, step.name)
	}
	handles[id]?.skipAll()
}

function skipRemaining(id: FlowId): void {
	skipOpenSteps(id)
	capture('onboarding_steps_skipped')
}

/** Skip every unfinished flow, whichever answer it belongs to. */
function skipEverything(): void {
	for (const flow of FLOWS) {
		if (!isFlowComplete(flow.id)) skipOpenSteps(flow.id)
	}
	capture('onboarding_steps_skipped')
}

/** Clear one flow's progress and skips. The card's answer stays. */
function resetFlow(id: FlowId): void {
	const flow = getFlow(id)
	if (!flow) return
	reopen(flow)?.resetAll()
	forgetSkips(flow)
	capture('onboarding_steps_reset')
}

/** Start onboarding over: every key, answer, skip and recorded target. */
function resetEverything(): void {
	for (const flow of FLOWS) reopen(flow)?.resetAll()
	capture('onboarding_steps_reset')
	storage().answers.value = {}
	storage().skipped.value = {}
	storage().targets.value = {}
	storage().activeCard.value = null
	openCardId.value = null
	requestedScreen.value = 'list'
}

function focusCard(id: CardId): void {
	storage().activeCard.value = id
	openCardId.value = id
	requestedScreen.value = 'flow'
}

/** Open a card's checklist; an unanswered live class opens its pre-choice one. */
function openCardScreen(id: CardId): void {
	if (!getCard(id)) return
	focusCard(id)
	minimize.value = false
	showHelpModal.value = true
}

// Pick a card's answer: its flow opens, steps resolved in the flow it replaces
// carry over by name, and the asking step is ticked.
function answer(id: CardId, value: string): void {
	const card = getCard(id)
	const option = card?.question?.options.find((o) => o.value === value)
	if (!card || !option) return
	const before = cardFlow(card)
	storage().answers.value = { ...storage().answers.value, [id]: value }
	focusCard(id)
	if (before && before.id !== option.flow.id) carryOver(before, option.flow)
	const chooser = stepsOf(option.flow.id).find((step) => step.chooses === id)
	if (chooser) completeStep(chooser.name)
}

function carryOver(from: OnboardingFlow, to: OnboardingFlow): void {
	for (const step of stepsOf(from.id)) {
		if (!step.completed) continue
		const target = stepsOf(to.id).find((s) => s.name === step.name)
		if (!target || target.completed) continue
		if (isSkipped(from, step.name)) markSkipped(to.id, step.name)
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
		const data = await call('lms.lms.onboarding.get_onboarding_facts', {
			course: storage().targets.value.course ?? null,
		})
		applyFacts(data as Partial<OnboardingFacts>)
	} catch {
		// Facts only save re-doing old work; the stored progress still stands.
	}
}

function refetchFacts(): void {
	if (!isSetUp.value) return
	clearTimeout(refetchTimer)
	refetchTimer = setTimeout(loadFacts, FACTS_REFETCH_DELAY)
}

function refetchUnlessSelfUnminimised(minimized: boolean): void {
	if (minimized) return
	if (selfUnminimised) {
		selfUnminimised = false
		return
	}
	refetchFacts()
}

// Some steps finish outside the SPA (Google's OAuth round trip, the data
// import) or in a settings dialog that never calls completeStep, so look again
// whenever the admin comes back to the window or reopens the panel.
function watchForReturns(): void {
	watchingReturns = true
	window.addEventListener('focus', refetchFacts)
	watch(showHelpModal, (open) => {
		if (open) refetchFacts()
	})
	watch(minimize, refetchUnlessSelfUnminimised)
}

// syncStatus returns early for a key whose completed flag is already set, so
// on a reload its steps keep completed: false while the flag says done.
function settleCompletedKey(flow: OnboardingFlow): void {
	if (!handles[flow.id]?.isOnboardingStepsCompleted.value) return
	for (const step of stepsOf(flow.id)) step.completed = true
}

function syncAllKeys(): void {
	for (const flow of FLOWS) handles[flow.id]?.syncStatus()
}

type SidebarNavigation = Omit<FlowNavigation, 'facts' | 'complete'>

function registerFlows(nav: SidebarNavigation): boolean {
	const stepNav: FlowNavigation = {
		...nav,
		facts: stepTargets,
		complete: completeStep,
	}
	for (const flow of FLOWS) {
		const handle = useOnboarding(flow.key)
		if (!handle) return false
		const steps = flow.steps(stepNav)
		handle.setUp(steps)
		// setUp keeps this array in the framework's reactive registry; reactive()
		// returns that same proxy, so reads here track its `completed` writes.
		flowSteps[flow.id] = reactive(steps) as FlowStep[]
		handles[flow.id] = handle
		settleCompletedKey(flow)
	}
	return true
}

// Each setUp() opened or closed the panel for its own key. Open it only to
// carry on with an unfinished card.
function resumeActiveCard(): void {
	const active = activeCard.value
	showHelpModal.value = Boolean(active && !isCardComplete(active))
	if (!active || !showHelpModal.value) return
	openCardId.value = active.id
	requestedScreen.value = 'flow'
}

/** Register every flow, so a form can complete a step whichever is open. */
async function setUpAll(nav: SidebarNavigation): Promise<void> {
	if (isSetUp.value || !registerFlows(nav)) return
	isSetUp.value = true
	resumeActiveCard()
	await statusSettled()
	syncAllKeys()
	await loadFacts()
	watchForReturns()
}

export function useLearningOnboarding() {
	return {
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
		refetchFacts,
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
