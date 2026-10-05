// useLearningOnboarding drives five framework keys at once. useOnboarding is an
// in-memory model, so each test sees which keys were updated or left alone.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, ref, type Ref } from 'vue'

type FakeStep = { name: string; completed: boolean; onClick?: () => void }
type FakeHandle = {
	steps: FakeStep[]
	updateOnboardingStep: ReturnType<typeof vi.fn>
	skip: ReturnType<typeof vi.fn>
	reset: ReturnType<typeof vi.fn>
	skipAll: ReturnType<typeof vi.fn>
	resetAll: ReturnType<typeof vi.fn>
	syncStatus: ReturnType<typeof vi.fn>
	setUp: ReturnType<typeof vi.fn>
	isOnboardingStepsCompleted: Ref<boolean>
}

const { framework, callMock, captureMock, statusResource } = vi.hoisted(() => ({
	framework: {
		handles: {} as Record<string, FakeHandle>,
		guest: false,
		// Keys whose stored completed flag is already set when the page loads.
		completed: new Set<string>(),
	},
	callMock: vi.fn(),
	captureMock: vi.fn(),
	statusResource: { current: null as { loading: boolean } | null },
}))

vi.mock('frappe-ui', () => ({
	call: callMock,
	getCachedResource: () => statusResource.current,
}))

vi.mock('@framework/ui/telemetry/index', () => ({
	useTelemetry: () => ({ capture: captureMock }),
}))

vi.mock('@framework/ui/components/Onboarding/index', async () => {
	const { ref: vueRef } = await import('vue')
	return {
		showHelpModal: vueRef(false),
		minimize: vueRef(true),
		useOnboarding: (key: string) => {
			if (framework.guest) return undefined
			framework.handles[key] ??= makeHandle(framework.completed.has(key))
			return framework.handles[key]
		},
	}
})

function makeHandle(storedComplete = false): FakeHandle {
	const state = reactive({ steps: [] as FakeStep[] })
	const mark = (name: string, value: boolean) => {
		const step = state.steps.find((s) => s.name === name)
		if (step) step.completed = value
	}
	return {
		get steps() {
			return state.steps
		},
		isOnboardingStepsCompleted: ref(storedComplete),
		setUp: vi.fn((steps: FakeStep[]) => {
			if (!state.steps.length) state.steps = steps
		}),
		syncStatus: vi.fn(),
		updateOnboardingStep: vi.fn((name: string, value = true) =>
			mark(name, value)
		),
		skip: vi.fn((name: string) => mark(name, true)),
		reset: vi.fn((name: string) => mark(name, false)),
		skipAll: vi.fn(() => {
			for (const step of state.steps) step.completed = true
		}),
		resetAll: vi.fn(() => {
			for (const step of state.steps) step.completed = false
		}),
	}
}

const USER = 'admin@example.com'
const ALL = [
	'publish_course',
	'live_class',
	'live_class_zoom',
	'live_class_meet',
	'onboard_learners',
]
const nav = {
	openRoute: vi.fn(),
	openForm: vi.fn(),
	openSettings: vi.fn(),
	openExternal: vi.fn(),
}

type Loaded = Awaited<ReturnType<typeof load>>

async function load(
	stored: { card?: string; answers?: Record<string, string> } = {}
) {
	if (stored.card)
		localStorage.setItem('learningOnboardingCard' + USER, stored.card)
	if (stored.answers)
		localStorage.setItem(
			'learningOnboardingAnswers' + USER,
			JSON.stringify(stored.answers)
		)
	const mod = await import('@/onboarding/useLearningOnboarding')
	const flows = await import('@/onboarding/flows')
	const ui = await import('@framework/ui/components/Onboarding/index')
	return { ...mod.useLearningOnboarding(), ui, flows }
}

async function ready(stored?: Parameters<typeof load>[0]): Promise<Loaded> {
	const o = await load(stored)
	await o.setUpAll(nav)
	return o
}

function handle(key: string): FakeHandle {
	return framework.handles['learning_' + key]
}

function finish(key: string): void {
	for (const step of handle(key).steps) step.completed = true
}

const card = (o: Loaded, id: string) => o.flows.getCard(id)!

// vi.resetModules gives each test a fresh composable, but the focus listener
// an earlier copy added to window outlives it. Drop them between tests.
const focusListeners: EventListenerOrEventListenerObject[] = []
const addListener = window.addEventListener.bind(window)
vi.spyOn(window, 'addEventListener').mockImplementation(
	(type: string, listener: EventListenerOrEventListenerObject, options?) => {
		if (type === 'focus') focusListeners.push(listener)
		addListener(type, listener, options)
	}
)

beforeEach(() => {
	vi.resetModules()
	localStorage.clear()
	document.cookie = `user_id=${encodeURIComponent(USER)}`
	framework.handles = {}
	framework.guest = false
	framework.completed = new Set()
	statusResource.current = null
	callMock.mockReset()
	callMock.mockResolvedValue({})
	captureMock.mockReset()
	for (const fn of Object.values(nav)) fn.mockReset()
})

