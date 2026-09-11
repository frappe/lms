import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

// The send goes through the LMS endpoint, not communication.email.make: the
// recipient has to come from LMS Settings server-side, and an image pasted into
// the message is uploaded private, so it only reaches the recipient if the mail
// carries its bytes.
const { callMock, toastMock, closeMock } = vi.hoisted(() => {
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
	return {
		callMock: vi.fn(() => Promise.resolve('COMM-0001')),
		toastMock: { success: vi.fn(), error: vi.fn() },
		closeMock: vi.fn(),
	}
})

vi.mock('frappe-ui', () => ({
	call: callMock,
	toast: toastMock,
	Button: {
		inheritAttrs: false,
		template: '<button v-bind="$attrs"><slot /></button>',
	},
	FormControl: {
		props: ['modelValue', 'label', 'type', 'required'],
		emits: ['update:modelValue'],
		template: `<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
	},
	Dialog: {
		name: 'Dialog',
		props: ['open', 'title', 'size'],
		emits: ['update:open'],
		methods: {
			close() {
				closeMock()
			},
		},
		template: `<div v-if="open"><slot /><slot name="actions" :close="close" /></div>`,
	},
}))

// Kept so this file still exercises the component if the recipient ever moves
// back to the client: without it the old settings-store read dies at setup and
// the red below would be a missing mock rather than a wrong call.
vi.mock('@/stores/settings', () => ({
	useSettings: () => ({
		settings: { data: { contact_us_email: 'client-chosen@example.com' } },
	}),
}))

vi.mock('@/components/Form/labeling', () => ({
	InputLabel: { props: ['id', 'label', 'required'], template: '<label />' },
}))

vi.mock('@/components/RichTextEditor.vue', () => ({
	default: {
		name: 'RichTextEditor',
		props: ['fixedMenu', 'editorClass'],
		emits: ['change'],
		template: '<div />',
	},
}))

import ContactUsEmail from '@/components/ContactUsEmail.vue'

const MESSAGE = '<p>see this</p><img src="/private/files/shot.png">'

async function fillAndSend() {
	const wrapper = mount(ContactUsEmail, {
		props: { modelValue: true },
		global: { mocks: { __: (text: string) => text } },
	})
	await wrapper.find('input').setValue('Broken video')
	wrapper.findComponent({ name: 'RichTextEditor' }).vm.$emit('change', MESSAGE)
	await flushPromises()
	await wrapper.find('button').trigger('click')
	await flushPromises()
	return wrapper
}

describe('ContactUsEmail', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		callMock.mockImplementation(() => Promise.resolve('COMM-0001'))
	})

	it('sends through the LMS endpoint and names no recipient', async () => {
		await fillAndSend()
		expect(callMock).toHaveBeenCalledTimes(1)
		expect(callMock).toHaveBeenCalledWith('lms.lms.api.send_contact_us_email', {
			subject: 'Broken video',
			content: MESSAGE,
		})
	})

	it('closes and clears the form once the mail is away', async () => {
		const wrapper = await fillAndSend()
		expect(toastMock.success).toHaveBeenCalled()
		expect(closeMock).toHaveBeenCalled()
		expect(wrapper.find('input').element.value).toBe('')
	})

	it('keeps the message on screen when the server rejects it', async () => {
		callMock.mockImplementation(() =>
			Promise.reject({ messages: ['This site has no contact address.'] })
		)
		const wrapper = await fillAndSend()

		expect(toastMock.error).toHaveBeenCalledWith(
			'This site has no contact address.'
		)
		expect(closeMock).not.toHaveBeenCalled()
		expect(wrapper.find('input').element.value).toBe('Broken video')
	})
})
