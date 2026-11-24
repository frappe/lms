/**
 * Setup.vue: the fresh-site admin's setup page. SetupFlow is stubbed to render
 * one step and expose its `done` and `finish`, so the test drives the page's
 * own wiring: saving the goal and routing to it.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

const {
	callMock,
	captureMock,
	listResourceMock,
	replaceMock,
	toastError,
	setupState,
} = vi.hoisted(() => ({
	callMock: vi.fn(() => Promise.resolve()),
	listResourceMock: vi.fn((_options: Record<string, unknown>) => ({
		reload: () => Promise.resolve([{ name: 'demo-batch' }]),
	})),
	captureMock: vi.fn(),
	replaceMock: vi.fn(),
	toastError: vi.fn(),
	setupState: { data: { can_send_email: true } as Record<string, unknown> },
}))

vi.mock('frappe-ui', () => ({
	Button: defineComponent({ setup: () => () => h('button') }),
	call: callMock,
	createListResource: listResourceMock,
	createResource: (options: { onSuccess?: (data: unknown) => void }) => {
		options.onSuccess?.(setupState.data)
		return { fetched: true, data: setupState.data }
	},
	toast: { error: toastError },
	usePageMeta: vi.fn(),
}))
const telemetry = vi.hoisted(() => ({ on: null as unknown as { value: boolean } }))
vi.mock('@framework/ui/telemetry/index', async () => {
	const { reactive, ref } = await import('vue')
	telemetry.on = ref(true)
	return {
		useTelemetry: () => reactive({ capture: captureMock, isEnabled: telemetry.on }),
	}
})
vi.mock('@/components/Setup/SetupPreview.vue', () => ({
	default: defineComponent({ setup: () => () => h('div') }),
}))
const brandReload = vi.fn()
vi.mock('@/stores/session', () => ({
	sessionStore: () => ({
		branding: {
			data: { app_name: 'Frappe', banner_image: null },
			reload: brandReload,
		},
	}),
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
// The step the stand-in flow shows; by default the password, else the goal.
let shownType: string | null = null

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
	SetupPreviewFrame: defineComponent({ setup: () => () => h('div') }),
	BrandStep: defineComponent({
		props: ['labels', 'save', 'name', 'logo'],
		emits: ['done', 'update:name', 'update:logo'],
		setup:
			(props, { emit }) =>
			() =>
				h('button', {
					class: 'brand',
					onClick: () =>
						props
							.save({ name: 'Acme Academy', logo: '/files/acme.png' })
							.then(() => emit('done')),
				}),
	}),
	PasswordStep: defineComponent({
		props: ['labels'],
		emits: ['done', 'input'],
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
			previewSide: String,
		},
		emits: ['finish'],
		setup(props: { steps: { type: string }[] }, { slots, emit }) {
			givenSteps = props.steps as typeof givenSteps
			const goal =
				props.steps.find((step) => step.type === shownType) ||
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
			provide: {
				$user: {
					data: { name: 'owner@example.com', sitename: 'learn.example.com' },
				},
				$dayjs: () => ({ format: () => '2026-11-18' }),
			},
			stubs: { LMSLogo: true, PersonaToolIcon: true },
		},
	})
}

describe('Setup', () => {
	beforeEach(() => {
		callMock.mockReset()
		callMock.mockImplementation(() => Promise.resolve())
		replaceMock.mockClear()
		captureMock.mockClear()
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
			'Onboard my existing learners',
		)
		// In the app, not a full load: the sidebar that builds the checklist mounts with it.
		expect(replaceMock).toHaveBeenCalledWith({ name: 'Batches' })
		expect(window.location.href).toBe('')
	})

	it('stays on the page and says so when saving fails', async () => {
		callMock.mockImplementation((method: string) =>
			method === 'lms.lms.onboarding.save_setup'
				? Promise.reject({
						messages: ['Pick one of the goals shown in setup.'],
					})
				: Promise.resolve(),
		)
		const wrapper = await mountPage()
		await wrapper.find('.goal').trigger('click')
		flow.finish()
		await flushPromises()

		expect(toastError).toHaveBeenCalledWith(
			'Pick one of the goals shown in setup.',
		)
		expect(window.location.href).toBe('')
		expect(replaceMock).not.toHaveBeenCalled()
		expect(localStorage.getItem('lmsFirstGoal')).toBeNull()
		expect(callMock).not.toHaveBeenCalledWith(
			'lms.lms.api.capture_user_persona',
			expect.anything(),
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
		expect(givenSteps[1].name).toBe('brand')
		expect(givenSteps.at(-1)?.name).toBe('invite_team')
	})

	it('saves the name and logo through the setup endpoint', async () => {
		setupState.data = { can_send_email: true, needs_questions: true }
		shownType = 'brand'
		try {
			const wrapper = await mountPage()
			await wrapper.find('.brand').trigger('click')
			await flushPromises()
			expect(callMock).toHaveBeenCalledWith('lms.lms.onboarding.save_brand', {
				name: 'Acme Academy',
				logo: '/files/acme.png',
			})
			expect(brandReload).toHaveBeenCalled()
		} finally {
			shownType = null
		}
	})

	it('fills the list the landing page reuses, so it opens without loading cards', async () => {
		window.matchMedia = vi.fn(() => ({
			matches: true,
		})) as unknown as typeof window.matchMedia
		const wrapper = await mountPage()
		await wrapper.find('.goal').trigger('click')
		flow.finish()
		await flushPromises()

		expect(listResourceMock).toHaveBeenCalledWith(
			expect.objectContaining({
				url: 'lms.lms.utils.get_batches',
				cache: ['batches', 'owner@example.com'],
				filters: { end_date: ['>=', '2026-11-18'], published: 1 },
			}),
		)
		// @ts-expect-error jsdom has no matchMedia; the other tests run as a narrow screen.
		delete window.matchMedia
	})

	describe('the start event, which telemetry drops while it loads', () => {
		it('is sent once telemetry is on, when it was still off as setup opened', async () => {
			setupState.data = { can_send_email: true, needs_questions: true }
			await import('@framework/ui/telemetry/index')
			telemetry.on.value = false
			try {
				await mountPage()
				await flushPromises()
				expect(captureMock).not.toHaveBeenCalledWith('setup_started')

				telemetry.on.value = true
				await flushPromises()
				expect(captureMock).toHaveBeenCalledWith('setup_started')
				// The first step, which on a site with a password is the brand step.
				expect(captureMock).toHaveBeenCalledWith('setup_step_viewed', {
					step: 'brand',
				})
			} finally {
				telemetry.on.value = true
			}
		})

		it('is left to SetupFlow when telemetry was already on', async () => {
			setupState.data = { can_send_email: true, needs_questions: true }
			await mountPage()
			await flushPromises()
			expect(captureMock).not.toHaveBeenCalledWith('setup_started')
		})
	})
})