afterEach(() => {
	document.cookie = 'user_id=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
	for (const listener of focusListeners.splice(0))
		window.removeEventListener('focus', listener)
	vi.useRealTimers()
})

describe('setUpAll', () => {
	// Guards: a second setUpAll registering every flow again. Introduced in this
	// branch (feat/onboarding-flows, PR pending); test added there to keep setup
	// idempotent.
	it('registers every flow once', async () => {
		const o = await ready()
		await o.setUpAll(nav)
		for (const key of ALL) expect(handle(key).setUp).toHaveBeenCalledTimes(1)
	})

	// Guards: a guest running setup and firing a facts call that 403s.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to keep onboarding off for guests.
	it('does nothing for a guest', async () => {
		framework.guest = true
		const o = await ready()
		expect(o.isSetUp.value).toBe(false)
		expect(callMock).not.toHaveBeenCalled()
	})

	// Guards: a reload losing the card the admin had open. Introduced in this
	// branch (feat/onboarding-flows, PR pending); test added there to pin
	// reopening an answered card on load.
	it('reopens an unfinished card on load', async () => {
		const o = await ready({
			card: 'live_class',
			answers: { live_class: 'meet' },
		})
		expect(o.ui.showHelpModal.value).toBe(true)
		expect(o.screen.value).toBe('flow')
		expect(o.openFlow.value?.id).toBe('live_class_meet')
	})

	// Guards: a reload with an unanswered live class opening no flow. Introduced
	// in this branch (feat/onboarding-flows, PR pending); test added there to
	// pin reopening on the pre-choice flow.
	it('reopens an unanswered live class on its pre-choice flow', async () => {
		const o = await ready({ card: 'live_class' })
		expect(o.screen.value).toBe('flow')
		expect(o.openFlow.value?.id).toBe('live_class')
	})

	// Guards: the panel popping open for an admin who has not started.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to keep a fresh load closed on the list.
	it('stays closed on the list with nothing started', async () => {
		const o = await ready()
		expect(o.ui.showHelpModal.value).toBe(false)
		expect(o.screen.value).toBe('list')
	})

	// Guards: flows syncing before the shared status fetch returns and reading
	// stale flags. Introduced in this branch (feat/onboarding-flows, PR
	// pending); test added there to hold the sync until that fetch settles.
	it('syncs every flow once the shared status fetch settles', async () => {
		statusResource.current = reactive({ loading: true })
		const o = await load()
		const done = o.setUpAll(nav)
		await nextTick()
		expect(handle('live_class_zoom').syncStatus).not.toHaveBeenCalled()
		statusResource.current.loading = false
		await done
		for (const key of ALL)
			expect(handle(key).syncStatus).toHaveBeenCalledTimes(1)
	})

	// Guards: a failed facts call aborting setup. Introduced in this branch
	// (feat/onboarding-flows, PR pending); test added there to keep setup going
	// without facts.
	it('swallows a facts failure', async () => {
		callMock.mockRejectedValue(new Error('403'))
		const o = await ready()
		expect(o.isSetUp.value).toBe(true)
	})
})

describe('list', () => {
	// Guards: a fresh admin seeing non-zero progress on the list. Introduced in
	// this branch (feat/onboarding-flows, PR pending); test added there to pin
	// the empty-state numbers.
	it('has no progress with nothing started', async () => {
		const o = await ready()
		expect(o.hasAnyProgress.value).toBe(false)
		expect(o.overallPercent.value).toBe(0)
		expect(o.completedCards.value).toBe(0)
	})

	// Guards: an answered question not counting as progress. Introduced in this
	// branch (feat/onboarding-flows, PR pending); test added there to pin what
	// counts as started.
	it('counts an answer as progress', async () => {
		const o = await ready()
		o.answer('live_class', 'zoom')
		expect(o.hasAnyProgress.value).toBe(true)
	})

	// Guards: a ticked step not counting as progress. Introduced in this branch
	// (feat/onboarding-flows, PR pending); test added there to pin what counts
	// as started.
	it('counts a ticked step as progress', async () => {
		const o = await ready()
		o.completeStep('create_first_course')
		expect(o.hasAnyProgress.value).toBe(true)
	})

	// Guards: the overall percent averaging cards instead of weighing their
	// steps. Introduced in this branch (feat/onboarding-flows, PR pending); test
	// added there to pin the step-weighted percent.
	it('weighs the overall percent by steps across every card', async () => {
		const o = await ready({ answers: { live_class: 'zoom' } })
		// publish 6 + zoom 6 + users 2 = 14.
		o.toggleStep('publish_course', 'create_first_course')
		o.toggleStep('live_class_zoom', 'connect_zoom')
		expect(o.overallPercent.value).toBe(Math.floor((2 / 14) * 100))
	})

	// Guards: a finished card not counting toward the done total. Introduced in
	// this branch (feat/onboarding-flows, PR pending); test added there to pin
	// the all-done numbers.
	it("counts every card done once each card's flow is done", async () => {
		const o = await ready({
			answers: { live_class: 'zoom' },
		})
		for (const key of ['publish_course', 'onboard_learners', 'live_class_zoom'])
			finish(key)
		expect(o.completedCards.value).toBe(3)
		expect(o.overallPercent.value).toBe(100)
	})

	// Guards: a finished Zoom or Meet flow not finishing an unanswered live
	// class card. Introduced in this branch (feat/onboarding-flows, PR pending);
	// test added there to pin the provider fallback.
	it('counts an unanswered live class done when a provider flow is done', async () => {
		const o = await ready()
		finish('live_class_meet')
		expect(o.isCardComplete(card(o, 'live_class'))).toBe(true)
	})

	// Guards: the pre-choice live class flow alone marking the card done.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to stop the card finishing before a provider is picked.
	it('never counts the live class done on its pre-choice flow alone', async () => {
		const o = await ready()
		finish('live_class')
		expect(o.isCardComplete(card(o, 'live_class'))).toBe(false)
	})

	// Guards: an unanswered live class showing no step count. Introduced in this
	// branch (feat/onboarding-flows, PR pending); test added there to pin the
	// pre-choice totals.
	it('counts an unanswered live class on its pre-choice flow', async () => {
		const o = await ready()
		expect(o.cardProgress(card(o, 'live_class'))).toEqual({
			resolved: 0,
			total: 3,
			skipped: 0,
		})
		expect(o.cardProgress(card(o, 'publish_course'))).toEqual({
			resolved: 0,
			total: 6,
			skipped: 0,
		})
	})

	// Guards: Skip all touching finished flows or leaving a card unfinished.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin the bulk skip.
	it('skip all skips every unfinished flow and finishes every card', async () => {
		const o = await ready()
		finish('publish_course')
		o.skipEverything()
		expect(handle('publish_course').skipAll).not.toHaveBeenCalled()
		for (const key of ALL.slice(1))
			expect(handle(key).skipAll).toHaveBeenCalledTimes(1)
		expect(o.completedCards.value).toBe(3)
		expect(o.overallPercent.value).toBe(100)
	})
})

