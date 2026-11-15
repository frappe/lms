import { UploadError } from 'frappe-ui'

/**
 * What to tell the user when an upload fails: validateFile's rejection as is,
 * the server's first message for an UploadError, a generic line otherwise.
 */
export const uploadErrorMessage = (error: unknown): string => {
	if (typeof error === 'string') return error
	if (error instanceof UploadError) return error.messages[0] || error.message
	return __('Error Uploading File')
}
