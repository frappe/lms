/**
 * Quiz.vue — timer lifecycle and per-quiz state across a reuse.
 *
 * Two bugs, both on the lesson-navigation path that #2559 exposed:
 *
 * 1. `startTimer()` stored its handle in a setup-scoped `timerInterval` that
 *    `onUnmounted` never cleared. A learner who started a timed quiz and then
 *    navigated away left the interval running; on expiry it called
 *    `submitQuiz()` for the abandoned quiz, and `markLessonProgress()` reads
 *    `window.location.pathname` at submit time — so it credited whichever
 *    lesson the learner had since opened.
 *
 * 2. The lesson-level quiz is mounted without a `:key`, so moving between two
 *    lessons that both carry a quiz reuses the instance. The `quizName` watcher
 *    only called `quiz.reload()`, leaving the previous quiz's answers, flagged
 *    questions and submission on screen.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import Quiz from '@/components/Quiz.vue'

const QUIZ_URL = 'lms.lms.utils.get_quiz_with_questions'
const SUBMIT_URL = 'lms.lms.doctype.lms_quiz.lms_quiz.submit_quiz'
const ATTEMPTS_URL = 'frappe.client.get_list'

const submitSpy = vi.fn()
const abortSpy = vi.fn()
const resetSpy = vi.fn()

const question = (name: string) => ({
	name,
	question: `What is ${name}?`,
	type: 'Choices',
	multiple: 0,
	option_1: 'a',
	option_2: 'b',
	is_correct_1: 1,
	is_correct_2: 0,
})

// `duration` is in minutes; 1 gives a 60s countdown we can run out with fake
// timers. `show_answers` off so submitQuiz takes the deferred branch.
const quizFixture = (name: string) => ({
	quiz: {
		name,
		title: `${name} title`,
		duration: 1,
		show_answers: 0,
		max_attempts: 0,
		questions: [{ question: `${name}-q1` }],
	},
	questions_by_name: { [`${name}-q1`]: question(`${name}-q1`) },
})

let currentQuiz = 'quiz-a'
let neverResolve = false

vi.mock('frappe-ui', async () => {
	const { reactive } = await import('vue')

	const createResource = (options: any) => {
		const resource: any = reactive({
			data: null,
			loading: false,
			reload: async () => {
				if (options.url !== QUIZ_URL) return resource.data
				// A real response never lands during setup(); without this the
				// auto-fetch would run onSuccess before the component's own
				// consts exist.
				await Promise.resolve()
				if (neverResolve) return new Promise(() => {})
				const raw = structuredClone(quizFixture(currentQuiz))
				const transformed = options.transform?.(raw)
				resource.data = transformed === undefined ? raw : transformed
				options.onSuccess?.(raw)
				return resource.data
			},
			submit: (values: any, handlers: any) => {
				submitSpy(options.url)
				handlers?.onSuccess?.({})
			},
			abort: () => {
				abortSpy(options.url)
			},
			reset: () => {
				resetSpy(options.url)
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
		toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
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

// `__` and String.format are frappe globals used in <script>/template.
vi.stubGlobal('__', (v: string) => v)
String.prototype.format = function (...args: unknown[]) {
	return this.replace(/\{(\d+)\}/g, (_: string, i: number) => String(args[i]))
}

const mountQuiz = (quizName: string) =>
	mount(Quiz, {
		props: { quizName },
		global: {
			provide: { $user: { data: { name: 'student@example.com' } } },
			mocks: { __: (s: string) => s },
			stubs: { teleport: true },
		},
	})

describe('Quiz.vue timer lifecycle', () => {
	beforeEach(() => {
		submitSpy.mockClear()
		abortSpy.mockClear()
		resetSpy.mockClear()
		currentQuiz = 'quiz-a'
		neverResolve = false
		localStorage.clear()
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('does not submit after the component is unmounted', async () => {
		const wrapper = mountQuiz('quiz-a')
		await flushPromises()

		// Start the quiz — this is what arms the countdown.
		;(wrapper.vm as any).startQuiz()
		await flushPromises()

		wrapper.unmount()

		// Run well past the 60s duration. On the unfixed component the orphaned
		// interval reaches zero here and fires submitQuiz().
		await vi.advanceTimersByTimeAsync(90_000)

		expect(submitSpy).not.toHaveBeenCalled()
	})

	it('leaves no interval running after unmount', async () => {
		const wrapper = mountQuiz('quiz-a')
		await flushPromises()
		;(wrapper.vm as any).startQuiz()
		await flushPromises()

		expect(vi.getTimerCount()).toBeGreaterThan(0)
		wrapper.unmount()
		expect(vi.getTimerCount()).toBe(0)
	})

	it('starting twice does not stack intervals', async () => {
		const wrapper = mountQuiz('quiz-a')
		await flushPromises()
		;(wrapper.vm as any).startQuiz()
		await flushPromises()
		const afterFirst = vi.getTimerCount()
		;(wrapper.vm as any).startQuiz()
		await flushPromises()

		expect(vi.getTimerCount()).toBe(afterFirst)
		wrapper.unmount()
	})
})

describe('Quiz.vue state reset when the instance is reused', () => {
	beforeEach(() => {
		submitSpy.mockClear()
		abortSpy.mockClear()
		resetSpy.mockClear()
		currentQuiz = 'quiz-a'
		neverResolve = false
		localStorage.clear()
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('clears the previous quiz answers, flags and progress', async () => {
		const wrapper = mountQuiz('quiz-a')
		await flushPromises()

		const vm = wrapper.vm as any
		vm.startQuiz()
		// The activeQuestion watcher populates questionDetails, which markAnswer
		// reads — let it run before answering.
		await flushPromises()
		vm.markAnswer(1)
		vm.markForReview({ target: { checked: true } }, 1)
		await flushPromises()

		expect(vm.activeQuestion).toBe(1)
		expect(vm.reviewQuestions).toContain(1)
		expect(vm.selectedOptions[0]).toBe(1)

		// Same instance, different quiz — what lesson-to-lesson navigation does.
		currentQuiz = 'quiz-b'
		await wrapper.setProps({ quizName: 'quiz-b' })
		await flushPromises()

		expect(vm.activeQuestion).toBe(0)
		expect(vm.reviewQuestions).toEqual([])
		expect(vm.selectedOptions[0]).toBe(0)
		expect(vm.attemptedQuestions).toEqual([])

		wrapper.unmount()
	})

	it('does not carry the previous quiz timer into the next quiz', async () => {
		const wrapper = mountQuiz('quiz-a')
		await flushPromises()
		;(wrapper.vm as any).startQuiz()
		await flushPromises()

		currentQuiz = 'quiz-b'
		await wrapper.setProps({ quizName: 'quiz-b' })
		await flushPromises()

		// The previous countdown must be gone; the new quiz has not been started.
		expect(vi.getTimerCount()).toBe(0)
		await vi.advanceTimersByTimeAsync(90_000)
		expect(submitSpy).not.toHaveBeenCalled()

		wrapper.unmount()
	})
})

describe('Quiz.vue submit and reset on a reused instance', () => {
	beforeEach(() => {
		submitSpy.mockClear()
		abortSpy.mockClear()
		resetSpy.mockClear()
		currentQuiz = 'quiz-a'
		neverResolve = false
		localStorage.clear()
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('does not fire the deferred submit after unmount', async () => {
		const wrapper = mountQuiz('quiz-a')
		await flushPromises()
		const vm = wrapper.vm as any
		vm.startQuiz()
		await flushPromises()

		// Run the countdown out: submitQuiz() defers createSubmission() by 500ms.
		await vi.advanceTimersByTimeAsync(60_000)
		wrapper.unmount()
		await vi.advanceTimersByTimeAsync(5_000)

		expect(submitSpy).not.toHaveBeenCalled()
	})

	// The submission is deliberately NOT aborted — the POST has reached the
	// server and the attempt is spent either way, so cancelling would only hide
	// the result. A late response is ignored instead.
	it('does not abort an in-flight submission when the quiz changes', async () => {
		const wrapper = mountQuiz('quiz-a')
		await flushPromises()
		;(wrapper.vm as any).startQuiz()
		await flushPromises()

		currentQuiz = 'quiz-b'
		await wrapper.setProps({ quizName: 'quiz-b' })
		await flushPromises()

		expect(abortSpy).not.toHaveBeenCalled()
		wrapper.unmount()
	})

	it('keeps the start screen usable after Try Again', async () => {
		// resetQuiz() is the Try Again handler. Clearing `attempts` there left the
		// start card with neither a Start button nor the exceeded message, both of
		// which read attempts.data?.length.
		const wrapper = mountQuiz('quiz-a')
		await flushPromises()
		const vm = wrapper.vm as any
		vm.attempts.data = [{ name: 'sub-1' }]

		vm.resetQuiz()
		await flushPromises()

		expect(vm.activeQuestion).toBe(0)
		expect(vm.attempts.data).not.toBeNull()
		wrapper.unmount()
	})

	it('clears the previous quiz attempts when the quiz changes', async () => {
		const wrapper = mountQuiz('quiz-a')
		await flushPromises()

		resetSpy.mockClear()
		currentQuiz = 'quiz-b'
		await wrapper.setProps({ quizName: 'quiz-b' })
		await flushPromises()

		expect(resetSpy).toHaveBeenCalledWith(ATTEMPTS_URL)
		wrapper.unmount()
	})

	it('survives a quiz change before the first quiz has loaded', async () => {
		// setupTimer() used to read quiz.data.duration unguarded, so this threw
		// before the watcher could reload — leaving the learner on an empty quiz.
		neverResolve = true
		const wrapper = mountQuiz('quiz-a')
		await flushPromises()
		expect((wrapper.vm as any).quiz.data).toBeNull()

		neverResolve = false
		currentQuiz = 'quiz-b'
		await wrapper.setProps({ quizName: 'quiz-b' })
		await flushPromises()

		expect((wrapper.vm as any).quiz.data?.name).toBe('quiz-b')
		wrapper.unmount()
	})
})
