// Regression: failed uploads lost their reason, since v1 FileUploader emits an UploadError, not a string.
// Introduced by the frappe-ui 1.0.0-rc.1 upgrade; test added in that PR (chore/frappe-ui-v1-rc1)
// to pin Uploader.vue showing the server's reason or the validateFile message.
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const { toastError, UploadError, utils } = vi.hoisted(() => {
	// The real @/utils imports plyr, which reads matchMedia at import time.
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
	class UploadError extends Error {
		messages: string[]
		constructor(message: string, options: { messages?: string[] }) {
			super(message)
			this.messages = options.messages ?? []
		}
	}
	const utils: { validateFile: (...args: unknown[]) => unknown } = {
		validateFile: () => undefined,
	}
	return { toastError: vi.fn(), UploadError, utils }
})

vi.mock('frappe-ui', () => ({
	FileUploader: {
		name: 'FileUploader',
		props: ['private', 'fileTypes', 'validateFile'],
		emits: ['success', 'failure'],
		template: '<div />',
	},
	Button: { template: '<button><slot /></button>' },
	UploadError,
	toast: { success: vi.fn(), error: toastError },
}))

vi.mock('@/utils', () => ({
	validateFile: (...args: unknown[]) => utils.validateFile(...args),
}))

const mountUploader = async () => {
	const Uploader = (await import('@/components/Controls/Uploader.vue')).default
	return mount(Uploader, {
		props: { modelValue: null },
		global: { mocks: { __: (s: string) => s } },
	})
}

describe('Uploader failure toast', () => {
	it('shows the first server message of an UploadError', async () => {
		const w = await mountUploader()
		w.findComponent({ name: 'FileUploader' }).vm.$emit(
			'failure',
			new UploadError('Request failed', { messages: ['File too large'] })
		)
		expect(toastError).toHaveBeenLastCalledWith('File too large')
	})

	it('shows the validateFile rejection string as is', async () => {
		const w = await mountUploader()
		w.findComponent({ name: 'FileUploader' }).vm.$emit(
			'failure',
			'Only image file is allowed.'
		)
		expect(toastError).toHaveBeenLastCalledWith('Only image file is allowed.')
	})

	it('falls back to the generic message for anything else', async () => {
		const w = await mountUploader()
		w.findComponent({ name: 'FileUploader' }).vm.$emit('failure', {})
		expect(toastError).toHaveBeenLastCalledWith('Error Uploading File')
	})

	it('toasts a rejected file type once, via the real validateFile', async () => {
		const actual = await vi.importActual<typeof utils>('@/utils')
		utils.validateFile = actual.validateFile
		const w = await mountUploader()
		const uploader = w.findComponent({ name: 'FileUploader' })
		toastError.mockClear()
		const file = new File(['x'], 'notes.txt', { type: 'text/plain' })
		const message = await uploader.props('validateFile')(file)
		expect(message).toBe('Only image file is allowed.')
		uploader.vm.$emit('failure', message)
		expect(toastError).toHaveBeenCalledTimes(1)
		expect(toastError).toHaveBeenCalledWith('Only image file is allowed.')
	})
})
