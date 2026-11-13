/**
 * Setup.vue: the fresh-site admin's setup page. SetupFlow is stubbed to render
 * one step and expose its `done` and `finish`, so the test drives the page's
 * own wiring: saving the goal and routing to it.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

const { callMock, captureMock, replaceMock, toastError, setupState } =
	vi.hoisted(() => ({
		callMock: vi.fn(() => Promise.resolve()),
		captureMock: vi.fn(),
		replaceMock: vi.fn(),
		toastError: vi.fn(),
		setupState: { data: { can_send_email: true } as Record<string, unknown> },
	}))

vi.mock('frappe-ui', () => ({
	Button: defineComponent({ setup: () => () => h('button') }),
	call: callMock,
	createResource: (options: { onSuccess?: (data: unknown) => void }) => {
		options.onSuccess?.(setupState.data)
		return { fetched: true, data: setupState.data }
	},
	toast: { error: toastError },
	usePageMeta: vi.fn(),
}))
vi.mock('@framework/ui/telemetry/index', () => ({
	useTelemetry: () => ({ capture: captureMock }),
}))
vi.mock('@/components/Setup/SetupPreview.vue', () => ({
	default: defineComponent({ setup: () => () => h('div') }),
}))
vi.mock('@/components/Setup/SetupInvite.vue', () => ({
	default: defineComponent({ setup: () => () => h('div') }),
}))
vi.mock('vue-router', () => ({
	useRouter: () => ({
		resolve: (route: { name: string }) => ({ href: `/lms/${route.name}` }),
		replace: replaceMock,
	}),
}))

let flow: { done: (details?: object) => void; finish: () => void }

let givenSteps: { name: string; type: string; required?: boolean }[] = []

vi.mock('@framework/ui/components/SetupFlow/index', () => ({
	TelemetryConsent: defineComponent({ setup: () => () => h('div') }),
	ChoiceStep: defineComponent({
		props: ['options', 'modelValue'],
		setup: () => () => h('div'),
	}),
	ListStep: defineComponent({
		props: ['options'],
		emits: ['choose'],
		setup:
			(props, { emit }) =>
			() =>
				h('button', {
					class: 'goal',
					onClick: () => emit('choose', props.options[1]),
				}),
	}),
	PasswordStep: defineComponent({
		props: ['labels'],
		emits: ['done'],
		setup:
			(_props, { emit }) =>
			() =>
				h('button', { class: 'password', onClick: () => emit('done') }),
	}),
	SetupFlow: defineComponent({
		props: {
			steps: { type: Array, required: true },
			labels: Object,
			backButton: Boolean,
		},
		emits: ['finish'],
		setup(props: { steps: { type: string }[] }, { slots, emit }) {
			givenSteps = props.steps as typeof givenSteps
			const goal =
				props.steps.find((step) => step.type === 'password') ||
				props.steps.find((step) => step.type === 'outcome')
			return () =>
				slots.step?.({
					step: goal,
					done: (details: object) => {
						flow = { done: () => {}, finish: () => emit('finish', details) }
					},
					skip: () => {},
					back: () => {},
					canGoBack: false,
				})
		},
	}),
}))
const mountPage = async () => {
	const { default: Setup } = await import('@/pages/Setup.vue')
	return mount(Setup, {
		global: {
			provide: { $user: { data: { sitename: 'learn.example.com' } } },
			stubs: { LMSLogo: true, PersonaToolIcon: true },
		},
	})
}

describe('Setup', () => {
	beforeEach(() => {
		callMock.mockReset()
		callMock.mockImplementation(() => Promise.resolve())
		replaceMock.mockClear()
		toastError.mockClear()
		setupState.data = { can_send_email: true }
		Object.defineProperty(window, 'location', {
			value: { href: '' },
			writable: true,
			configurable: true,
		})
		localStorage.clear()
	})

	it('saves the goal and opens where it starts', async () => {
		const wrapper = await mountPage()
		await wrapper.find('.goal').trigger('click')
		flow.finish()
		await flushPromises()

		expect(callMock).toHaveBeenCalledWith('lms.lms.onboarding.save_setup', {
			first_goal: 'Onboard my existing learners',
		})
		expect(localStorage.getItem('lmsFirstGoal')).toBe(
			'Onboard my existing learners'
		)
		expect(window.location.href).toBe('/lms/Batches')
	})

	it('stays on the page and says so when saving fails', async () => {
		callMock.mockImplementation((method: string) =>
			method === 'lms.lms.onboarding.save_setup'
				? Promise.reject({ messages: ['Pick one of the goals shown in setup.'] })
				: Promise.resolve()
		)
		const wrapper = await mountPage()
		await wrapper.find('.goal').trigger('click')
		flow.finish()
		await flushPromises()

		expect(toastError).toHaveBeenCalledWith(
			'Pick one of the goals shown in setup.'
		)
		expect(window.location.href).toBe('')
		expect(localStorage.getItem('lmsFirstGoal')).toBeNull()
		expect(callMock).not.toHaveBeenCalledWith(
			'lms.lms.api.capture_user_persona',
			expect.anything()
		)
	})

	it('sends a direct visit to the desk wizard while the site is not set up', async () => {
		setupState.data = { needs_setup: true, setup_url: '/desk/setup-wizard' }
		const wrapper = await mountPage()

		expect(window.location.href).toBe('/desk/setup-wizard')
		expect(wrapper.find('.goal').exists()).toBe(false)
	})

	it('goes home when nothing is left to set up', async () => {
		setupState.data = {
			needs_setup: false,
			needs_password: false,
			needs_questions: false,
		}
		const wrapper = await mountPage()

		expect(replaceMock).toHaveBeenCalledWith({ name: 'Home' })
		expect(wrapper.find('.goal').exists()).toBe(false)
	})

	it('asks a site owner without a password for one first, and for nothing else once set up', async () => {
		setupState.data = {
			can_send_email: true,
			needs_password: true,
			needs_questions: false,
		}
		const wrapper = await mountPage()
		expect(givenSteps.map((step) => step.name)).toEqual(['password'])
		expect(givenSteps[0].required).toBe(true)
		expect(wrapper.find('.password').exists()).toBe(true)
	})

	it('puts the password before the questions on a fresh site', async () => {
		setupState.data = {
			can_send_email: true,
			needs_password: true,
			needs_questions: true,
		}
		await mountPage()
		expect(givenSteps[0].name).toBe('password')
		expect(givenSteps.at(-1)?.name).toBe('invite_team')
	})
})