describe('question and answer', () => {
	// Guards: opening an unanswered live class card showing no flow. Introduced
	// in this branch (feat/onboarding-flows, PR pending); test added there to
	// pin the pre-choice flow on open.
	it('opens an unanswered live class on its pre-choice flow', async () => {
		const o = await ready()
		o.openCardScreen('live_class')
		expect(o.screen.value).toBe('flow')
		expect(o.openFlow.value?.id).toBe('live_class')
		expect(o.ui.showHelpModal.value).toBe(true)
	})

	// Guards: cards without a question stopping on a question screen. Introduced
	// in this branch (feat/onboarding-flows, PR pending); test added there to
	// pin opening straight on the flow.
	it.each([{ id: 'publish_course' }, { id: 'onboard_learners' }])(
		'opens $id straight on its flow',
		async ({ id }) => {
			const o = await ready()
			o.openCardScreen(id as 'publish_course' | 'onboard_learners')
			expect(o.screen.value).toBe('flow')
			expect(o.openFlow.value?.id).toBe(id)
		}
	)

	// Guards: a card with no question storing a stray answer. Introduced in this
	// branch (feat/onboarding-flows, PR pending); test added there to reject
	// answers there.
	it('ignores an answer for a card with no question', async () => {
		const o = await ready()
		o.answer('onboard_learners', 'csv')
		expect(o.answerOf(card(o, 'onboard_learners'))).toBeNull()
	})

	// Guards: answers not being saved per user or not opening the flow.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin the stored answer.
	it('answering persists per user and shows the flow', async () => {
		const o = await ready()
		o.openCardScreen('live_class')
		o.answer('live_class', 'meet')
		expect(o.screen.value).toBe('flow')
		expect(o.openFlow.value?.id).toBe('live_class_meet')
		await nextTick()
		expect(
			JSON.parse(localStorage.getItem('learningOnboardingAnswers' + USER)!)
		).toEqual({ live_class: 'meet' })
	})

	// Guards: switching provider wiping or merging the other provider's
	// progress. Introduced in this branch (feat/onboarding-flows, PR pending);
	// test added there to keep each key's progress apart.
	it("changing the answer switches the key, keeping each key's progress", async () => {
		const o = await ready()
		o.answer('live_class', 'zoom')
		o.toggleStep('live_class_zoom', 'connect_zoom')
		o.answer('live_class', 'meet')
		expect(o.openFlow.value?.key).toBe('learning_live_class_meet')
		// Only the shared choose step carries over; Zoom's own step does not.
		expect(o.flowProgress('live_class_meet').resolved).toBe(1)
		o.answer('live_class', 'zoom')
		expect(o.flowProgress('live_class_zoom').resolved).toBe(2)
	})

	// Guards: picking a provider dropping the pre-choice progress or leaving the
	// choose step open. Introduced in this branch (feat/onboarding-flows, PR
	// pending); test added there to pin the carry-over.
	it('picking a tool carries the pre-choice progress over and ticks the choice', async () => {
		const o = await ready()
		o.openCardScreen('live_class')
		o.toggleStep('live_class', 'create_first_batch')
		o.skipStep('live_class', 'fill_batch_details')
		o.answer('live_class', 'zoom')
		const zoom = o.stepsOf('live_class_zoom')
		expect(
			zoom.slice(0, 3).map((s) => o.stepStatus('live_class_zoom', s))
		).toEqual(['done', 'skipped', 'done'])
		expect(o.stepsOf('live_class')[2].completed).toBe(true)
		expect(o.openFlow.value?.id).toBe('live_class_zoom')
	})

	// Guards: an unknown provider being stored as the answer. Introduced in this
	// branch (feat/onboarding-flows, PR pending); test added there to reject
	// answers outside the question.
	it('ignores an answer the question does not offer', async () => {
		const o = await ready()
		o.answer('live_class', 'teams')
		expect(o.answerOf(card(o, 'live_class'))).toBeNull()
	})
})

