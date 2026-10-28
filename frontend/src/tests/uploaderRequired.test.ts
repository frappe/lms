// Regression for #2979: Uploader defaulted `required` to true, so every image field showed
// a required marker unless the caller passed :required="false".
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.hoisted(() => {
	// The real @/utils imports plyr, which reads matchMedia at import time.
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
})

vi.mock('frappe-ui', () => ({
	FileUploader: {
		name: 'FileUploader',
		props: ['private', 'fileTypes', 'validateFile'],
		emits: ['success', 'failure'],
		template: '<div />',
	},
	Button: { template: '<button><slot /></button>' },
	UploadError: class UploadError extends Error {},
	toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/utils', () => ({
	validateFile: () => undefined,
}))

const mountUploader = async (props: Record<string, unknown> = {}) => {
	const Uploader = (await import('@/components/Controls/Uploader.vue')).default
	return mount(Uploader, {
		props: { modelValue: null, label: 'Image', ...props },
		global: { mocks: { __: (s: string) => s } },
	})
}

describe('Uploader required marker', () => {
	it('is not required when the prop is omitted', async () => {
		const w = await mountUploader()
		expect(w.text()).toContain('Image')
		expect(w.text()).not.toContain('(required)')
	})

	it('is required when asked', async () => {
		const w = await mountUploader({ required: true })
		expect(w.text()).toContain('(required)')
	})
})
