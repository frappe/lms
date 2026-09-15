/**
 * Quiz.vue — what happens when a submission request fails.
 *
 * The error branch used to re-submit the quiz without violation events, so a
 * request that failed *after* the server had already created the submission —
 * or whose response was simply lost — spent a second attempt and recorded a
 * duplicate. Saving the violation log is best effort on the server now, so
 * nothing here is worth an automatic retry: the failure is shown to the learner
 * and the next attempt is theirs to make.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import Quiz from '@/components/Quiz.vue'

const SUBMIT_URL = 'lms.lms.doctype.lms_quiz.lms_quiz.submit_quiz'
const QUIZ_URL = 'lms.lms.utils.get_quiz_with_questions'

const submitSpy = vi.fn()
const { toastMock } = vi.hoisted(() => ({
	toastMock: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
}))

// 'fails' is the generic branch under test; 'succeeds' is only used to read back
// the params a normal submission sends.
let submitOutcome: 'fails' | 'succeeds' = 'fails'

const quizFixture = () => ({
	quiz: {
		name: 'quiz-a',
		title: 'quiz-a title',
		duration: 0,
		show_answers: 0,
		max_attempts: 0,
		enable_proctoring: 1,
		max_violations: 3,
		questions: [{ question: 'quiz-a-q1' }],
	},
	questions_by_name: {
		'quiz-a-q1': {
			name: 'quiz-a-q1',
			question: 'What is quiz-a-q1?',
			type: 'Choices',
			multiple: 0,
			option_1: 'a',
			option_2: 'b',
			is_correct_1: 1,
			is_correct_2: 0,
		},
	},
})

vi.mock('frappe-ui', async () => {
	const { reactive } = await import('vue')

	const createResource = (options: any) => {
		const resource: any = reactive({
			data: null,
			loading: false,
			reload: async () => {
				if (options.url !== QUIZ_URL) return resource.data
				// A real response never lands during setup().
				await Promise.resolve()
				const raw = structuredClone(quizFixture())
				const transformed = options.transform?.(raw)
				resource.data = transformed === undefined ? raw : transformed
				options.onSuccess?.(raw)
				return resource.data
			},
			submit: (values: any, handlers: any) => {
				submitSpy(options.url, options.makeParams?.(values))
				if (options.url !== SUBMIT_URL) return
				if (submitOutcome === 'succeeds') {
					resource.data = { submission: 'sub-1', score: 1, score_out_of: 1 }
					handlers?.onSuccess?.(resource.data)
					return
				}
				handlers?.onError?.({
					message: 'InternalServerError',
					messages: ['Something went wrong'],
				})
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
		call: vi.fn(),
		toast: toastMock,
		Button: {
			emits: ['click'],
			template: `<button @click="$emit('click')"><slot /></button>`,
		},
		Badge: passthrough,
		Checkbox: passthrough,
		Dialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
		FormControl: passthrough,
		ListView: passthrough,
		LoadingIndicator: passthrough,
		TextEditor: passthrough,
	}
})

vi.mock('@/components/ProctoringMonitor.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/ProgressBar.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/ResponsiveListView.vue', () => ({
	default: { template: '<div><slot /></div>' },
}))
vi.mock('@/components/RichTextEditor.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/utils/sanitizeRichHTML', () => ({
	sanitizeRichHTML: (v: string) => v,
}))
vi.mock('@/utils/format', () => ({ timeAgo: (v: string) => v }))

vi.stubGlobal('__', (v: string) => v)
String.prototype.format = function (...args: unknown[]) {
	return this.replace(/\{(\d+)\}/g, (_: string, i: number) => String(args[i]))
}

const mountQuiz = () =>
	mount(Quiz, {
		props: { quizName: 'quiz-a' },
		global: {
			provide: { $user: { data: { name: 'student@example.com' } } },
			mocks: { __: (s: string) => s },
			stubs: { teleport: true },
		},
	})

const submissionCalls = () =>
	submitSpy.mock.calls.filter(([url]) => url === SUBMIT_URL)

// submitQuiz() defers createSubmission() by 500ms when show_answers is off.
const runDeferredSubmit = async () => {
	await vi.advanceTimersByTimeAsync(1_000)
	await flushPromises()
}

describe('Quiz.vue failed submission', () => {
	beforeEach(() => {
		submitSpy.mockClear()
		toastMock.error.mockClear()
		submitOutcome = 'fails'
		localStorage.clear()
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('posts the submission exactly once', async () => {
		const wrapper = mountQuiz()
		await flushPromises()
		const vm = wrapper.vm as any
		vm.startQuiz()
		await flushPromises()

		vm.submitQuiz()
		await runDeferredSubmit()

		expect(submissionCalls()).toHaveLength(1)
		wrapper.unmount()
	})

	it('tells the learner instead of retrying silently', async () => {
		const wrapper = mountQuiz()
		await flushPromises()
		const vm = wrapper.vm as any
		vm.startQuiz()
		await flushPromises()

		vm.submitQuiz()
		await runDeferredSubmit()

		expect(toastMock.error).toHaveBeenCalledWith('Something went wrong')
		wrapper.unmount()
	})

	it('does not retry an auto-submit triggered by max violations', async () => {
		const wrapper = mountQuiz()
		await flushPromises()
		const vm = wrapper.vm as any
		vm.startQuiz()
		await flushPromises()

		vm.handleViolation('tab_switch')
		vm.handleViolation('no_face')
		vm.handleViolation('focus_loss')
		await runDeferredSubmit()

		expect(submissionCalls()).toHaveLength(1)
		wrapper.unmount()
	})
})

describe('Quiz.vue submission payload', () => {
	beforeEach(() => {
		submitSpy.mockClear()
		submitOutcome = 'succeeds'
		localStorage.clear()
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('always ships the violation log, oldest event first', async () => {
		// The server derives the stored violation count from this list, so it can
		// never be dropped from a submission, and its order has to be real.
		const wrapper = mountQuiz()
		await flushPromises()
		const vm = wrapper.vm as any
		vm.startQuiz()
		await flushPromises()

		vm.handleViolation('tab_switch')
		vm.handleViolation('no_face')
		vm.submitQuiz()
		await runDeferredSubmit()

		const [, params] = submissionCalls()[0]
		const events = JSON.parse(params.violation_events)
		expect(events.map((event: any) => event.eventType)).toEqual([
			'tab_switch',
			'no_face',
		])
		expect(params.violation_count).toBe(2)
		wrapper.unmount()
	})
})
