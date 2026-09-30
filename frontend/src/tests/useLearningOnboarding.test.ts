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

afterEach(() => {
	document.cookie = 'user_id=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
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
		expect(handle('live_class').updateOnboardingStep).toHaveBeenCalledWith(
			'create_first_batch'
		)
		expect(handle('publish_course').updateOnboardingStep).not.toHaveBeenCalled()
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
		const o = await load('live_class')
		expect(o.activeFlowId.value).toBe('live_class')
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
		const o = await load('live_class')
		await o.setUpAll(nav)
		expect(o.panelView.value).toBe('checklist')
		for (const step of handle('live_class').steps) step.completed = true
		expect(o.panelView.value).toBe('done')
	})

	it('treats a flow the framework marked complete as done', async () => {
		const o = await load('publish_course')
		await o.setUpAll(nav)
		handle('publish_course').isOnboardingStepsCompleted.value = true
		expect(o.panelView.value).toBe('done')
	})
})

describe('remainingFlows', () => {
	it('lists unfinished flows in the active flow’s next order', async () => {
		const o = await load('live_class')
		await o.setUpAll(nav)
		expect(o.remainingFlows.value.map((f) => f.id)).toEqual([
			'onboard_learners',
			'publish_course',
		])
	})

	it('drops complete flows', async () => {
		const o = await load('live_class')
		await o.setUpAll(nav)
		handle('onboard_learners').isOnboardingStepsCompleted.value = true
		expect(o.remainingFlows.value.map((f) => f.id)).toEqual(['publish_course'])
	})

	it('uses registry order with no active flow', async () => {
		const o = await load()
		await o.setUpAll(nav)
		expect(o.remainingFlows.value.map((f) => f.id)).toEqual([
			'publish_course',
			'onboard_learners',
			'live_class',
		])
	})
})

describe('setUpAll', () => {
	it('registers every flow once', async () => {
		const o = await load()
		await o.setUpAll(nav)
		await o.setUpAll(nav)
		for (const key of ['publish_course', 'onboard_learners', 'live_class'])
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
		expect(handle('live_class').syncStatus).not.toHaveBeenCalled()
		expect(callMock).not.toHaveBeenCalled()

		statusResource.current.loading = false
		await done
		for (const key of ['publish_course', 'onboard_learners', 'live_class'])
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
		expect(o.bannerFlow.value?.id).toBe('live_class')
	})

	it('is hidden once every flow is done and dismissed', async () => {
		const o = await load('publish_course')
		await o.setUpAll(nav)
		for (const key of ['publish_course', 'onboard_learners', 'live_class'])
			handle(key).isOnboardingStepsCompleted.value = true
		expect(o.bannerFlow.value).toBeNull()
	})
})
