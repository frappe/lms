import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'

const { callMock } = vi.hoisted(() => {
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
	return { callMock: vi.fn() }
})

// Button ignores `loading`, so a second click reaches the handler: these tests
// cover the handler's own guard, which keyboard and programmatic calls rely on.
vi.mock('frappe-ui', () => ({
	call: callMock,
	toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
	createResource: () => ({ data: null, reload: vi.fn(), submit: vi.fn() }),
	Alert: { template: '<div />' },
	ErrorMessage: { props: ['message'], template: '<div />' },
	Button: {
		props: ['label', 'loading', 'disabled', 'type'],
		template:
			'<button :type="type || \'button\'" :data-label="label"><slot />{{ label }}</button>',
	},
	FormControl: {
		props: ['modelValue', 'label', 'type', 'required'],
		emits: ['update:modelValue'],
		template: `<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
	},
	Dialog: {
		props: ['open', 'title', 'size'],
		template: `<div v-if="open"><slot /><slot name="actions" :close="() => {}" /></div>`,
	},
}))
vi.mock('frappe-ui/experimental', () => ({
	InputLabel: { template: '<label />' },
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/components/RichTextEditor.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/CertificationLinks.vue', () => ({
	default: { render: () => null },
}))
vi.mock('@/components/VideoPreview.vue', () => ({
	default: { render: () => null },
}))

import ContactUsEmail from '@/components/ContactUsEmail.vue'
import CourseCardOverlay from '@/components/CourseCardOverlay.vue'
import ChangePasswordDialog from '@/components/Profile/ChangePasswordDialog.vue'

const global = {
	provide: { $user: { data: { name: 'learner@example.com' } } },
	mocks: { __: (text: string) => text },
}

const pending = () => new Promise(() => {})

describe('a second press while the first write is in flight', () => {
	beforeEach(() => {
		callMock.mockReset()
		callMock.mockImplementation(pending)
	})

	it('sends the contact email once', async () => {
		const wrapper = mount(ContactUsEmail, {
			props: { modelValue: true },
			global,
		})
		const send = wrapper.find('button')
		await send.trigger('click')
		await send.trigger('click')
		await flushPromises()

		expect(callMock).toHaveBeenCalledTimes(1)
	})

	it('enrolls once', async () => {
		const wrapper = mount(CourseCardOverlay, {
			props: { course: reactive({ data: { name: 'COURSE-1' } }) } as never,
			global,
		})
		const enroll = wrapper
			.findAll('button')
			.find((button) => button.text().includes('Enroll Now'))!
		await enroll.trigger('click')
		await enroll.trigger('click')
		await flushPromises()

		expect(callMock).toHaveBeenCalledTimes(1)
	})

	it('updates the password once when the form is submitted twice', async () => {
		const wrapper = mount(ChangePasswordDialog, {
			props: { open: true },
			global,
		})
		for (const input of wrapper.findAll('input')) await input.setValue('pw')
		await wrapper.find('form').trigger('submit')
		await wrapper.find('form').trigger('submit')
		await flushPromises()

		expect(callMock).toHaveBeenCalledTimes(1)
	})
})
