import { computed, inject, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { call } from 'frappe-ui'
import type { Socket } from 'socket.io-client'

export interface Moment {
	id: string
	moment: Record<string, any>
}

export interface ChatMessage {
	key: string
	role: 'user' | 'assistant'
	text: string
	tools: string[]
	moments: Moment[]
	/** When it was sent, in seconds since the epoch. */
	ts?: number
}

/** A learner's answer to an interactive moment travels as a user message with this prefix. */
export const MOMENT_RESULT = 'MOMENT_RESULT '
// The server's note on a role-play's last reply; never shown. Kept in step with goals.py.
const SYSTEM_NOTE = '\n\n[SYSTEM NOTE] '

interface FlowRow {
	type: string
	seq?: number
	ts?: number
	content?: unknown
	text?: string
	name?: string
	reason?: string
	message?: string
	session_id?: string
	subagent_id?: string | null
}

const API = 'frappe.flow.api.api'

/** Model provider errors are long and technical; say what happened and what to do. */
const friendly = (message?: string | null): string | null => {
	if (!message) return null
	const text = message.toLowerCase()
	if (text.includes('rate limit') || text.includes('429'))
		return __(
			'The AI is busy right now. Wait a minute, then send your message again.',
		)
	return __('The AI could not reply this time. Try sending your message again.')
}

const textOf = (content: unknown): string => {
	if (typeof content === 'string') return content
	if (!Array.isArray(content)) return ''
	return content
		.filter((block) => block?.type === 'text')
		.map((block) => block.text)
		.join('')
}

const toolsOf = (content: unknown): string[] =>
	Array.isArray(content)
		? content
				.filter((block) => block?.type === 'tool_call')
				.map((block) => block.name)
		: []

// Flow names an app's tools `<app>__<tool>`; sessions from before that use the bare name.
const isTool = (name: unknown, tool: string): boolean =>
	name === tool || (typeof name === 'string' && name.endsWith(`__${tool}`))

const momentsOf = (content: unknown): Moment[] =>
	Array.isArray(content)
		? content
				.filter(
					(block) =>
						block?.type === 'tool_call' && isTool(block.name, 'show_moment'),
				)
				.map((block) => ({
					id: block.id,
					moment: (block.arguments || {}).moment || block.arguments,
				}))
		: []

/**
 * One Flow session as a chat: the transcript so far, the reply streaming in, and send().
 * `hideFirstMessage` drops the opening message the server sent for the learner, such as a
 * role-play brief.
 */
export function useFlowChat(
	session: Ref<string | null | undefined>,
	{
		hideFirstMessage = false,
		runMethod = `${API}.run`,
	}: {
		hideFirstMessage?: boolean
		/** The method a reply is sent through; a role-play adds its own rules on top. */
		runMethod?: string
	} = {},
) {
	const socket = inject<Socket>('$socket')
	const rows = ref<FlowRow[]>([])
	const partial = ref('')
	const activeTool = ref<string | null>(null)
	const running = ref(false)
	const error = ref<string | null>(null)
	const loading = ref(false)
	let cursor = 0
	let subscribed: string | null = null
	let poller: ReturnType<typeof setInterval> | null = null
	let sending = false

	const messages = computed<ChatMessage[]>(() => {
		const out: ChatMessage[] = []
		let firstUserSkipped = !hideFirstMessage
		for (const row of rows.value) {
			if (row.subagent_id) continue
			if (row.type === 'user_message') {
				if (!firstUserSkipped) {
					firstUserSkipped = true
					continue
				}
				const text = textOf(row.content).split(SYSTEM_NOTE)[0]
				if (text.startsWith(MOMENT_RESULT)) continue
				out.push({
					key: `u${row.seq}`,
					role: 'user',
					text,
					tools: [],
					moments: [],
					ts: row.ts,
				})
			} else if (row.type === 'assistant_message') {
				const text = textOf(row.content)
				const last = out[out.length - 1]
				if (last?.role === 'assistant' && !last.text) {
					last.text = text
					last.tools.push(...toolsOf(row.content))
					last.moments.push(...momentsOf(row.content))
				} else {
					out.push({
						key: `a${row.seq}`,
						role: 'assistant',
						text,
						tools: toolsOf(row.content),
						moments: momentsOf(row.content),
						ts: row.ts,
					})
				}
			}
		}
		return out.filter(
			(message) =>
				message.text || message.moments.length || message.role === 'user',
		)
	})

	/** Each answered moment's result, keyed by the moment's id. */
	const results = computed<Record<string, Record<string, any>>>(() => {
		const found: Record<string, Record<string, any>> = {}
		for (const row of rows.value) {
			if (row.type !== 'user_message') continue
			const text = textOf(row.content)
			if (!text.startsWith(MOMENT_RESULT)) continue
			try {
				const result = JSON.parse(text.slice(MOMENT_RESULT.length))
				if (result.id) found[result.id] = result
			} catch {
				// a malformed result is just not shown as answered
			}
		}
		return found
	})

	const apply = (row: FlowRow) => {
		if (row.subagent_id) return
		if (typeof row.seq === 'number') {
			if (row.seq <= cursor) return
			cursor = row.seq
			rows.value.push(row)
		}
		switch (row.type) {
			case 'run_started':
				running.value = true
				error.value = null
				break
			case 'text_delta':
				partial.value += row.text ?? ''
				activeTool.value = null
				break
			case 'tool_call_started':
				activeTool.value = row.name ?? null
				break
			case 'assistant_message':
				partial.value = ''
				break
			case 'run_error':
				error.value = friendly(row.message)
				break
			case 'run_ended':
				running.value = false
				partial.value = ''
				activeTool.value = null
				break
		}
	}

	const load = async () => {
		if (!session.value) return
		loading.value = true
		try {
			// The active view is a snapshot; catching up from a cursor needs every row since it.
			const data = await call(`${API}.entries`, {
				session: session.value,
				since: cursor,
				path: cursor ? 'all' : 'active',
			})
			const entries = (data.entries ?? []).sort(
				(a: FlowRow, b: FlowRow) => (a.seq ?? 0) - (b.seq ?? 0),
			)
			entries.forEach(apply)
			partial.value = ''
			for (const event of data.preview ?? []) apply(event)
			// A load that started before a send cannot see the new turn yet, so it may not end it.
			running.value = Boolean(data.running) || sending
		} finally {
			loading.value = false
		}
	}

	const onEvent = (event: FlowRow) => {
		if (event?.session_id !== session.value) return
		if (typeof event.seq === 'number' && event.seq > cursor + 1) {
			load()
			return
		}
		apply(event)
	}

	const onResync = (notice: { session?: string }) => {
		if (notice?.session === session.value) load()
	}

	const subscribe = (name: string) =>
		new Promise<boolean>((resolve) => {
			if (!socket) return resolve(false)
			socket.emit('flow:subscribe', name, (ack: { subscribed?: boolean }) =>
				resolve(ack?.subscribed === true),
			)
		})

	const unsubscribe = () => {
		if (subscribed && socket) socket.emit('flow:unsubscribe', subscribed)
		subscribed = null
	}

	const start = async (name: string | null | undefined) => {
		unsubscribe()
		rows.value = []
		partial.value = ''
		cursor = 0
		running.value = false
		error.value = null
		if (!name) return
		if (await subscribe(name)) subscribed = name
		await load()
	}

	// Without the live relay (an old socketio process, or the access check failed), read the
	// log every few seconds while a reply is on its way instead of waiting forever.
	watch(running, (busy) => {
		if (busy && !subscribed && !poller) poller = setInterval(load, 2000)
		if (!busy && poller) {
			clearInterval(poller)
			poller = null
		}
	})

	const send = async (text: string) => {
		if (!session.value || !text.trim()) return
		running.value = true
		error.value = null
		sending = true
		try {
			await call(runMethod, { session: session.value, message: text })
			sending = false
			await load()
		} catch (err) {
			running.value = false
			error.value = (err as Error)?.message ?? String(err)
		} finally {
			sending = false
		}
	}

	socket?.on('flow:event', onEvent)
	socket?.on('flow:resync', onResync)
	watch(session, start, { immediate: true })

	onBeforeUnmount(() => {
		socket?.off('flow:event', onEvent)
		socket?.off('flow:resync', onResync)
		unsubscribe()
		if (poller) clearInterval(poller)
	})

	return {
		messages,
		results,
		partial,
		activeTool,
		running,
		error,
		loading,
		send,
		reload: load,
	}
}
