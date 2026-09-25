import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'

// frappe's translation layer patches String.prototype.format onto the page at
// boot; the components call __('…{0}').format(x).
String.prototype.format = function (this: string, ...args: unknown[]): string {
	return this.replace(/{(\d+)}/g, (match, index) =>
		args[index] !== undefined ? String(args[index]) : match
	)
}
vi.stubGlobal('__', (text: string) => text)
enableAutoUnmount(afterEach)

const { copilotCall } = vi.hoisted(() => ({ copilotCall: vi.fn() }))

vi.mock('@/copilot/api', () => ({
	COPILOT_API: 'lms.copilot.api',
	copilotCall,
}))

vi.mock('frappe-ui', () => ({
	Button: {
		props: ['label', 'loading', 'disabled', 'variant', 'size'],
		template:
			'<button :aria-label="label" :disabled="disabled || loading"><slot name="prefix" /><slot name="icon" /><slot /></button>',
	},
	LoadingIndicator: { template: '<span data-testid="spinner" />' },
}))

import TutorPanel from '@/components/Copilot/TutorPanel.vue'
import {
	citationPath,
	escalateToTeacher,
	loadConversation,
	rateAnswer,
	saveConversation,
	sendChat,
	storageKey,
} from '@/components/Copilot/tutor/gateway'

const jsonResponse = (body: unknown, status = 200) =>
	({
		ok: status >= 200 && status < 300,
		status,
		json: () => Promise.resolve(body),
	}) as Response

const TUTOR_REPLY = {
	answer: 'Loops repeat code [1].',
	session_id: 'cht_abc',
	tutor: {
		kind: 'tutor',
		course: 'python-101',
		lesson: 'LESSON-3',
		question: 'What is a loop?',
		citations: [
			{
				lesson: 'LESSON-3',
				block_id: 'b1',
				label: 'Loops · For loops',
				route: '/lms/courses/python-101/learn/1-3',
			},
			{
				lesson: 'LESSON-9',
				block_id: 'b2',
				label: 'Off-route',
				route: 'https://evil.example.com/',
			},
		],
		grounded: true,
		escalated: false,
		suggest_escalation: false,
		conversation: 'CONV-1',
		message_index: 2,
	},
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
	fetchMock = vi.fn()
	vi.stubGlobal('fetch', fetchMock)
	window.sessionStorage.clear()
	copilotCall.mockReset()
	window.history.replaceState(null, '', '/lms/courses/python-101/learn/1-3')
})

const bodyOf = (callIndex: number) =>
	JSON.parse(fetchMock.mock.calls[callIndex][1].body as string)

