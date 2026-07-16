/**
 * Tests for PersonaForm.vue — the onboarding container that owns the step data
 * and the persist/telemetry/route wiring. PersonaCard is stubbed so we can drive
 * its `complete` and `choose` events directly and observe the side effects.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const { callMock, captureMock, pushMock } = vi.hoisted(() => ({
	callMock: vi.fn(() => Promise.resolve()),
	captureMock: vi.fn(),
	pushMock: vi.fn(),
}))

vi.mock('frappe-ui', () => ({
	call: callMock,
	usePageMeta: vi.fn(),
}))
vi.mock('frappe-ui/frappe', () => ({
	useTelemetry: () => ({ capture: captureMock }),
}))
vi.mock('vue-router', () => ({
	useRouter: () => ({ push: pushMock }),
}))
vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ brand: { favicon: '' } }),
}))

// Stub PersonaCard: expose its emits so tests can trigger the wiring. The
// factory is hoisted above imports, so build the stub self-contained here.
vi.mock('@/components/Persona/PersonaCard.vue', async () => {
	const { h } = await import('vue')
	return {
		default: {
			name: 'PersonaCard',
			props: ['steps'],
			emits: ['complete', 'choose'],
			setup(_: any, { emit }: any) {
				return () =>
					h('div', { class: 'persona-card-stub' }, [
						h('button', {
							class: 'do-complete',
							onClick: () =>
								emit('complete', {
									usage_context: 'School',
									current_tool: 'Notion',
								}),
						}),
						h('button', {
							class: 'do-choose',
							onClick: () =>
								emit(
									'choose',
									{ key: 'first_milestone' },
									{
										value: 'Publish',
										route: { name: 'Courses' },
									}
								),
						}),
					])
			},
		},
	}
})

import PersonaForm from '@/pages/PersonaForm.vue'

function mountForm() {
	return mount(PersonaForm, {
		global: {
			provide: { $user: { data: { sitename: 'test.site' } } },
			mocks: { __: (s: string) => s },
		},
	})
}

beforeEach(() => {
	;(window as any).__ = (s: string) => s
	callMock.mockClear()
	captureMock.mockClear()
	pushMock.mockClear()
	vi.useFakeTimers()
})

describe('PersonaForm', () => {
	it('builds all three steps with the expected keys/types', () => {
		const wrapper = mountForm()
		const steps = wrapper.findComponent({ name: 'PersonaCard' }).props('steps')
		expect(steps.map((s: any) => s.key)).toEqual([
			'discovery_source',
			'usage_context',
			'current_tool',
			'first_milestone',
		])
		expect(steps.map((s: any) => s.type)).toEqual([
			'tags',
			'tags',
			'tags',
			'outcome',
		])
		// Tool step carries brand icon keys; outcome carries routes.
		expect(steps[2].options[0].icon).toBe('moodle')
		expect(steps[3].options[0].route).toEqual({ name: 'Courses' })
	})

	it('on complete: holds the answers, sends nothing yet', async () => {
		const wrapper = mountForm()
		await wrapper.find('.do-complete').trigger('click')
		await flushPromises()

		expect(captureMock).not.toHaveBeenCalled()
		expect(callMock).not.toHaveBeenCalled()
	})

	it('on choose: submits once with the original key set and routes', async () => {
		const wrapper = mountForm()
		await wrapper.find('.do-complete').trigger('click')
		await wrapper.find('.do-choose').trigger('click')
		await flushPromises()

		// One submission, keys exactly as before the redesign — the outcome
		// row IS the first_milestone answer.
		expect(captureMock).toHaveBeenCalledWith('onboarding_persona', {
			usage_context: 'School',
			current_tool: 'Notion',
			first_milestone: 'Publish',
		})
		const persona = callMock.mock.calls.find(
			(c) => c[0] === 'lms.lms.api.capture_user_persona'
		)
		expect(JSON.parse(persona![1].responses)).toEqual({
			site: 'test.site',
			usage_context: 'School',
			current_tool: 'Notion',
			first_milestone: 'Publish',
		})
		const persist = callMock.mock.calls.find(
			(c) => c[0] === 'frappe.client.set_value'
		)
		expect(persist![1]).toMatchObject({
			fieldname: 'persona_captured',
			value: 1,
		})
		// Route happens after the fade timeout and the persist settles.
		expect(pushMock).not.toHaveBeenCalled()
		vi.runAllTimers()
		await flushPromises()
		expect(pushMock).toHaveBeenCalledWith({ name: 'Courses' })
	})

	it('ignores further choose/skip clicks while fading out', async () => {
		const wrapper = mountForm()
		await wrapper.find('.do-choose').trigger('click')
		// Second row click and a Skip click land during the fade window.
		await wrapper.find('.do-choose').trigger('click')
		await wrapper.find('button[type="button"]').trigger('click')
		await flushPromises()

		// Single submission, single persist, single navigation.
		expect(captureMock).toHaveBeenCalledTimes(1)
		expect(
			callMock.mock.calls.filter((c) => c[0] === 'frappe.client.set_value')
		).toHaveLength(1)
		vi.runAllTimers()
		await flushPromises()
		expect(pushMock).toHaveBeenCalledTimes(1)
	})

	it('skip persists the flag and routes Home', async () => {
		const wrapper = mountForm()
		await wrapper.find('button[type="button"]').trigger('click')
		await flushPromises()
		// Nothing answered yet — nothing to submit.
		expect(captureMock).not.toHaveBeenCalled()
		const persist = callMock.mock.calls.find(
			(c) => c[0] === 'frappe.client.set_value'
		)
		expect(persist).toBeTruthy()
		vi.runAllTimers()
		await flushPromises()
		expect(pushMock).toHaveBeenCalledWith({ name: 'Home' })
	})

	it('skip on the outcome screen still submits the collected answers', async () => {
		const wrapper = mountForm()
		await wrapper.find('.do-complete').trigger('click')
		await wrapper.find('button[type="button"]').trigger('click')
		await flushPromises()

		// Answered questions are not discarded; keys stay a subset of the
		// original payload (no first_milestone, since it was skipped).
		expect(captureMock).toHaveBeenCalledWith('onboarding_persona', {
			usage_context: 'School',
			current_tool: 'Notion',
		})
		const persona = callMock.mock.calls.find(
			(c) => c[0] === 'lms.lms.api.capture_user_persona'
		)
		expect(JSON.parse(persona![1].responses)).toEqual({
			site: 'test.site',
			usage_context: 'School',
			current_tool: 'Notion',
		})
		vi.runAllTimers()
		await flushPromises()
		expect(pushMock).toHaveBeenCalledWith({ name: 'Home' })
	})
})