describe('step status', () => {
	// Guards: rows showing the wrong done, skipped, current or upcoming state.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin the row states and count.
	it('marks done, skipped, current and upcoming', async () => {
		const o = await ready()
		o.toggleStep('publish_course', 'create_first_course')
		o.skipStep('publish_course', 'create_first_chapter')
		const steps = o.stepsOf('publish_course')
		expect(steps.map((s) => o.stepStatus('publish_course', s))).toEqual([
			'done',
			'skipped',
			'current',
			'upcoming',
			'upcoming',
			'upcoming',
		])
		expect(o.flowProgress('publish_course')).toEqual({
			resolved: 2,
			total: 6,
			skipped: 1,
		})
	})

	// Guards: a blocked step naming the wrong blocker, or a free step showing
	// one. Introduced in this branch (feat/onboarding-flows, PR pending); test
	// added there to pin the blocker lookup.
	it("reports a blocked step's blocker", async () => {
		const o = await ready()
		const meet = o.stepsOf('live_class_meet')
		expect(o.blocker('live_class_meet', meet[4])?.name).toBe('setup_google_api')
		expect(o.blocker('live_class_meet', meet[3])).toBeUndefined()
	})
})

describe('step actions', () => {
	// Guards: the checkbox failing to tick or to un-tick a step. Introduced in
	// this branch (feat/onboarding-flows, PR pending); test added there to pin
	// toggle both ways.
	it('toggle ticks an open step and un-ticks a done one', async () => {
		const o = await ready()
		o.toggleStep('publish_course', 'add_quiz')
		expect(handle('publish_course').updateOnboardingStep).toHaveBeenCalledWith(
			'add_quiz',
			true
		)
		o.toggleStep('publish_course', 'add_quiz')
		expect(handle('publish_course').reset).toHaveBeenCalledWith('add_quiz')
	})

	// Guards: ticking a skipped step resetting it instead of marking it done.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin toggle on a skip.
	it('toggle on a skipped step marks it done', async () => {
		const o = await ready()
		o.skipStep('publish_course', 'add_quiz')
		o.toggleStep('publish_course', 'add_quiz')
		const quiz = o.stepsOf('publish_course')[3]
		expect(o.stepStatus('publish_course', quiz)).toBe('done')
		expect(handle('publish_course').reset).not.toHaveBeenCalled()
	})

	// Guards: a blocked step being ticked before its blocker. Introduced in this
	// branch (feat/onboarding-flows, PR pending); test added there to pin the
	// toggle guard.
	it('toggle does nothing on a blocked step', async () => {
		const o = await ready()
		o.toggleStep('publish_course', 'create_first_chapter')
		expect(handle('publish_course').updateOnboardingStep).not.toHaveBeenCalled()
	})

	// Guards: a skip not reaching the framework or not surviving a reload.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin the stored skip.
	it('skip tells the framework and remembers the skip', async () => {
		const o = await ready()
		o.skipStep('publish_course', 'add_quiz')
		expect(handle('publish_course').skip).toHaveBeenCalledWith('add_quiz')
		await nextTick()
		expect(
			JSON.parse(localStorage.getItem('learningOnboardingSkipped' + USER)!)
		).toEqual({ learning_publish_course: ['add_quiz'] })
	})

	// Guards: undo leaving a step skipped or ticked. Introduced in this branch
	// (feat/onboarding-flows, PR pending); test added there to pin undo.
	it('undo resets the step and forgets the skip', async () => {
		const o = await ready()
		o.skipStep('publish_course', 'add_quiz')
		o.undoStep('publish_course', 'add_quiz')
		const quiz = o.stepsOf('publish_course')[3]
		expect(handle('publish_course').reset).toHaveBeenCalledWith('add_quiz')
		expect(o.flowProgress('publish_course').skipped).toBe(0)
		expect(quiz.completed).toBe(false)
	})

	// Guards: undo on a finished flow keeping the framework's completed flag
	// set. Introduced in this branch (feat/onboarding-flows, PR pending); test
	// added there to pin the flag reset.
	it("undo on a finished flow clears the framework's completed flag first", async () => {
		const o = await ready()
		finish('publish_course')
		handle('publish_course').isOnboardingStepsCompleted.value = true
		o.undoStep('publish_course', 'publish_course')
		expect(handle('publish_course').isOnboardingStepsCompleted.value).toBe(
			false
		)
	})

	// Guards: Start ticking the step it only navigates to. Introduced in this
	// branch (feat/onboarding-flows, PR pending); test added there to pin Start
	// as navigation only.
	it("start runs the step's navigation without ticking it", async () => {
		const o = await ready()
		o.startStep('publish_course', 'add_quiz')
		expect(nav.openRoute).toHaveBeenCalledWith({ name: 'NewQuiz' })
		expect(o.stepsOf('publish_course')[3].completed).toBe(false)
	})

	// Guards: Start navigating for a blocked step. Introduced in this branch
	// (feat/onboarding-flows, PR pending); test added there to pin the Start
	// guard.
	it('start does nothing on a blocked step', async () => {
		const o = await ready()
		o.startStep('publish_course', 'create_first_chapter')
		expect(nav.openRoute).not.toHaveBeenCalled()
	})
})