describe('tutor gateway client', () => {
	it('posts a chat turn with the real page path and the previous session', async () => {
		fetchMock.mockResolvedValue(jsonResponse(TUTOR_REPLY))
		const reply = await sendChat({
			message: 'What is a loop?',
			sessionId: 'cht_old',
			page: '/lms/courses/python-101/learn/1-3',
		})
		expect(reply.session_id).toBe('cht_abc')
		const [url, init] = fetchMock.mock.calls[0]
		expect(url).toBe('/ai/chat')
		expect(init.method).toBe('POST')
		expect(init.credentials).toBe('same-origin')
		expect(bodyOf(0)).toEqual({
			message: 'What is a loop?',
			conversation_id: 'cht_old',
			page: '/lms/courses/python-101/learn/1-3',
			mode: 'chat',
		})
	})

	it('surfaces the gateway detail on failure', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ detail: 'rate limited' }, 429))
		await expect(sendChat({ message: 'hi', page: '/x' })).rejects.toThrow(
			'rate limited'
		)
	})

	it('rates and escalates with the gateway field names', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ ok: true }))
		await rateAnswer({
			conversation: 'CONV-1',
			messageIndex: 2,
			helpful: false,
		})
		await escalateToTeacher({
			course: 'python-101',
			lesson: 'LESSON-3',
			question: 'Why?',
			sessionId: 'cht_abc',
		})
		expect(fetchMock.mock.calls[0][0]).toBe('/ai/copilot/answers/rate')
		expect(bodyOf(0)).toEqual({
			conversation: 'CONV-1',
			message_index: 2,
			helpful: false,
		})
		expect(fetchMock.mock.calls[1][0]).toBe('/ai/copilot/escalate')
		expect(bodyOf(1)).toEqual({
			course: 'python-101',
			lesson: 'LESSON-3',
			question: 'Why?',
			session_id: 'cht_abc',
		})
	})

	it('turns only LMS lesson routes into router paths', () => {
		expect(citationPath('/lms/courses/python-101/learn/1-3')).toBe(
			'/courses/python-101/learn/1-3'
		)
		expect(citationPath('https://evil.example.com/')).toBeNull()
		expect(citationPath('/lms/courses/x/learn/1-3?next=//evil')).toBeNull()
		expect(citationPath('/lms/../admin')).toBeNull()
		expect(citationPath('')).toBeNull()
	})

	it('remembers the conversation per course and lesson', () => {
		saveConversation('c1', 'l1', {
			sessionId: 'cht_1',
			messages: [
				{ role: 'user', text: 'a' },
				{ role: 'assistant', pending: true },
			],
		})
		expect(loadConversation('c1', 'l1')).toEqual({
			sessionId: 'cht_1',
			messages: [{ role: 'user', text: 'a' }],
		})
		expect(loadConversation('c1', 'l2')).toEqual({
			sessionId: '',
			messages: [],
		})
	})

	it('keeps working when sessionStorage throws', () => {
		const spy = vi
			.spyOn(Storage.prototype, 'getItem')
			.mockImplementation(() => {
				throw new Error('blocked')
			})
		const set = vi
			.spyOn(Storage.prototype, 'setItem')
			.mockImplementation(() => {
				throw new Error('blocked')
			})
		expect(loadConversation('c', 'l')).toEqual({ sessionId: '', messages: [] })
		expect(() =>
			saveConversation('c', 'l', { sessionId: 'x', messages: [] })
		).not.toThrow()
		spy.mockRestore()
		set.mockRestore()
	})
})

const RouterLinkStub = {
	props: ['to'],
	template: '<a :href="to" data-testid="citation"><slot /></a>',
}

const mountPanel = async (learnerWidget: unknown = 1) => {
	copilotCall.mockResolvedValue({
		user: 'a@b.c',
		learner_widget: learnerWidget,
	})
	const wrapper = mount(TutorPanel, {
		props: { course: 'python-101', lesson: 'LESSON-3' },
		attachTo: document.body,
		global: {
			mocks: { __: (text: string) => text },
			stubs: { 'router-link': RouterLinkStub },
		},
	})
	await flushPromises()
	return wrapper
}

const ask = async (
	wrapper: Awaited<ReturnType<typeof mountPanel>>,
	text: string
) => {
	await wrapper.find('[data-testid="tutor-input"]').setValue(text)
	await wrapper.find('form').trigger('submit')
	await flushPromises()
}

