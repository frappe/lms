import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

const QUIZ_URL = 'lms.lms.utils.get_quiz_with_questions'
const SUBMIT_URL = 'lms.lms.doctype.lms_quiz.lms_quiz.submit_quiz'
const { submitted, called } = vi.hoisted(() => ({
	submitted: [] as string[],
	called: [] as string[],
}))

const quizFixture = {
	quiz: {
		name: 'quiz-a',
		title: 'Quiz A',
		duration: 1,
		show_answers: 0,
		max_attempts: 0,
		passing_percentage: 70,
		questions: [{ question: 'q1' }],
	},
	questions_by_name: {
		q1: {
			name: 'q1',
			question: 'Pick a',
			type: 'Choices',
			multiple: 0,
			option_1: 'a',
			option_2: 'b',
		},
	},
}

vi.mock('frappe-ui', async () => {
	const { reactive } = await import('vue')
	const createResource = (options: any) => {
		const resource: any = reactive({
			data: null,
			loading: false,
			reload: async () => {
				if (options.url !== QUIZ_URL) return resource.data
				await Promise.resolve()
				const raw = structuredClone(quizFixture)
				const transformed = options.transform?.(raw)
				resource.data = transformed === undefined ? raw : transformed
				options.onSuccess?.(raw)
				return resource.data
			},
			submit: (_values: unknown, handlers: any) => {
				submitted.push(options.url)
				handlers?.onSuccess?.({})
			},
			abort: vi.fn(),
			reset: () => {
				resource.data = null
			},
		})
		resource.fetch = resource.reload
		if (options.auto) void resource.reload()
		return resource
	}
	const passthrough = { template: '<div><slot /></div>' }
	return {
		createResource,
		call: (method: string) => {
			called.push(method)
			return Promise.resolve()
		},
		toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
		Button: {
			emits: ['click'],
			template: `<button @click="$emit('click')"><slot /></button>`,
		},
		Badge: passthrough,
		Checkbox: passthrough,
		Dialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
		FormControl: passthrough,
		LoadingIndicator: passthrough,
		Progress: passthrough,
		Skeleton: passthrough,
	}
})

vi.mock('@/stores/user', () => ({
	usersStore: () => ({
		userResource: { data: { name: 'student@example.com' } },
	}),
}))
// Quiz.vue guards navigation away from a proctored attempt on the app router.
vi.mock('@/router', () => ({
	default: { push: vi.fn(), beforeEach: () => () => {} },
}))
vi.mock('@/components/AssessmentPlugin.vue', () => ({ default: {} }))
vi.mock('@/components/ProgressBar.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/ResponsiveListView.vue', () => ({
	default: { template: '<div><slot /></div>' },
}))
vi.mock('@/components/RichTextEditor.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/utils/format', () => ({ timeAgo: (v: string) => v }))

import { Quiz } from '@/utils/quiz'

const sendBeacon = vi.fn(() => true)
let tools: Quiz[] = []

const renderQuizBlock = async (): Promise<Quiz> => {
	const tool = new Quiz({ data: { quiz: 'quiz-a' }, readOnly: true })
	document.body.append(tool.render())
	tools.push(tool)
	await flushPromises()
	return tool
}

const startButton = (tool: Quiz) =>
	Array.from(tool.wrapper.querySelectorAll('button')).find(
		(button) => button.textContent?.trim() === 'Start Quiz'
	)

beforeEach(() => {
	submitted.length = 0
	called.length = 0
	sendBeacon.mockClear()
	Object.assign(navigator, { sendBeacon })
	Object.assign(window, { translatedMessages: {} })
	localStorage.clear()
	vi.useFakeTimers()
})

afterEach(() => {
	for (const tool of tools) tool.destroy()
	tools = []
	document.body.replaceChildren()
	vi.useRealTimers()
})

// Guards a destroyed inline quiz submitting, marking progress, or resuming.
// The gate came with #2426 (Enforce Quiz Completion); this branch's lesson
// teardown unmounts the quiz. Added on feat/assessment-visual-redesign.
describe('tearing down an inline quiz keeps the completion gate shut', () => {
	it('submits nothing and marks no progress when a started quiz is destroyed', async () => {
		const tool = await renderQuizBlock()
		startButton(tool)!.click()
		await flushPromises()
		const choice = tool.wrapper.querySelector<HTMLInputElement>(
			'input[type="radio"]'
		)!
		choice.checked = true
		choice.dispatchEvent(new Event('change'))

		tool.destroy()
		tools = []
		window.dispatchEvent(new Event('pagehide'))
		await vi.advanceTimersByTimeAsync(120_000)

		expect(submitted).not.toContain(SUBMIT_URL)
		expect(called).not.toContain('lms.lms.api.mark_lesson_progress')
		expect(sendBeacon).not.toHaveBeenCalled()
	})

	it('starts a remounted quiz from the beginning, with no result to show', async () => {
		const first = await renderQuizBlock()
		startButton(first)!.click()
		await flushPromises()
		first.destroy()
		tools = []

		const second = await renderQuizBlock()

		expect(startButton(second)).toBeDefined()
		expect(second.wrapper.textContent).not.toContain('Quiz result')
		expect(submitted).not.toContain(SUBMIT_URL)
	})
})
