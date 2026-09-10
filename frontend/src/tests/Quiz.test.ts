import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Quiz from '@/components/Quiz.vue'

const resourceState = vi.hoisted(() => ({
	cache: new Map<string, any>(),
	request: vi.fn(),
	// Every resource submit, by url. `request` only records reads.
	submits: [] as string[],
	response: null as any,
}))

// Copied verbatim from frappe-ui 1.0.0-beta.29 `src/components/Button/Button.vue` so the stub reproduces the real state classes the pager relies on.
const buttonClasses = vi.hoisted(() => ({
	variant: {
		'gray-solid':
			'text-ink-base bg-surface-gray-10 hover:bg-surface-gray-9 active:bg-surface-gray-8',
		'gray-subtle':
			'text-ink-gray-8 bg-surface-gray-2 hover:bg-surface-gray-3 active:bg-surface-gray-4',
		'blue-subtle':
			'text-ink-blue-6 bg-surface-blue-2 hover:bg-surface-blue-3 active:bg-surface-blue-4',
	} as Record<string, string>,
	disabled: {
		'gray-solid': 'bg-surface-gray-2 text-ink-gray-4',
		'gray-subtle': 'bg-surface-gray-2 text-ink-gray-4',
		'blue-subtle': 'bg-surface-blue-2 text-ink-blue-link',
	} as Record<string, string>,
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
				// Match a real network response: let the remounted component finish setup before the cached resource's original callbacks run.
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
			submit: vi.fn(() => {
				resourceState.submits.push(options.url)
			}),
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
			props: {
				label: { type: String, default: undefined },
				theme: { type: String, default: 'gray' },
				variant: { type: String, default: 'subtle' },
				disabled: { type: Boolean, default: false },
			},
			emits: ['click'],
			computed: {
				stateClasses(this: any) {
					const key = `${this.theme}-${this.variant}`
					const map = this.disabled
						? buttonClasses.disabled
						: buttonClasses.variant
					return map[key] ?? ''
				},
			},
			template: `<button type="button" :class="stateClasses" :disabled="disabled" :aria-label="label" @click="$emit('click')"><slot /></button>`,
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
		String(args[index])
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

const mountQuiz = (props: Record<string, unknown> = {}) =>
	mount(Quiz, {
		props: { quizName: 'QUIZ-1', ...props },
		global: {
			provide: { $user: { data: { name: 'learner@example.com' } } },
			mocks: { __: (value: string) => value },
		},
	})

beforeEach(() => {
	resourceState.cache.clear()
	resourceState.request.mockReset()
	resourceState.submits.length = 0
	resourceState.response = quizResponse()
	localStorage.clear()
})

describe('Quiz remount', () => {
	it('restores valid questions without extra requests after remounting the same quiz', async () => {
		const first = mountQuiz()
		await flushPromises()

		expect(first.text()).toContain('1 question')
		expect(first.text()).toContain('Start')
		expect(first.text()).not.toContain(
			'This quiz has no questions available yet.'
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
		expect(second.text()).toContain('1 question')
		expect(second.text()).toContain('Start')
		expect(second.text()).not.toContain(
			'This quiz has no questions available yet.'
		)

		const start = second
			.findAll('button')
			.find((button) => button.text() === 'Start Quiz')
		expect(start).toBeDefined()
		await start!.trigger('click')
		await flushPromises()

		expect(second.text()).toContain('Visible question body')
		expect(resourceState.request).toHaveBeenCalledTimes(2)
		second.unmount()
	})
})

const choicesQuizResponse = (count: number) => ({
	quiz: {
		name: 'QUIZ-1',
		title: 'Quiz pager states',
		duration: 0,
		passing_percentage: 70,
		shuffle_questions: 0,
		show_answers: 0,
		show_submission_history: 0,
		questions: Array.from({ length: count }, (_unused, index) => ({
			question: `Q${index + 1}`,
			marks: 1,
		})),
	},
	questions_by_name: Object.fromEntries(
		Array.from({ length: count }, (_unused, index) => [
			`Q${index + 1}`,
			{
				name: `Q${index + 1}`,
				question: `Question body ${index + 1}`,
				type: 'Choices',
				multiple: 0,
				option_1: `First option ${index + 1}`,
				is_correct_1: 1,
				option_2: `Second option ${index + 1}`,
			},
		])
	),
})

const startQuiz = async (wrapper: VueWrapper<any>) => {
	const start = wrapper
		.findAll('button')
		.find((button) => button.text() === 'Start Quiz')
	expect(start).toBeDefined()
	await start!.trigger('click')
	await flushPromises()
}
describe('Quiz in an author preview', () => {
	beforeEach(() => {
		resourceState.response = choicesQuizResponse(1)
	})

	// The quiz form's Preview mounts this as it ships, and the button is not the
	// only way in: a timed quiz auto-submits and proctoring submits on a
	// violation. That submission is real.
	it('writes nothing when a submit is triggered anyway', async () => {
		vi.useFakeTimers()
		try {
			const wrapper = mountQuiz({ preview: true })
			await flushPromises()
			await startQuiz(wrapper)
			resourceState.submits.length = 0
			;(wrapper.vm as any).submitQuiz('timeout')
			await vi.advanceTimersByTimeAsync(1000)
			await flushPromises()

			expect(resourceState.submits).not.toContain(
				'lms.lms.doctype.lms_quiz.lms_quiz.submit_quiz'
			)
			wrapper.unmount()
		} finally {
			vi.useRealTimers()
		}
	})
})
