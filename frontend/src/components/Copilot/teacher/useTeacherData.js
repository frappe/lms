// Loads the Copilot session once per page load, then a screen's own data.
// Teacher screens render nothing but a notice for anyone else.
import { ref, watch } from 'vue'
import { copilotCall } from '@/copilot/api'
import { errorText, parseDate } from './format'

let sessionPromise = null

export function loadCopilotSession() {
	if (!sessionPromise) {
		sessionPromise = copilotCall('get_session_context')
			.then((session) => {
				const serverNow = parseDate(session?.server_now)
				return {
					...session,
					// Server datetimes carry no zone: compare them with the server's clock, not ours.
					clockOffset: serverNow
						? serverNow.getTime() - Date.now()
						: 0,
				}
			})
			.catch((error) => {
				sessionPromise = null
				throw error
			})
	}
	return sessionPromise
}

export function resetCopilotSession() {
	sessionPromise = null
}

/**
 * @param {() => Promise<any>} loader fetches the screen's data
 * @param {() => any} [source] reactive source; the data reloads when it changes
 */
export function useTeacherData(loader, source) {
	const session = ref(null)
	const data = ref(null)
	const error = ref(null)
	const loading = ref(true)
	const forbidden = ref(false)
	let ticket = 0

	async function reload({ quiet = false } = {}) {
		const current = ++ticket
		if (!quiet) loading.value = true
		try {
			const who = await loadCopilotSession()
			if (current !== ticket) return
			session.value = who
			if (!who?.is_teacher) {
				forbidden.value = true
				data.value = null
				return
			}
			const result = await loader()
			if (current !== ticket) return
			forbidden.value = false
			error.value = null
			data.value = result
		} catch (err) {
			if (current !== ticket) return
			error.value = errorText(err)
		} finally {
			if (current === ticket) loading.value = false
		}
	}

	if (source) {
		// A new record must never show the previous one's buttons while it loads.
		watch(
			source,
			() => {
				data.value = null
				reload()
			},
			{ immediate: true }
		)
	} else {
		reload()
	}

	return { session, data, error, loading, forbidden, reload }
}
