/**
 * useLearningOnboarding drives five framework onboarding keys at once. The
 * framework is replaced by a small in-memory model of `useOnboarding`, so each
 * test sees which keys were updated, synced, or left alone.
 */
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

const { framework, callMock, statusResource } = vi.hoisted(() => ({
	framework: {
		handles: {} as Record<string, FakeHandle>,
		guest: false,
	},
	callMock: vi.fn(),
	statusResource: { current: null as { loading: boolean } | null },
}))

vi.mock('frappe-ui', () => ({
	call: callMock,
	getCachedResource: () => statusResource.current,
}))

vi.mock('@framework/ui/components/Onboarding/index', async () => {
	const { ref: vueRef } = await import('vue')
	return {
		showHelpModal: vueRef(false),
		minimize: vueRef(true),
		useOnboarding: (key: string) => {
			if (framework.guest) return undefined
			framework.handles[key] ??= makeHandle()
			return framework.handles[key]
		},
	}
})

function makeHandle(): FakeHandle {
	const state = reactive({ steps: [] as FakeStep[] })
	const mark = (name: string, value: boolean) => {
		const step = state.steps.find((s) => s.name === name)
		if (step) step.completed = value
	}
	return {
		get steps() {
			return state.steps
		},
		isOnboardingStepsCompleted: ref(false),
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
	'onboard_learners_invite',
	'onboard_learners_csv',
	'live_class_zoom',
	'live_class_meet',
]
const nav = {
	openRoute: vi.fn(),
	openForm: vi.fn(),
	openSettings: vi.fn(),
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
	statusResource.current = null
	callMock.mockReset()
	callMock.mockResolvedValue({})
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

	it('reopens on the question when the card is unanswered', async () => {
		const o = await ready({ card: 'onboard_learners' })
		expect(o.screen.value).toBe('question')
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
		// publish 6 + learners (unanswered, first option csv) 4 + zoom 4 = 14.
		o.toggleStep('publish_course', 'create_first_course')
		o.toggleStep('live_class_zoom', 'connect_zoom')
		expect(o.overallPercent.value).toBe(Math.floor((2 / 14) * 100))
	})

	it('counts every card done once each card’s flow is done', async () => {
		const o = await ready({
			answers: { onboard_learners: 'csv', live_class: 'zoom' },
		})
		for (const key of [
			'publish_course',
			'onboard_learners_csv',
			'live_class_zoom',
		])
			finish(key)
		expect(o.completedCards.value).toBe(3)
		expect(o.overallPercent.value).toBe(100)
	})

	it('counts an unanswered card done when any of its flows is done', async () => {
		const o = await ready()
		finish('live_class_meet')
		expect(o.isCardComplete(card(o, 'live_class'))).toBe(true)
	})

	it('has no row count while a question is unanswered', async () => {
		const o = await ready()
		expect(o.cardProgress(card(o, 'live_class'))).toBeNull()
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
	it('opens the question for an unanswered card', async () => {
		const o = await ready()
		o.openCardScreen('onboard_learners')
		expect(o.screen.value).toBe('question')
		expect(o.ui.showHelpModal.value).toBe(true)
	})

	it('opens a card without a question straight on its flow', async () => {
		const o = await ready()
		o.openCardScreen('publish_course')
		expect(o.screen.value).toBe('flow')
		expect(o.openFlow.value?.id).toBe('publish_course')
	})

	// Guards: answers not being saved per user or not opening the flow.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin the stored answer.
	it('answering persists per user and shows the flow', async () => {
		const o = await ready()
		o.openCardScreen('onboard_learners')
		o.answer('onboard_learners', 'invite')
		expect(o.screen.value).toBe('flow')
		expect(o.openFlow.value?.id).toBe('onboard_learners_invite')
		await nextTick()
		expect(
			JSON.parse(localStorage.getItem('learningOnboardingAnswers' + USER)!)
		).toEqual({ onboard_learners: 'invite' })
	})

	it('changing the answer switches the key, keeping each key’s progress', async () => {
		const o = await ready()
		o.answer('live_class', 'zoom')
		o.toggleStep('live_class_zoom', 'connect_zoom')
		o.answer('live_class', 'meet')
		expect(o.openFlow.value?.key).toBe('learning_live_class_meet')
		expect(o.flowProgress('live_class_meet').resolved).toBe(0)
		o.answer('live_class', 'zoom')
		expect(o.flowProgress('live_class_zoom').resolved).toBe(1)
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

	it('reports a blocked step’s blocker', async () => {
		const o = await ready()
		const meet = o.stepsOf('live_class_meet')
		expect(o.blocker('live_class_meet', meet[2])?.name).toBe('setup_google_api')
		expect(o.blocker('live_class_meet', meet[1])).toBeUndefined()
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

	it('undo on a finished flow clears the framework’s completed flag first', async () => {
		const o = await ready()
		finish('publish_course')
		handle('publish_course').isOnboardingStepsCompleted.value = true
		o.undoStep('publish_course', 'publish_course')
		expect(handle('publish_course').isOnboardingStepsCompleted.value).toBe(
			false
		)
	})

	it('start runs the step’s navigation without ticking it', async () => {
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

describe('next up', () => {
	it('follows the card’s next order', async () => {
		const o = await ready()
		expect(o.nextCard(card(o, 'publish_course'))?.id).toBe('onboard_learners')
		expect(o.nextCard(card(o, 'live_class'))?.id).toBe('onboard_learners')
	})

	// Guards: Next up pointing at a finished card. Introduced in this branch
	// (feat/onboarding-flows, PR pending); test added there to skip finished
	// cards.
	it('skips finished cards', async () => {
		const o = await ready({ answers: { onboard_learners: 'invite' } })
		finish('onboard_learners_invite')
		expect(o.nextCard(card(o, 'publish_course'))?.id).toBe('live_class')
	})

	// Guards: Next up offering a card when none is left. Introduced in this
	// branch (feat/onboarding-flows, PR pending); test added there to pin the
	// empty case.
	it('is null once everything else is done', async () => {
		const o = await ready({
			answers: { onboard_learners: 'invite', live_class: 'meet' },
		})
		finish('onboard_learners_invite')
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
			owners: [
				'onboard_learners_invite',
				'onboard_learners_csv',
				'live_class_zoom',
				'live_class_meet',
			],
		},
		{
			step: 'publish_batch',
			owners: [
				'onboard_learners_invite',
				'onboard_learners_csv',
				'live_class_zoom',
				'live_class_meet',
			],
		},
		{
			step: 'schedule_live_class',
			owners: ['live_class_zoom', 'live_class_meet'],
		},
		{ step: 'add_meet_account', owners: ['live_class_meet'] },
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

	it('moves to the first unfinished card once the active one is done', async () => {
		const o = await ready({ card: 'publish_course' })
		finish('publish_course')
		expect(o.bannerFlow.value?.card).toBe('onboard_learners')
	})

	// Guards: the banner showing after every card is done and dismissed.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin hiding it.
	it('is hidden once every card is done and dismissed', async () => {
		const o = await ready({
			card: 'publish_course',
			answers: { onboard_learners: 'csv', live_class: 'zoom' },
		})
		for (const key of ALL) {
			finish(key)
			handle(key).isOnboardingStepsCompleted.value = true
		}
		expect(o.bannerFlow.value).toBeNull()
	})
})