describe('TutorPanel', () => {
	it('stays hidden when the learner tutor is disabled in Copilot Settings', async () => {
		const wrapper = await mountPanel(0)
		expect(copilotCall).toHaveBeenCalledWith('get_session_context')
		expect(wrapper.find('[data-testid="tutor-open"]').exists()).toBe(false)
	})

	it('stays hidden when the session context call fails', async () => {
		copilotCall.mockRejectedValue(new Error('403'))
		const wrapper = mount(TutorPanel, {
			props: { course: 'python-101', lesson: 'LESSON-3' },
			global: { mocks: { __: (text: string) => text } },
		})
		await flushPromises()
		expect(wrapper.find('[data-testid="tutor-open"]').exists()).toBe(false)
	})

	it('asks the gateway, renders the answer with safe citation links and remembers the session', async () => {
		fetchMock.mockResolvedValue(jsonResponse(TUTOR_REPLY))
		const wrapper = await mountPanel()
		await wrapper.find('[data-testid="tutor-open"]').trigger('click')
		await ask(wrapper, 'What is a loop?')

		expect(bodyOf(0)).toMatchObject({
			message: 'What is a loop?',
			conversation_id: '',
			page: '/lms/courses/python-101/learn/1-3',
		})
		const answer = wrapper.find('[data-testid="tutor-answer"]')
		expect(answer.text()).toContain('Loops repeat code [1].')
		const links = wrapper.findAll('[data-testid="citation"]')
		expect(links).toHaveLength(1)
		expect(links[0].attributes('href')).toBe('/courses/python-101/learn/1-3')
		expect(answer.text()).toContain('Off-route')

		const stored = JSON.parse(
			window.sessionStorage.getItem(storageKey('python-101', 'LESSON-3'))!
		)
		expect(stored.sessionId).toBe('cht_abc')
		expect(stored.messages).toHaveLength(2)

		// The next turn continues the same gateway session.
		await ask(wrapper, 'And while loops?')
		expect(bodyOf(1).conversation_id).toBe('cht_abc')
	})

	it('never renders raw HTML from the model', async () => {
		fetchMock.mockResolvedValue(
			jsonResponse({
				answer: '<img src=x onerror="alert(1)"> **bold**',
				session_id: 's',
			})
		)
		const wrapper = await mountPanel()
		await wrapper.find('[data-testid="tutor-open"]').trigger('click')
		await ask(wrapper, 'hi')
		const answer = wrapper.find('[data-testid="tutor-answer"]')
		expect(answer.find('img').exists()).toBe(false)
		expect(answer.find('strong').text()).toBe('bold')
	})

	it('rates an answer once and escalates it to the teacher', async () => {
		fetchMock.mockResolvedValue(jsonResponse(TUTOR_REPLY))
		const wrapper = await mountPanel()
		await wrapper.find('[data-testid="tutor-open"]').trigger('click')
		await ask(wrapper, 'What is a loop?')

		fetchMock.mockResolvedValue(jsonResponse({ ok: true }))
		await wrapper.find('button[aria-label="Helpful"]').trigger('click')
		await flushPromises()
		expect(fetchMock.mock.calls[1][0]).toBe('/ai/copilot/answers/rate')
		expect(bodyOf(1)).toEqual({
			conversation: 'CONV-1',
			message_index: 2,
			helpful: true,
		})
		expect(
			wrapper.find('button[aria-label="Not helpful"]').attributes('disabled')
		).toBeDefined()

		const escalate = wrapper
			.findAll('button')
			.find((button) => button.text().includes('Ask the teacher'))!
		await escalate.trigger('click')
		await flushPromises()
		expect(fetchMock.mock.calls[2][0]).toBe('/ai/copilot/escalate')
		expect(bodyOf(2)).toEqual({
			course: 'python-101',
			lesson: 'LESSON-3',
			question: 'What is a loop?',
			session_id: 'cht_abc',
		})
		expect(wrapper.text()).toContain('Sent to your teacher')
	})

	it('shows the gateway error as a failed answer', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ detail: 'gateway down' }, 502))
		const wrapper = await mountPanel()
		await wrapper.find('[data-testid="tutor-open"]').trigger('click')
		await ask(wrapper, 'hi')
		expect(wrapper.text()).toContain('The tutor could not answer: gateway down')
	})

	it('restores the remembered conversation for the lesson', async () => {
		saveConversation('python-101', 'LESSON-3', {
			sessionId: 'cht_saved',
			messages: [
				{ id: 1, role: 'user', text: 'Earlier question' },
				{ id: 2, role: 'assistant', text: 'Earlier answer' },
			],
		})
		fetchMock.mockResolvedValue(jsonResponse(TUTOR_REPLY))
		const wrapper = await mountPanel()
		await wrapper.find('[data-testid="tutor-open"]').trigger('click')
		expect(wrapper.text()).toContain('Earlier answer')
		await ask(wrapper, 'Follow-up')
		expect(bodyOf(0).conversation_id).toBe('cht_saved')
	})
})