describe('flow menu', () => {
	// Guards: Skip remaining re-skipping done steps or leaving the flow
	// unfinished. Introduced in this branch (feat/onboarding-flows, PR pending);
	// test added there to pin the per-flow skip.
	it('skip remaining marks only open steps skipped', async () => {
		const o = await ready()
		o.toggleStep('publish_course', 'create_first_course')
		o.skipRemaining('publish_course')
		expect(handle('publish_course').skipAll).toHaveBeenCalledTimes(1)
		expect(o.flowProgress('publish_course')).toEqual({
			resolved: 6,
			total: 6,
			skipped: 5,
		})
		expect(o.isFlowComplete('publish_course')).toBe(true)
	})

	// Guards: resetting a flow leaving skips or the completed flag, or clearing
	// the answer. Introduced in this branch (feat/onboarding-flows, PR pending);
	// test added there to pin the per-flow reset.
	it('reset this flow clears its steps and skips, keeping the answer', async () => {
		const o = await ready()
		o.answer('live_class', 'zoom')
		o.skipStep('live_class_zoom', 'connect_zoom')
		handle('live_class_zoom').isOnboardingStepsCompleted.value = true
		o.resetFlow('live_class_zoom')
		expect(handle('live_class_zoom').resetAll).toHaveBeenCalledTimes(1)
		expect(handle('live_class_zoom').isOnboardingStepsCompleted.value).toBe(
			false
		)
		expect(o.flowProgress('live_class_zoom').skipped).toBe(0)
		expect(o.answerOf(card(o, 'live_class'))).toBe('zoom')
	})
})

describe('telemetry', () => {
	// Guards: skip and undo sending no telemetry (HelpModal sent it,
	// frappe/lms#1399). Introduced in this branch (feat/onboarding-flows, PR
	// pending); test added there to keep it sent.
	it('captures a skipped and a reset step', async () => {
		const o = await ready()
		o.skipStep('publish_course', 'add_quiz')
		o.undoStep('publish_course', 'add_quiz')
		expect(captureMock.mock.calls).toEqual([
			['onboarding_step_skipped_add_quiz'],
			['onboarding_step_reset_add_quiz'],
		])
	})

	// Guards: Skip all and Reset all sending no telemetry, or sending it per
	// step. Introduced in this branch (feat/onboarding-flows, PR pending); test
	// added there to keep one event each.
	it('captures skip all and reset all once each', async () => {
		const o = await ready()
		o.skipRemaining('publish_course')
		o.resetFlow('publish_course')
		o.skipEverything()
		o.resetEverything()
		expect(captureMock.mock.calls).toEqual([
			['onboarding_steps_skipped'],
			['onboarding_steps_reset'],
			['onboarding_steps_skipped'],
			['onboarding_steps_reset'],
		])
	})

	// Guards: a skip carried over to the picked provider being counted twice.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to stop the duplicate event.
	it('does not capture a skip carried over to the picked tool', async () => {
		const o = await ready()
		o.skipStep('live_class', 'fill_batch_details')
		o.answer('live_class', 'zoom')
		expect(captureMock).toHaveBeenCalledTimes(1)
	})
})

describe('next up', () => {
	// Guards: Next up leaving the card order. Introduced in this branch
	// (feat/onboarding-flows, PR pending); test added there to pin the order.
	it("follows the card's next order", async () => {
		const o = await ready()
		expect(o.nextCard(card(o, 'publish_course'))?.id).toBe('live_class')
		expect(o.nextCard(card(o, 'live_class'))?.id).toBe('onboard_learners')
		expect(o.nextCard(card(o, 'onboard_learners'))?.id).toBe('publish_course')
	})

	// Guards: Next up pointing at a finished card. Introduced in this branch
	// (feat/onboarding-flows, PR pending); test added there to skip finished
	// cards.
	it('skips finished cards', async () => {
		const o = await ready({ answers: { live_class: 'zoom' } })
		finish('live_class_zoom')
		expect(o.nextCard(card(o, 'publish_course'))?.id).toBe('onboard_learners')
	})

	// Guards: Next up offering a card when none is left. Introduced in this
	// branch (feat/onboarding-flows, PR pending); test added there to pin the
	// empty case.
	it('is null once everything else is done', async () => {
		const o = await ready({
			answers: { live_class: 'meet' },
		})
		finish('onboard_learners')
		finish('live_class_meet')
		expect(o.nextCard(card(o, 'publish_course'))).toBeNull()
	})
})

