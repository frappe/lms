// Calls into the LMS Copilot module (lms/copilot/api.py). Every AI write is a
// proposal a teacher approves; these helpers only read and trigger actions.
import { call } from 'frappe-ui'

export const COPILOT_API = 'lms.copilot.api'

export function copilotCall(method, args = {}) {
	return call(`${COPILOT_API}.${method}`, args)
}

// Documents go through our own endpoint: frappe's upload_file rejects Markdown
// for teachers without desk access.
export async function uploadCourseSource(file) {
	const form = new FormData()
	form.append('file', file, file.name)
	const response = await fetch(`/api/method/${COPILOT_API}.upload_course_source`, {
		method: 'POST',
		headers: { Accept: 'application/json', 'X-Frappe-CSRF-Token': window.csrf_token },
		body: form,
	})
	const data = await response.json().catch(() => ({}))
	if (!response.ok) {
		let message = null
		try {
			message = JSON.parse(JSON.parse(data._server_messages || '[]')[0] || '{}').message
		} catch (error) {
			message = null
		}
		throw new Error(message || `Could not upload ${file.name}.`)
	}
	return data.message
}
