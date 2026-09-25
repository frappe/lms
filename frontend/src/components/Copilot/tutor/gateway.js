// Talks to the AI Gateway, served same-origin under /ai/ by the reverse proxy.
// The Frappe `sid` cookie authenticates; the browser adds Origin to every POST,
// which the gateway's same-origin check on /copilot/* requires.
import { getLmsBasePath } from '@/utils/basePath'

export const GATEWAY = '/ai'
const STORAGE_PREFIX = 'lms-copilot-tutor'
const MAX_STORED_MESSAGES = 40

export async function postGateway(path, body) {
	const response = await fetch(GATEWAY + path, {
		method: 'POST',
		credentials: 'same-origin',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json',
		},
		body: JSON.stringify(body),
	})
	const data = await response.json().catch(() => ({}))
	if (!response.ok) {
		const detail = typeof data.detail === 'string' ? data.detail : null
		throw new Error(data.answer || detail || `HTTP ${response.status}`)
	}
	return data
}

// POST /ai/chat. An empty conversation_id opens a new gateway session; the
// reply's session_id continues it. `page` is how the gateway infers the course
// and lesson, so it must be the real LMS path.
export function sendChat({ message, sessionId = '', page }) {
	return postGateway('/chat', {
		message,
		conversation_id: sessionId || '',
		page: page ?? window.location.pathname + window.location.search,
		mode: 'chat',
	})
}

export function rateAnswer({ conversation, messageIndex, helpful }) {
	return postGateway('/copilot/answers/rate', {
		conversation,
		message_index: messageIndex,
		helpful: Boolean(helpful),
	})
}

export function escalateToTeacher({
	course,
	lesson,
	question,
	summary,
	sessionId,
}) {
	const body = {
		course,
		question,
		lesson: lesson || '',
		session_id: sessionId || '',
	}
	if (summary) body.summary = summary
	return postGateway('/copilot/escalate', body)
}

// The gateway builds citation routes as /<base>/courses/<course>/learn/<ch>-<no>.
// Anything else is shown as plain text. Returns the router path (base stripped).
export function citationPath(route) {
	const value = String(route || '')
	const bases = new Set([getLmsBasePath(), 'lms'])
	for (const base of bases) {
		const prefix = `/${base}`
		if (!value.startsWith(prefix + '/')) continue
		const path = value.slice(prefix.length)
		if (/^\/courses\/[^/?#]+\/learn\/\d+-\d+$/.test(path)) return path
	}
	return null
}

export function storageKey(course, lesson) {
	return `${STORAGE_PREFIX}:${course || ''}:${lesson || ''}`
}

export function loadConversation(course, lesson) {
	try {
		const raw = window.sessionStorage.getItem(storageKey(course, lesson))
		const data = raw ? JSON.parse(raw) : null
		if (!data || typeof data !== 'object')
			return { sessionId: '', messages: [] }
		return {
			sessionId: typeof data.sessionId === 'string' ? data.sessionId : '',
			messages: Array.isArray(data.messages) ? data.messages : [],
		}
	} catch (error) {
		return { sessionId: '', messages: [] }
	}
}

export function saveConversation(course, lesson, { sessionId, messages }) {
	try {
		window.sessionStorage.setItem(
			storageKey(course, lesson),
			JSON.stringify({
				sessionId: sessionId || '',
				messages: (messages || [])
					.filter((message) => !message.pending)
					.slice(-MAX_STORED_MESSAGES),
			})
		)
	} catch (error) {
		// Storage can be blocked (private mode, iframes); the chat still works.
	}
}

export function clearConversation(course, lesson) {
	try {
		window.sessionStorage.removeItem(storageKey(course, lesson))
	} catch (error) {
		// ignore
	}
}
