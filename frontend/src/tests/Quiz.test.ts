import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Quiz from '@/components/Quiz.vue'

const resourceState = vi.hoisted(() => ({
	cache: new Map<string, any>(),
	request: vi.fn(),
	response: null as any,
}))

vi.mock('frappe-ui', async () => {
	const { reactive } = await import('vue')

	const createResource = (options: any) => {
		const key = options.cache ? JSON.stringify(options.cache) : null
		const cached = key ? resourceState.cache.get(key) : null

		if (cached) {
			if (cached.auto) void cached.reload()
			return cached
		}

		let resource: any
		const reload = vi.fn(async () => {
			resource.loading = true
			const params = options.makeParams?.()
			resourceState.request(options.url, params)

			if (options.url === 'lms.lms.utils.get_quiz_with_questions') {
				// Match a real network response: let the remounted component finish
				// setup before the cached resource's original callbacks run.
				await Promise.resolve()

				const raw = structuredClone(resourceState.response)
				const transformed = options.transform?.(raw)
				resource.data = transformed == null ? raw : transformed
				options.onSuccess?.(raw)
			}

			resource.loading = false
			return resource.data
		})

		resource = reactive({
			auto: options.auto,
			data: null,
			loading: false,
			reload,
			fetch: reload,
			submit: vi.fn(),
			reset: vi.fn(() => {
				resource.data = null
			}),
		})

		if (key) resourceState.cache.set(key, resource)
		if (options.auto) void reload()
		return resource
	}

	const empty = { template: '<div><slot /></div>' }

	return {
		createResource,
		call: vi.fn(),
		toast: { warning: vi.fn(), error: vi.fn() },
		Button: {
			emits: ['click'],
			template: `<button @click="$emit('click')"><slot /></button>`,
		},
		Badge: empty,
		Checkbox: empty,
		Dialog: {
			props: ['open'],
			template: '<div v-if="open"><slot /></div>',
		},
		FormControl: empty,
		ListView: empty,
		LoadingIndicator: empty,
		TextEditor: empty,
	}
})

vi.mock('@/components/ProgressBar.vue', () => ({
	default: { template: '<div />' },
}))

vi.mock('@/utils/sanitizeRichHTML', () => ({
	sanitizeRichHTML: (value: string) => value,
}))

vi.mock('@/utils/format', () => ({
	timeAgo: (value: string) => value,
}))

vi.stubGlobal('__', (value: string) => value)

// `String.format` is supplied by Frappe in the browser runtime.
String.prototype.format = function (...args: unknown[]) {
	return this.replace(/\{(\d+)\}/g, (_match: string, index: number) =>
		String(args[index]),
	)
}

const quizResponse = () => ({
	quiz: {
		name: 'QUIZ-1',
		title: 'Quiz cache regression',
		duration: 0,
		passing_percentage: 70,
		shuffle_questions: 0,
		show_answers: 0,
		show_submission_history: 0,
		questions: [
			{ question: 'Q1', marks: 1 },
			{ question: 'DELETED', marks: 1 },
		],
	},
	questions_by_name: {
		Q1: {
			name: 'Q1',
			question: 'Visible question body',
			type: 'Choices',
			multiple: 0,
			option_1: 'Correct answer',
			is_correct_1: 1,
		},
	},
})

const mountQuiz = () =>
	mount(Quiz, {
		props: { quizName: 'QUIZ-1' },
		global: {
			provide: { $user: { data: { name: 'learner@example.com' } } },
			mocks: { __: (value: string) => value },
		},
	})

beforeEach(() => {
	resourceState.cache.clear()
	resourceState.request.mockReset()
	resourceState.response = quizResponse()
	localStorage.clear()
})

describe('Quiz remount', () => {
	it('restores valid questions without extra requests after remounting the same quiz', async () => {
		const first = mountQuiz()
		await flushPromises()

		expect(first.text()).toContain('This quiz consists of 1 questions.')
		expect(first.text()).toContain('Start')
		expect(first.text()).not.toContain(
			'This quiz has no questions available yet.',
		)
		expect(resourceState.request).toHaveBeenCalledTimes(1)
		first.unmount()

		const second = mountQuiz()
		await flushPromises()

		expect(resourceState.request).toHaveBeenCalledTimes(2)
		expect(resourceState.request.mock.calls).toEqual([
			['lms.lms.utils.get_quiz_with_questions', { quiz: 'QUIZ-1' }],
			['lms.lms.utils.get_quiz_with_questions', { quiz: 'QUIZ-1' }],
		])
		expect(second.text()).toContain('This quiz consists of 1 questions.')
		expect(second.text()).toContain('Start')
		expect(second.text()).not.toContain(
			'This quiz has no questions available yet.',
		)

		const start = second
			.findAll('button')
			.find((button) => button.text() === 'Start')
		expect(start).toBeDefined()
		await start!.trigger('click')
		await flushPromises()

		expect(second.text()).toContain('Visible question body')
		expect(resourceState.request).toHaveBeenCalledTimes(2)
		second.unmount()
	})
})