describe('reset everything', () => {
	// Guards: Reset all missing a key or leaving answers, skips or the open
	// card. Introduced in this branch (feat/onboarding-flows, PR pending); test
	// added there to pin the full reset.
	it('resets every key and clears answers, skips and the open card', async () => {
		const o = await ready()
		o.answer('live_class', 'meet')
		o.skipStep('live_class_meet', 'setup_google_api')
		handle('publish_course').isOnboardingStepsCompleted.value = true
		o.resetEverything()
		for (const key of ALL) {
			expect(handle(key).resetAll).toHaveBeenCalledTimes(1)
			expect(handle(key).isOnboardingStepsCompleted.value).toBe(false)
		}
		expect(o.hasAnyProgress.value).toBe(false)
		expect(o.screen.value).toBe('list')
		expect(o.activeCard.value).toBeNull()
	})
})

describe('completeStep', () => {
	// Guards: a form completing a step before setup creating flows or throwing.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin the early no-op.
	it('does nothing before the flows are set up', async () => {
		const o = await load()
		expect(() => o.completeStep('create_first_course')).not.toThrow()
		expect(Object.keys(framework.handles)).toHaveLength(0)
	})

	// Guards: a shared step ticking in only one of the flows that own it.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin each step's owners.
	it.each([
		{
			step: 'create_first_batch',
			owners: ['live_class', 'live_class_zoom', 'live_class_meet'],
		},
		{
			step: 'fill_batch_details',
			owners: ['live_class', 'live_class_zoom', 'live_class_meet'],
		},
		{
			step: 'publish_batch',
			owners: ['live_class_zoom', 'live_class_meet'],
		},
		{
			step: 'schedule_live_class',
			owners: ['live_class_zoom', 'live_class_meet'],
		},
		{ step: 'add_meet_account', owners: ['live_class_meet'] },
		{ step: 'setup_email', owners: ['onboard_learners'] },
	])('$step completes in every owning flow', async ({ step, owners }) => {
		const o = await ready()
		o.completeStep(step)
		for (const key of ALL) {
			const calls = handle(key).updateOnboardingStep
			if (owners.includes(key)) expect(calls).toHaveBeenCalledWith(step)
			else expect(calls).not.toHaveBeenCalled()
		}
	})

	// Guards: a real completion leaving the step counted as skipped. Introduced
	// in this branch (feat/onboarding-flows, PR pending); test added there to
	// pin the skip clearing.
	it('a real completion clears an earlier skip', async () => {
		const o = await ready()
		o.skipStep('publish_course', 'add_quiz')
		o.completeStep('add_quiz')
		expect(o.flowProgress('publish_course').skipped).toBe(0)
	})

	it('remembers a new course as the first course only when none is known', async () => {
		const o = await load()
		o.completeStep('create_first_course', { first_course: 'course-a' })
		o.completeStep('create_first_course', { first_course: 'course-b' })
		expect(o.facts.first_course).toBe('course-a')
	})
})

describe('facts', () => {
	// Guards: facts failing to tick a step, or un-ticking a manual tick.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin facts as tick-only.
	it('tick steps whose fact is true and never un-tick', async () => {
		const o = await ready()
		o.toggleStep('publish_course', 'add_quiz')
		o.applyFacts({ has_course: true, has_quiz: false })
		const steps = o.stepsOf('publish_course')
		expect(steps[0].completed).toBe(true)
		expect(steps[3].completed).toBe(true)
	})

	// Guards: a fact leaving a skipped step skipped. Introduced in this branch
	// (feat/onboarding-flows, PR pending); test added there to pin facts over
	// skips.
	it('turn a skipped step into a done one', async () => {
		const o = await ready()
		o.skipStep('publish_course', 'add_quiz')
		o.applyFacts({ has_quiz: true })
		const quiz = o.stepsOf('publish_course')[3]
		expect(o.stepStatus('publish_course', quiz)).toBe('done')
	})

	// Guards: each focus event refetching facts instead of one debounced fetch.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin the debounce.
	it('are fetched again once after a burst of focus events', async () => {
		vi.useFakeTimers()
		const o = await ready()
		callMock.mockClear()
		callMock.mockResolvedValue({ has_google_calendar: true })
		window.dispatchEvent(new Event('focus'))
		window.dispatchEvent(new Event('focus'))
		expect(callMock).not.toHaveBeenCalled()
		await vi.advanceTimersByTimeAsync(1000)
		expect(callMock).toHaveBeenCalledTimes(1)
		expect(handle('live_class_meet').updateOnboardingStep).toHaveBeenCalledWith(
			'connect_google_calendar'
		)
	})

	// Guards: opening the panel not refetching facts. Introduced in this branch
	// (feat/onboarding-flows, PR pending); test added there to pin the refetch
	// on open.
	it('are fetched again when the panel opens', async () => {
		vi.useFakeTimers()
		const o = await ready()
		o.ui.showHelpModal.value = false
		await nextTick()
		callMock.mockClear()
		o.ui.showHelpModal.value = true
		await nextTick()
		await vi.advanceTimersByTimeAsync(1000)
		expect(callMock).toHaveBeenCalledWith(
			'lms.lms.onboarding.get_onboarding_facts'
		)
	})
})

