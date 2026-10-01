/**
 * OnboardingChecklist: the framework's OnboardingSteps, copied into LMS so each
 * step's icon can be a tick toggle. State still lives in `useOnboarding`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { getFlow } from '@/onboarding/flows'
import OnboardingChecklist from '@/components/Onboarding/OnboardingChecklist.vue'

type FakeStep = {
	name: string
	title: string
	completed: boolean
	dependsOn?: string
	onClick?: () => void
}

const { framework, capture } = vi.hoisted(() => ({
	framework: {} as {
		steps: FakeStep[]
		updateOnboardingStep: ReturnType<typeof vi.fn>
		reset: ReturnType<typeof vi.fn>
		skip: ReturnType<typeof vi.fn>
		skipAll: ReturnType<typeof vi.fn>
		resetAll: ReturnType<typeof vi.fn>
		key: string | null
	},
	capture: vi.fn(),
}))

vi.mock('@framework/ui/components/Onboarding/index', async () => {
	const { computed: vueComputed } = await import('vue')
	return {
		useOnboarding: (key: string) => {
			framework.key = key
			return {
				steps: framework.steps,
				stepsCompleted: vueComputed(
					() => framework.steps.filter((s) => s.completed).length
				),
				totalSteps: vueComputed(() => framework.steps.length),
				completedPercentage: vueComputed(() =>
					Math.floor(
						(framework.steps.filter((s) => s.completed).length /
							framework.steps.length) *
							100
					)
				),
				updateOnboardingStep: framework.updateOnboardingStep,
				reset: framework.reset,
				skip: framework.skip,
				skipAll: framework.skipAll,
				resetAll: framework.resetAll,
			}
		},
	}
})

vi.mock('@framework/ui/telemetry/index', () => ({
	useTelemetry: () => ({ capture }),
}))

vi.mock('frappe-ui', () => ({
	Badge: { props: ['label', 'theme'], template: '<span>{{ label }}</span>' },
	Button: {
		props: ['label', 'variant'],
		emits: ['click'],
		template: `<button type="button" @click="$emit('click', $event)">{{ label }}<slot /></button>`,
	},
	Tooltip: { props: ['text'], template: '<div :title="text"><slot /></div>' },
}))

vi.mock('@/components/Icons/LMSLogo.vue', () => ({
	default: { template: '<svg />' },
}))

const flow = getFlow('live_class_meet')!
const open = vi.fn()

beforeEach(() => {
	open.mockReset()
	framework.key = null
	framework.steps = reactive([
		{ name: 'create_first_batch', title: 'Create', completed: true },
		{
			name: 'setup_google_api',
			title: 'Google API',
			completed: false,
			onClick: open,
		},
		{
			name: 'connect_google_calendar',
			title: 'Calendar',
			completed: false,
			dependsOn: 'setup_google_api',
			onClick: open,
		},
	])
	for (const fn of [
		'updateOnboardingStep',
		'reset',
		'skip',
		'skipAll',
		'resetAll',
	] as const)
		framework[fn] = vi.fn()
})

function mountChecklist() {
	return mount(OnboardingChecklist, { props: { flow } })
}

const toggles = (w: ReturnType<typeof mountChecklist>) =>
	w.findAll('[data-testid="step-toggle"]')

describe('OnboardingChecklist', () => {
	it('reads the flow’s own framework key', () => {
		mountChecklist()
		expect(framework.key).toBe('learning_live_class_meet')
	})

	it('shows progress like the framework checklist', () => {
		const w = mountChecklist()
		expect(w.text()).toContain('1/3 steps completed')
		expect(w.text()).toContain('33% completed')
	})

	it('ticks an incomplete step from its icon', async () => {
		const w = mountChecklist()
		await toggles(w)[1].trigger('click')
		expect(framework.updateOnboardingStep).toHaveBeenCalledWith(
			'setup_google_api',
			true
		)
		expect(open).not.toHaveBeenCalled()
	})

	it('un-ticks a complete step from its icon', async () => {
		const w = mountChecklist()
		await toggles(w)[0].trigger('click')
		expect(framework.reset).toHaveBeenCalledWith(
			'create_first_batch',
			expect.any(Function)
		)
	})

	it('names and states each toggle', () => {
		const w = mountChecklist()
		expect(toggles(w)[0].attributes('aria-pressed')).toBe('true')
		expect(toggles(w)[0].attributes('aria-label')).toBe(
			'Mark Create as not done'
		)
		expect(toggles(w)[1].attributes('aria-pressed')).toBe('false')
		expect(toggles(w)[1].attributes('aria-label')).toBe(
			'Mark Google API as done'
		)
	})

	it('disables the icon of a blocked step', async () => {
		const w = mountChecklist()
		const blocked = toggles(w)[2]
		expect(blocked.attributes('disabled')).toBeDefined()
		await blocked.trigger('click')
		expect(framework.updateOnboardingStep).not.toHaveBeenCalled()
	})

	it('explains why a step is blocked', () => {
		const w = mountChecklist()
		expect(w.html()).toContain(
			'You need to complete &quot;Google API&quot; first.'
		)
	})

	it('opens an unblocked step from its title', async () => {
		const w = mountChecklist()
		const titles = w.findAll('[data-testid="step-open"]')
		await titles[1].trigger('click')
		expect(open).toHaveBeenCalledTimes(1)
		await titles[2].trigger('click')
		expect(open).toHaveBeenCalledTimes(1)
	})

	it('skips and resets everything through the framework', async () => {
		const w = mountChecklist()
		const button = (label: string) =>
			w.findAll('button').find((b) => b.text() === label)!
		await button('Skip all').trigger('click')
		expect(framework.skipAll).toHaveBeenCalledTimes(1)
		await button('Reset all').trigger('click')
		expect(framework.resetAll).toHaveBeenCalledTimes(1)
	})
})
