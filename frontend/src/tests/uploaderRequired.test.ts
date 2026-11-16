/**
 * Uploader marks its field required only when asked, like every other control
 * (#2979). It defaulted to true, so leaving the prop off still showed an
 * asterisk and callers passed :required="false" to undo it.
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Uploader from '@/components/Controls/Uploader.vue'

vi.mock('frappe-ui', () => ({
	FileUploader: { name: 'FileUploader', template: '<div />' },
	Button: { template: '<button><slot /></button>' },
	toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('frappe-ui/experimental', () => ({
	InputLabel: { name: 'InputLabel', props: ['required'], template: '<label />' },
	InputDescription: { template: '<p />' },
	InputError: { template: '<p />' },
	useInputLabeling: () => ({}),
}))

vi.mock('@/utils', () => ({ validateFile: () => undefined }))

const requiredOf = (props: Record<string, unknown>) =>
	mount(Uploader, {
		props: { modelValue: null, label: 'Image', ...props },
		global: { mocks: { __: (s: string) => s } },
	})
		.findComponent({ name: 'InputLabel' })
		.props('required')

describe('Uploader required', () => {
	it('is not required when the prop is left off', () => {
		expect(requiredOf({})).toBe(false)
	})

	it('is required when asked', () => {
		expect(requiredOf({ required: true })).toBe(true)
	})
})