describe('a key the framework already marks complete', () => {
	// On reload the framework's syncStatus returns early for a completed key, so
	// its steps keep completed: false while the flag says done.
	beforeEach(() => {
		framework.completed = new Set(['learning_live_class_meet'])
	})

	// Guards: a reloaded complete key showing open rows against a full count.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to keep rows and count agreeing.
	it('shows every step resolved, matching the count', async () => {
		const o = await ready({
			card: 'live_class',
			answers: { live_class: 'meet' },
		})
		const steps = o.stepsOf('live_class_meet')
		expect(steps.every((s) => s.completed)).toBe(true)
		expect(o.flowProgress('live_class_meet').resolved).toBe(steps.length)
		expect(steps.map((s) => o.stepStatus('live_class_meet', s))).toEqual(
			steps.map(() => 'done')
		)
	})

	// Guards: a reloaded complete key not finishing its flow and card.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin completion from the stored flag.
	it('counts the flow and its card complete', async () => {
		const o = await ready({
			card: 'live_class',
			answers: { live_class: 'meet' },
		})
		expect(o.isFlowComplete('live_class_meet')).toBe(true)
		expect(o.isCardComplete(card(o, 'live_class'))).toBe(true)
	})

	// Guards: a finished card reopening on load before the status fetch settles.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to keep it closed.
	it('does not reopen its card on load, before the status fetch settles', async () => {
		statusResource.current = reactive({ loading: true })
		const o = await load({
			card: 'live_class',
			answers: { live_class: 'meet' },
		})
		const settingUp = o.setUpAll(nav)
		expect(o.ui.showHelpModal.value).toBe(false)
		statusResource.current.loading = false
		await settingUp
	})

	// Guards: a reloaded complete key showing blocked rows. Introduced in this
	// branch (feat/onboarding-flows, PR pending); test added there to pin no
	// blockers there.
	it('leaves no step blocked', async () => {
		const o = await ready({
			card: 'live_class',
			answers: { live_class: 'meet' },
		})
		const steps = o.stepsOf('live_class_meet')
		expect(steps.map((s) => o.blocker('live_class_meet', s))).toEqual(
			steps.map(() => undefined)
		)
	})

	// Guards: earlier skips turning into done rows on a completed key.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to keep skipped rows skipped.
	it('keeps steps skipped earlier showing as skipped', async () => {
		localStorage.setItem(
			'learningOnboardingSkipped' + USER,
			JSON.stringify({ learning_live_class_meet: ['setup_google_api'] })
		)
		const o = await ready({
			card: 'live_class',
			answers: { live_class: 'meet' },
		})
		const api = o.stepsOf('live_class_meet')[3]
		expect(o.stepStatus('live_class_meet', api)).toBe('skipped')
	})
})

describe('after Skip all on a flow', () => {
	// Guards: rows after Skip all disagreeing with the resolved count.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to keep rows and count agreeing.
	it('every row is resolved and the count agrees', async () => {
		const o = await ready()
		o.toggleStep('publish_course', 'create_first_course')
		o.skipRemaining('publish_course')
		const steps = o.stepsOf('publish_course')
		expect(steps.map((s) => o.stepStatus('publish_course', s))).toEqual([
			'done',
			'skipped',
			'skipped',
			'skipped',
			'skipped',
			'skipped',
		])
		expect(o.flowProgress('publish_course').resolved).toBe(6)
	})

	// Guards: a fact completion showing done in the count but not on the row.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to keep rows and count agreeing.
	it('a fact completion agrees between row and count', async () => {
		const o = await ready()
		o.applyFacts({ has_course: true })
		const steps = o.stepsOf('publish_course')
		expect(o.stepStatus('publish_course', steps[0])).toBe('done')
		expect(o.flowProgress('publish_course').resolved).toBe(1)
	})
})

