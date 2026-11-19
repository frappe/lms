/**
 * PendingInvites.vue: Settings > Invites, laid out like Helpdesk's invite page. The fields are
 * plain elements here, so the test types into them, submits, and reads what the page shows.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
const onboarding = vi.hoisted(() => ({ updateOnboardingStep: vi.fn() }))
const invites = vi.hoisted(() => ({ store: null as any }))

vi.mock('frappe-ui', () => ({
	toast,
	call: vi.fn(),
	Button: defineComponent({
		props: ['label', 'ariaLabel', 'type', 'disabled'],
		emits: ['click'],
		setup: (props, { emit }) => () =>
			h(
				'button',
				{
					type: props.type || 'button',
					disabled: props.disabled,
					'aria-label': props.ariaLabel,
					onClick: () => emit('click'),
				},
				props.label
			),
	}),
	ErrorMessage: defineComponent({
		props: ['message'],
		setup: (props) => () => h('p', { class: 'error' }, props.message),
	}),
	FormControl: defineComponent({
		props: ['modelValue', 'type', 'options'],
		emits: ['update:modelValue'],
		setup: (props, { emit }) => () =>
			h(
				props.type === 'select' ? 'select' : 'textarea',
				{
					value: props.modelValue,
					onInput: (event: Event) =>
						emit('update:modelValue', (event.target as HTMLInputElement).value),
					onChange: (event: Event) =>
						emit('update:modelValue', (event.target as HTMLInputElement).value),
				},
				(props.options || []).map((option: { value: string; label: string }) =>
					h('option', { value: option.value }, option.label)
				)
			),
	}),
}))
vi.mock('@/utils', () => ({
	cleanError: (message: string) => message,
	validateEmail: (email: string) => /^\S+@\S+\.\S+$/.test(email),
}))
vi.mock('@/utils/basePath', () => ({ getLmsBasePath: () => 'lms' }))
vi.mock('@/utils/dialogs', () => ({ createDialog: vi.fn() }))
vi.mock('@framework/ui/components/InviteUser/index', () => ({
	useInviteUser: () => invites.store,
}))
vi.mock('@framework/ui/components/Onboarding/index', () => ({
	useOnboarding: () => onboarding,
}))
vi.mock('@/components/Settings/Members/Members.vue', () => ({
	default: defineComponent({ render: () => null }),
}))
vi.mock('@/components/Layouts/settings/desktop/SettingsLayout.vue', () => ({
	default: defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) }),
}))

const RESULT = {
	invited_emails: [] as string[],
	pending_invite_emails: [] as string[],
	accepted_invite_emails: [] as string[],
	disabled_user_emails: [] as string[],
}

async function mountPage() {
	const { default: PendingInvites } = await import(
		'@/components/Settings/Members/PendingInvites.vue'
	)
	return mount(PendingInvites, {
		props: { label: 'Invites' },
		global: { mocks: { __: (globalThis as any).__ } },
	})
}

type Page = Awaited<ReturnType<typeof mountPage>>

async function invite(wrapper: Page, emails: string, role?: string) {
	await wrapper.find('textarea').setValue(emails)
	if (role) await wrapper.find('select').setValue(role)
	await wrapper.find('form').trigger('submit')
	await flushPromises()
}

describe('PendingInvites', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		invites.store = reactive({
			pendingInvites: [
				{ name: 'inv-1', email: 'asha@example.com', roles: ['Batch Evaluator'] },
			],
			inviting: false,
			cancellingName: null,
			load: vi.fn(),
			invite: vi.fn(async (emails: string) => ({
				...RESULT,
				invited_emails: emails.split(', '),
			})),
			cancel: vi.fn(async () => {}),
		})
	})

	it('lists the pending invites with their role', async () => {
		const wrapper = await mountPage()

		expect(invites.store.load).toHaveBeenCalled()
		expect(wrapper.find('li').text()).toContain('asha@example.com')
		expect(wrapper.find('li').text()).toContain('(Evaluator)')
	})

	it('invites every email with the chosen role and clears the box', async () => {
		const wrapper = await mountPage()
		await invite(wrapper, 'ravi@example.com, neha@example.com ', 'Course Creator')

		expect(invites.store.invite).toHaveBeenCalledWith(
			'ravi@example.com, neha@example.com',
			['Course Creator']
		)
		expect(toast.success).toHaveBeenCalledWith('2 invited')
		expect(onboarding.updateOnboardingStep).toHaveBeenCalledWith('invite_students')
		expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('')
	})

	it('names the emails it cannot send to, and sends nothing', async () => {
		const wrapper = await mountPage()
		await invite(wrapper, 'ravi@example.com, not-an-email')

		expect(invites.store.invite).not.toHaveBeenCalled()
		expect(wrapper.find('.error').text()).toBe('Check these emails: not-an-email')
	})

	it('says who was already invited instead of inviting them again', async () => {
		invites.store.invite = vi.fn(async () => ({
			...RESULT,
			pending_invite_emails: ['asha@example.com'],
		}))
		const wrapper = await mountPage()
		await invite(wrapper, 'asha@example.com')

		expect(toast.success).not.toHaveBeenCalled()
		expect(toast.info).toHaveBeenCalledWith('Already invited: asha@example.com')
	})

	it('shows the server error under the form when sending fails', async () => {
		invites.store.invite = vi.fn(async () => {
			throw { messages: ['Not permitted'] }
		})
		const wrapper = await mountPage()
		await invite(wrapper, 'ravi@example.com')

		expect(wrapper.find('.error').text()).toBe('Not permitted')
	})

	it('cancels an invite from its row', async () => {
		const wrapper = await mountPage()
		await wrapper.find('li button').trigger('click')
		await flushPromises()

		expect(invites.store.cancel).toHaveBeenCalledWith('inv-1')
		expect(toast.success).toHaveBeenCalledWith('Invite to asha@example.com cancelled')
	})
})
