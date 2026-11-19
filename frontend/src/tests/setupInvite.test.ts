/**
 * SetupInvite.vue: the setup step that invites the owner's first people. The inputs are
 * plain elements here, so the test types into them and reads what the step reports.
 */
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'

vi.mock('frappe-ui', () => ({
	Button: defineComponent({
		props: ['ariaLabel'],
		setup:
			(props, { slots }) =>
			() =>
				h('button', { 'aria-label': props.ariaLabel }, slots.default?.()),
	}),
	ErrorMessage: defineComponent({ setup: () => () => h('p') }),
	FormControl: defineComponent({
		props: ['modelValue', 'type', 'options'],
		emits: ['update:modelValue'],
		setup:
			(props, { emit }) =>
			() =>
				h('input', {
					'data-type': props.type,
					value: props.modelValue,
					onInput: (event: Event) =>
						emit('update:modelValue', (event.target as HTMLInputElement).value),
				}),
	}),
	toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('@framework/ui/components/InviteUser/index', () => ({
	useInviteUser: () => ({ invite: vi.fn() }),
}))
vi.mock('@framework/ui/components/Onboarding/index', () => ({
	useOnboarding: () => ({}),
}))
vi.mock('@/utils', () => ({ validateEmail: (email: string) => email.includes('@') }))
vi.mock('@/utils/basePath', () => ({ getLmsBasePath: () => 'lms' }))

async function mountStep(props: Record<string, unknown> = {}) {
	const { default: SetupInvite } = await import('@/components/Setup/SetupInvite.vue')
	return mount(SetupInvite, { props, global: { mocks: { __: (text: string) => text } } })
}

async function type(input: Element, value: string) {
	;(input as HTMLInputElement).value = value
	input.dispatchEvent(new Event('input'))
	await nextTick()
}

describe('SetupInvite', () => {
	it('starts with a Course Creator, then a Student', async () => {
		const wrapper = await mountStep()
		const roles = wrapper.findAll('input[data-type="select"]')

		expect(roles.map((role) => (role.element as HTMLInputElement).value)).toEqual([
			'Course Creator',
			'LMS Student',
		])
	})

	it('reports each typed person with their role, and again when a role changes', async () => {
		const wrapper = await mountStep()
		const [email, role] = wrapper.findAll('input').map((input) => input.element)

		await type(email, 'asha@example.com')
		await type(role, 'Moderator')

		expect(wrapper.emitted('invitees')).toEqual([
			[[{ email: 'asha@example.com', role: 'Course Creator' }]],
			[[{ email: 'asha@example.com', role: 'Moderator' }]],
		])
	})

	it('starts with the role the goal suggests, until a name is typed', async () => {
		const wrapper = await mountStep({ firstRole: 'Batch Evaluator' })
		const firstRole = () => (wrapper.find('input[data-type="select"]').element as HTMLInputElement).value
		expect(firstRole()).toBe('Batch Evaluator')

		await wrapper.setProps({ firstRole: 'Course Creator' })
		expect(firstRole()).toBe('Course Creator')

		await type(wrapper.find('input').element, 'asha@example.com')
		await wrapper.setProps({ firstRole: 'Batch Evaluator' })
		expect(firstRole()).toBe('Course Creator')
	})

	it('removes a row, and keeps the last one', async () => {
		const wrapper = await mountStep()
		const removeButtons = () => wrapper.findAll('button[aria-label^="Remove"]')
		expect(removeButtons()).toHaveLength(2)

		await type(wrapper.find('input[data-type="email"]').element, 'asha@example.com')
		await removeButtons()[0].trigger('click')

		const roles = wrapper.findAll('input[data-type="select"]')
		expect(roles.map((role) => (role.element as HTMLInputElement).value)).toEqual(['LMS Student'])
		expect(wrapper.emitted('invitees')?.at(-1)).toEqual([[]])
		expect(removeButtons()).toHaveLength(0)
	})
})