describe('bannerFlow', () => {
	// Guards: the banner ignoring the active card. Introduced in this branch
	// (feat/onboarding-flows, PR pending); test added there to pin the banner
	// flow.
	it('follows the active card while it is unfinished', async () => {
		const o = await ready({
			card: 'live_class',
			answers: { live_class: 'zoom' },
		})
		expect(o.bannerFlow.value?.id).toBe('live_class_zoom')
	})

	// Guards: the banner jumping to another card while the panel still shows the
	// done flow. Introduced in this branch (feat/onboarding-flows, PR pending);
	// test added there to keep banner and panel agreeing.
	it('stays on the active flow once it is done, so it agrees with the panel', async () => {
		const o = await ready({
			card: 'live_class',
			answers: { live_class: 'meet' },
		})
		finish('live_class_meet')
		expect(o.bannerFlow.value?.id).toBe('live_class_meet')
	})

	// Guards: the banner staying up after the active flow is done and dismissed.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin hiding it.
	it('hides once the active flow is done and its completed flag is set', async () => {
		framework.completed = new Set(['learning_live_class_meet'])
		const o = await ready({
			card: 'live_class',
			answers: { live_class: 'meet' },
		})
		expect(o.bannerFlow.value).toBeNull()
	})

	// Guards: the banner showing nothing when no card is active. Introduced in
	// this branch (feat/onboarding-flows, PR pending); test added there to pin
	// the fallback card.
	it('borrows the first unfinished card with no active one', async () => {
		const o = await ready()
		expect(o.bannerFlow.value?.id).toBe('publish_course')
	})

	// Guards: the banner showing after every card is done and dismissed.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin hiding it.
	it('is hidden once every card is done and dismissed', async () => {
		const o = await ready({
			card: 'publish_course',
			answers: { live_class: 'zoom' },
		})
		for (const key of ALL) {
			finish(key)
			handle(key).isOnboardingStepsCompleted.value = true
		}
		expect(o.bannerFlow.value).toBeNull()
	})
})

describe('staying open and moving on', () => {
	// Guards: a fact ticking a step while the panel stays minimised. Introduced
	// in this branch (feat/onboarding-flows, PR pending); test added there to
	// bring the panel back.
	it('a fact completing a step while minimised brings the panel back', async () => {
		const o = await ready()
		o.ui.minimize.value = true
		o.applyFacts({ has_course: true })
		expect(o.ui.minimize.value).toBe(false)
	})

	// Guards: a fact that ticks nothing un-minimising the panel. Introduced in
	// this branch (feat/onboarding-flows, PR pending); test added there to leave
	// it alone.
	it('a fact that ticks nothing new leaves the panel alone', async () => {
		const o = await ready()
		o.ui.minimize.value = true
		o.applyFacts({ has_course: false })
		expect(o.ui.minimize.value).toBe(true)
	})

	// Guards: a form ticking a step while the panel stays minimised. Introduced
	// in this branch (feat/onboarding-flows, PR pending); test added there to
	// bring the panel back.
	it('a form completing a step brings the panel back too', async () => {
		const o = await ready()
		o.ui.minimize.value = true
		o.completeStep('create_first_course')
		expect(o.ui.minimize.value).toBe(false)
	})

	// Guards: Start closing or minimising the panel on a normal step. Introduced
	// in this branch (feat/onboarding-flows, PR pending); test added there to
	// keep it open.
	it('starting a step keeps the panel open and unminimised', async () => {
		const o = await ready()
		o.ui.showHelpModal.value = true
		o.ui.minimize.value = false
		o.startStep('publish_course', 'create_first_course')
		expect(nav.openForm).toHaveBeenCalledWith({ name: 'NewCourse' })
		expect(o.ui.showHelpModal.value).toBe(true)
		expect(o.ui.minimize.value).toBe(false)
	})

	// Guards: Next step picking a done or blocked step. Introduced in this
	// branch (feat/onboarding-flows, PR pending); test added there to pin the
	// pick.
	it('the next step is the first open, unblocked one', async () => {
		const o = await ready()
		expect(o.nextStep('publish_course')?.name).toBe('create_first_course')
		o.toggleStep('publish_course', 'create_first_course')
		expect(o.nextStep('publish_course')?.name).toBe('create_first_chapter')
		o.skipStep('publish_course', 'create_first_chapter')
		// The lesson depends on the chapter, which is now resolved by the skip.
		expect(o.nextStep('publish_course')?.name).toBe('create_first_lesson')
	})

	// Guards: Next step offering a step on a finished flow. Introduced in this
	// branch (feat/onboarding-flows, PR pending); test added there to pin the
	// empty case.
	it('has no next step once the flow is done', async () => {
		const o = await ready()
		finish('publish_course')
		expect(o.nextStep('publish_course')).toBeNull()
	})
})

describe('help centre', () => {
	// Guards: closing the help centre losing the flow it opened over. Introduced
	// in this branch (feat/onboarding-flows, PR pending); test added there to
	// pin the return.
	it('opens over the current screen and returns to it', async () => {
		const o = await ready()
		o.openCardScreen('publish_course')
		o.showHelp()
		expect(o.screen.value).toBe('help')
		o.hideHelp()
		expect(o.screen.value).toBe('flow')
		expect(o.openFlow.value?.id).toBe('publish_course')
	})

	// Guards: closing the help centre opened from the list landing elsewhere.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin the return.
	it('returns to the list when opened from the list', async () => {
		const o = await ready()
		o.showHelp()
		o.hideHelp()
		expect(o.screen.value).toBe('list')
	})

	// Guards: the help centre staying up when a card is opened. Introduced in
	// this branch (feat/onboarding-flows, PR pending); test added there to leave
	// it.
	it('leaves the help centre when a card is opened', async () => {
		const o = await ready()
		o.showHelp()
		o.openCardScreen('onboard_learners')
		expect(o.screen.value).toBe('flow')
	})
})
