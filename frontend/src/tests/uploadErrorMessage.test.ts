import { describe, expect, it, vi } from 'vitest'
import { UploadError } from 'frappe-ui'
import { uploadErrorMessage } from '@/utils/uploadErrorMessage'

vi.stubGlobal('__', (text: string) => text)

describe('uploadErrorMessage', () => {
	it("shows validateFile's rejection as is", () => {
		expect(uploadErrorMessage('Only image file is allowed.')).toBe(
			'Only image file is allowed.'
		)
	})

	it("shows the server's first message for an upload error", () => {
		const error = new UploadError('Request failed', {
			kind: 'server',
			messages: ['File too large', 'Second'],
		})
		expect(uploadErrorMessage(error)).toBe('File too large')
	})

	it('falls back to the error itself, then to a generic line', () => {
		const bare = new UploadError('Network down', {
			kind: 'network',
		})
		expect(uploadErrorMessage(bare)).toBe('Network down')
		expect(uploadErrorMessage({})).toBe('Error Uploading File')
	})
})
