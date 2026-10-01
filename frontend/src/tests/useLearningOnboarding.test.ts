/**
 * useLearningOnboarding drives three framework onboarding keys at once. The
 * framework is replaced by a small in-memory model of `useOnboarding`, so each
 * test sees which keys were updated, synced, or left alone.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, reactive, ref, type Ref } from 'vue'

type FakeStep = { name: string; completed: boolean }
type FakeHandle = {
	steps: FakeStep[]
	updateOnboardingStep: ReturnType<typeof vi.fn>
	skipAll: ReturnType<typeof vi.fn>
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

function makeHandle() {
	const state = reactive({ steps: [] as FakeStep[] })
	const isOnboardingStepsCompleted = ref(false)
	const handle = {
		get steps() {
			return state.steps
		},
		isOnboardingStepsCompleted,
		stepsCompleted: computed(
			() => state.steps.filter((s) => s.completed).length
		),
		totalSteps: computed(() => state.steps.length),
		setUp: vi.fn((steps: FakeStep[]) => {
			if (!state.steps.length) state.steps = steps
		}),
		syncStatus: vi.fn(),
		skipAll: vi.fn(() => {
			for (const step of state.steps) step.completed = true
		}),
		updateOnboardingStep: vi.fn((name: string) => {
			const step = state.steps.find((s) => s.name === name)
			if (step) step.completed = true
		}),
	}
	return handle
}

const USER = 'admin@example.com'
const nav = {
	openRoute: vi.fn(),
	openForm: vi.fn(),
	openSettings: vi.fn(),
}

async function load(storedFlow?: string) {
	if (storedFlow)
		localStorage.setItem('learningOnboardingFlow' + USER, storedFlow)
	const mod = await import('@/onboarding/useLearningOnboarding')
	const framework_ = await import('@framework/ui/components/Onboarding/index')
	return { ...mod.useLearningOnboarding(), ui: framework_ }
}

function handle(key: string): FakeHandle {
	return framework.handles['learning_' + key]
}

beforeEach(() => {
	vi.resetModules()
	localStorage.clear()
	document.cookie = `user_id=${encodeURIComponent(USER)}`
	framework.handles = {}
	framework.guest = false
	statusResource.current = null
	callMock.mockReset()
	callMock.mockResolvedValue({})
})

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

afterEach(() => {
	document.cookie = 'user_id=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
	for (const listener of focusListeners.splice(0))
		window.removeEventListener('focus', listener)
})

describe('completeStep', () => {
	it('does nothing before the flows are set up', async () => {
		const o = await load()
		expect(() => o.completeStep('create_first_course')).not.toThrow()
		expect(Object.keys(framework.handles)).toHaveLength(0)
	})

	it('updates every flow that owns the step', async () => {
		const o = await load()
		await o.setUpAll(nav)
		o.completeStep('create_first_batch')
		expect(
			handle('onboard_learners').updateOnboardingStep
		).toHaveBeenCalledWith('create_first_batch')
		expect(handle('live_class_zoom').updateOnboardingStep).toHaveBeenCalledWith(
			'create_first_batch'
		)
		expect(handle('live_class_meet').updateOnboardingStep).toHaveBeenCalledWith(
			'create_first_batch'
		)
		expect(handle('publish_course').updateOnboardingStep).not.toHaveBeenCalled()
	})

	it.each([{ step: 'schedule_live_class' }, { step: 'publish_batch' }])(
		'$step completes in both live class provider flows',
		async ({ step }) => {
			const o = await load()
			await o.setUpAll(nav)
			o.completeStep(step)
			expect(
				handle('live_class_zoom').updateOnboardingStep
			).toHaveBeenCalledWith(step)
			expect(
				handle('live_class_meet').updateOnboardingStep
			).toHaveBeenCalledWith(step)
			expect(
				handle('onboard_learners').updateOnboardingStep
			).not.toHaveBeenCalled()
		}
	)

	it('completes a provider-only step in that provider alone', async () => {
		const o = await load()
		await o.setUpAll(nav)
		o.completeStep('add_meet_account')
		expect(handle('live_class_meet').updateOnboardingStep).toHaveBeenCalledWith(
			'add_meet_account'
		)
		expect(
			handle('live_class_zoom').updateOnboardingStep
		).not.toHaveBeenCalled()
	})

	it('remembers a new course as the first course only when none is known', async () => {
		const o = await load()
		o.completeStep('create_first_course', { first_course: 'course-a' })
		o.completeStep('create_first_course', { first_course: 'course-b' })
		expect(o.facts.first_course).toBe('course-a')
	})
})

describe('applyFacts', () => {
	it('completes steps whose fact is true', async () => {
		const o = await load()
		await o.setUpAll(nav)
		o.applyFacts({ has_course: true, has_chapter: false })
		expect(handle('publish_course').updateOnboardingStep).toHaveBeenCalledTimes(
			1
		)
		expect(handle('publish_course').updateOnboardingStep).toHaveBeenCalledWith(
			'create_first_course'
		)
	})

	it('never un-ticks a step whose fact is false', async () => {
		const o = await load()
		await o.setUpAll(nav)
		handle('publish_course').steps[4].completed = true
		o.applyFacts({ has_course: false })
		expect(handle('publish_course').steps[4].completed).toBe(true)
		expect(handle('publish_course').updateOnboardingStep).not.toHaveBeenCalled()
	})

	it('skips steps that are already complete', async () => {
		const o = await load()
		await o.setUpAll(nav)
		handle('publish_course').steps[0].completed = true
		o.applyFacts({ has_course: true })
		expect(handle('publish_course').updateOnboardingStep).not.toHaveBeenCalled()
	})

	it('learns the navigation targets', async () => {
		const o = await load()
		o.applyFacts({ first_course: 'c1', first_batch: 'b1' })
		expect(o.facts.first_course).toBe('c1')
		expect(o.facts.first_batch).toBe('b1')
	})
})

describe('active flow', () => {
	it('reads an unknown stored flow id as no flow', async () => {
		const o = await load('paid_course')
		expect(o.activeFlowId.value).toBeNull()
		expect(o.panelView.value).toBe('picker')
	})

	it('reads a known stored flow id', async () => {
		const o = await load('live_class_meet')
		expect(o.activeFlowId.value).toBe('live_class_meet')
	})

	it('setFlow stores the choice per user and opens the panel', async () => {
		const o = await load()
		o.setFlow('onboard_learners')
		await nextTick()
		expect(localStorage.getItem('learningOnboardingFlow' + USER)).toBe(
			'onboard_learners'
		)
		expect(o.ui.showHelpModal.value).toBe(true)
		expect(o.ui.minimize.value).toBe(false)
	})

	it('shows the checklist until the active flow is done', async () => {
		const o = await load('live_class_zoom')
		await o.setUpAll(nav)
		expect(o.panelView.value).toBe('checklist')
		for (const step of handle('live_class_zoom').steps) step.completed = true
		expect(o.panelView.value).toBe('done')
	})

	it('treats a flow the framework marked complete as done', async () => {
		const o = await load('publish_course')
		await o.setUpAll(nav)
		handle('publish_course').isOnboardingStepsCompleted.value = true
		expect(o.panelView.value).toBe('done')
	})
})

describe('remainingCards', () => {
	const ids = (o: Awaited<ReturnType<typeof load>>) =>
		o.remainingCards.value.map((c) => c.id)

	it('lists unfinished cards in the active flow’s next order', async () => {
		const o = await load('live_class_zoom')
		await o.setUpAll(nav)
		expect(ids(o)).toEqual(['onboard_learners', 'publish_course'])
	})

	it('drops complete cards', async () => {
		const o = await load('live_class_zoom')
		await o.setUpAll(nav)
		handle('onboard_learners').isOnboardingStepsCompleted.value = true
		expect(ids(o)).toEqual(['publish_course'])
	})

	it('uses registry order with no active flow', async () => {
		const o = await load()
		await o.setUpAll(nav)
		expect(ids(o)).toEqual(['publish_course', 'onboard_learners', 'live_class'])
	})

	it('counts the live class done once either provider is done', async () => {
		const o = await load('publish_course')
		await o.setUpAll(nav)
		handle('live_class_meet').isOnboardingStepsCompleted.value = true
		expect(ids(o)).toEqual(['onboard_learners'])
		expect(o.isCardComplete('live_class')).toBe(true)
	})
})

describe('choosing a card', () => {
	it('starts a single-flow card straight away', async () => {
		const o = await load()
		await o.setUpAll(nav)
		o.chooseCard('onboard_learners')
		expect(o.activeFlowId.value).toBe('onboard_learners')
		expect(o.panelView.value).toBe('checklist')
	})

	it('asks for a provider before starting the live class', async () => {
		const o = await load()
		await o.setUpAll(nav)
		o.chooseCard('live_class')
		expect(o.activeFlowId.value).toBeNull()
		expect(o.panelView.value).toBe('provider')
		expect(o.providerFlows.value.map((f) => f.id)).toEqual([
			'live_class_zoom',
			'live_class_meet',
		])
		expect(o.ui.showHelpModal.value).toBe(true)
	})

	it('picking a provider makes it the active flow', async () => {
		const o = await load()
		await o.setUpAll(nav)
		o.chooseCard('live_class')
		o.setFlow('live_class_meet')
		expect(o.activeFlowId.value).toBe('live_class_meet')
		expect(o.panelView.value).toBe('checklist')
	})

	it('going back from the provider choice keeps the active flow', async () => {
		const o = await load('publish_course')
		await o.setUpAll(nav)
		for (const step of handle('publish_course').steps) step.completed = true
		o.chooseCard('live_class')
		o.cancelProvider()
		expect(o.activeFlowId.value).toBe('publish_course')
		expect(o.panelView.value).toBe('done')
	})

	it('closing the panel drops a half-made provider choice', async () => {
		const o = await load()
		await o.setUpAll(nav)
		o.chooseCard('live_class')
		o.closePanel()
		expect(o.panelView.value).toBe('picker')
	})
})

describe('refetching facts', () => {
	afterEach(() => vi.useRealTimers())

	it('refetches once after a burst of window focus events', async () => {
		vi.useFakeTimers()
		const o = await load()
		await o.setUpAll(nav)
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

	it('refetches when the panel opens again', async () => {
		vi.useFakeTimers()
		const o = await load()
		await o.setUpAll(nav)
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

describe('setUpAll', () => {
	it('registers every flow once', async () => {
		const o = await load()
		await o.setUpAll(nav)
		await o.setUpAll(nav)
		for (const key of [
			'publish_course',
			'onboard_learners',
			'live_class_zoom',
			'live_class_meet',
		])
			expect(handle(key).setUp).toHaveBeenCalledTimes(1)
	})

	it('does nothing for a guest', async () => {
		framework.guest = true
		const o = await load()
		await o.setUpAll(nav)
		expect(o.isSetUp.value).toBe(false)
		expect(callMock).not.toHaveBeenCalled()
	})

	it('opens the panel on load only for an unfinished active flow', async () => {
		const withFlow = await load('publish_course')
		await withFlow.setUpAll(nav)
		expect(withFlow.ui.showHelpModal.value).toBe(true)

		vi.resetModules()
		framework.handles = {}
		localStorage.clear()
		const withoutFlow = await load()
		await withoutFlow.setUpAll(nav)
		expect(withoutFlow.ui.showHelpModal.value).toBe(false)
	})

	it('syncs every flow once the shared status fetch settles', async () => {
		statusResource.current = reactive({ loading: true })
		const o = await load()
		const done = o.setUpAll(nav)
		await nextTick()
		expect(handle('live_class_zoom').syncStatus).not.toHaveBeenCalled()
		expect(callMock).not.toHaveBeenCalled()

		statusResource.current.loading = false
		await done
		for (const key of [
			'publish_course',
			'onboard_learners',
			'live_class_zoom',
			'live_class_meet',
		])
			expect(handle(key).syncStatus).toHaveBeenCalledTimes(1)
		expect(callMock).toHaveBeenCalledWith(
			'lms.lms.onboarding.get_onboarding_facts'
		)
	})

	it('applies the fetched facts', async () => {
		callMock.mockResolvedValue({ has_invited_student: true })
		const o = await load()
		await o.setUpAll(nav)
		expect(
			handle('onboard_learners').updateOnboardingStep
		).toHaveBeenCalledWith('invite_students')
	})

	it('swallows a facts failure', async () => {
		callMock.mockRejectedValue(new Error('403'))
		const o = await load()
		await expect(o.setUpAll(nav)).resolves.toBeUndefined()
		expect(o.isSetUp.value).toBe(true)
	})
})

describe('bannerFlow', () => {
	it('follows the active flow while it is unfinished', async () => {
		const o = await load('onboard_learners')
		await o.setUpAll(nav)
		expect(o.bannerFlow.value?.id).toBe('onboard_learners')
	})

	it('moves to the next unfinished flow once the active one is done', async () => {
		const o = await load('onboard_learners')
		await o.setUpAll(nav)
		handle('onboard_learners').isOnboardingStepsCompleted.value = true
		expect(o.bannerFlow.value?.id).toBe('live_class_zoom')
	})

	it('is hidden once every flow is done and dismissed', async () => {
		const o = await load('publish_course')
		await o.setUpAll(nav)
		for (const key of [
			'publish_course',
			'onboard_learners',
			'live_class_zoom',
			'live_class_meet',
		])
			handle(key).isOnboardingStepsCompleted.value = true
		expect(o.bannerFlow.value).toBeNull()
	})
})

describe('runDoneAction', () => {
	it('runs the active flow’s done action with the sidebar navigation', async () => {
		callMock.mockResolvedValue({ first_batch: 'b1' })
		const o = await load('live_class_meet')
		await o.setUpAll(nav)
		o.runDoneAction()
		expect(nav.openRoute).toHaveBeenCalledWith({
			name: 'BatchDetail',
			params: { batchName: 'b1' },
		})
	})

	it('does nothing before set-up', async () => {
		nav.openRoute.mockClear()
		const o = await load('live_class_zoom')
		o.runDoneAction()
		expect(nav.openRoute).not.toHaveBeenCalled()
	})
})

describe('moving between all flows and the current one', () => {
	it('shows all flows over an unfinished flow without dropping it', async () => {
		const o = await load('onboard_learners')
		await o.setUpAll(nav)
		o.showAllFlows()
		expect(o.panelView.value).toBe('picker')
		expect(o.activeFlowId.value).toBe('onboard_learners')
		expect(o.resumableFlow.value?.id).toBe('onboard_learners')
	})

	it('continue returns to the checklist', async () => {
		const o = await load('onboard_learners')
		await o.setUpAll(nav)
		o.showAllFlows()
		o.continueFlow()
		expect(o.panelView.value).toBe('checklist')
	})

	it('picking another flow from all flows switches to it', async () => {
		const o = await load('onboard_learners')
		await o.setUpAll(nav)
		o.showAllFlows()
		o.chooseCard('publish_course')
		expect(o.activeFlowId.value).toBe('publish_course')
		expect(o.panelView.value).toBe('checklist')
	})

	it('lists every card but the one being continued', async () => {
		const o = await load('onboard_learners')
		await o.setUpAll(nav)
		expect(o.pickerCards.value.map((c) => c.id)).toEqual([
			'publish_course',
			'live_class',
		])
		handle('onboard_learners').isOnboardingStepsCompleted.value = true
		expect(o.resumableFlow.value).toBeNull()
		expect(o.pickerCards.value).toHaveLength(3)
	})

	it('reopening the panel goes back to the checklist', async () => {
		const o = await load('onboard_learners')
		await o.setUpAll(nav)
		o.showAllFlows()
		o.closePanel()
		expect(o.panelView.value).toBe('checklist')
	})
})

describe('cardProgress', () => {
	it('counts a single-flow card’s steps', async () => {
		const o = await load()
		await o.setUpAll(nav)
		handle('publish_course').steps[0].completed = true
		expect(o.cardProgress(o.pickerCards.value[0])).toEqual({
			completed: 1,
			total: 6,
		})
	})

	it('has no count for a live class with no provider started', async () => {
		const o = await load()
		await o.setUpAll(nav)
		expect(o.cardProgress(o.pickerCards.value[2])).toBeNull()
	})

	it('follows the provider that has been started', async () => {
		const o = await load()
		await o.setUpAll(nav)
		handle('live_class_meet').steps[1].completed = true
		expect(o.cardProgress(o.pickerCards.value[2])).toEqual({
			completed: 1,
			total: 6,
		})
	})
})

describe('skipAllFlows', () => {
	it('skips exactly the unfinished flows and closes the panel', async () => {
		const o = await load('publish_course')
		await o.setUpAll(nav)
		for (const step of handle('publish_course').steps) step.completed = true
		handle('live_class_zoom').isOnboardingStepsCompleted.value = true
		o.ui.showHelpModal.value = true

		o.skipAllFlows()

		expect(handle('publish_course').skipAll).not.toHaveBeenCalled()
		expect(handle('live_class_zoom').skipAll).not.toHaveBeenCalled()
		expect(handle('onboard_learners').skipAll).toHaveBeenCalledTimes(1)
		expect(handle('live_class_meet').skipAll).toHaveBeenCalledTimes(1)
		expect(o.ui.showHelpModal.value).toBe(false)
	})

	it('leaves nothing for the banner or the picker to offer', async () => {
		const o = await load('publish_course')
		await o.setUpAll(nav)
		o.skipAllFlows()
		expect(o.remainingCards.value).toHaveLength(0)
		expect(o.panelView.value).toBe('done')
	})
})
