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
const { toastMock, routerGuards } = vi.hoisted(() => ({
	toastMock: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
	// The guards Quiz.vue registers on the app router, so a test can run a navigation.
	routerGuards: [] as ((
		to: { fullPath: string },
		from: { fullPath: string }
	) => unknown)[],
}))

vi.mock('@/router', () => ({
	default: {
		beforeEach: (guard: typeof routerGuards[number]) => {
			routerGuards.push(guard)
			return () => routerGuards.splice(routerGuards.indexOf(guard), 1)
		},
	},
}))

// 'fails' is the generic branch under test; 'succeeds' is only used to read back
// the params a normal submission sends.
let submitOutcome: 'fails' | 'succeeds' = 'fails'
// Per-test changes to the quiz the mocked server returns.
let quizOverrides: Record<string, unknown> = {}
// What a successful submit_quiz returns.
let submitResult: Record<string, unknown> = {
	submission: 'sub-1',
	score: 1,
	score_out_of: 1,
}

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
				Object.assign(raw.quiz, quizOverrides)
				const transformed = options.transform?.(raw)
				resource.data = transformed === undefined ? raw : transformed
				options.onSuccess?.(raw)
				return resource.data
			},
			submit: (values: any, handlers: any) => {
				submitSpy(options.url, options.makeParams?.(values))
				if (options.url !== SUBMIT_URL) return
				if (submitOutcome === 'succeeds') {
					resource.data = { ...submitResult }
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
		Radio: { props: ['value'], template: '<div><slot name="label" /></div>' },
		RadioGroup: {
			props: ['modelValue', 'name'],
			template: '<div><slot /></div>',
		},
		Dialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
		FormControl: passthrough,
		LoadingIndicator: passthrough,
		Progress: passthrough,
		Skeleton: passthrough,
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

// Guards the violation count sitting in a row of its own under the header.
// Added on quiz-share-link, when it moved into the header beside the timer.
describe('Quiz.vue violation count', () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it('shows in the header while a proctored attempt runs', async () => {
		const wrapper = mountQuiz()
		await flushPromises()
		expect(wrapper.find('[data-testid="violation-count"]').exists()).toBe(false)

		const vm = wrapper.vm as any
		vm.startQuiz()
		await flushPromises()
		const count = () => wrapper.get('[data-testid="violation-count"]').text()
		expect(count()).toContain('0 / 3')

		vm.handleViolation('tab_switch')
		await flushPromises()
		expect(count()).toContain('1 / 3')
		wrapper.unmount()
	})
})

// Guards a proctored attempt being left for another page in the app with nothing
// noticing: no tab switch, no unload. Added on quiz-share-link with the guard.
describe('Quiz.vue leaving a proctored attempt', () => {
	const navigate = () =>
		routerGuards.at(-1)!(
			{ fullPath: '/lms/courses/c/learn/1-2' },
			{ fullPath: '/lms/courses/c/learn/1-1' }
		) as Promise<boolean>

	beforeEach(() => {
		localStorage.clear()
		submitSpy.mockClear()
		submitOutcome = 'succeeds'
	})

	const leftPageSubmits = () =>
		submissionCalls().filter(([, params]) =>
			JSON.stringify(params).includes('left_page')
		)

	const started = async () => {
		const wrapper = mountQuiz()
		await flushPromises()
		;(wrapper.vm as any).startQuiz()
		await flushPromises()
		return wrapper
	}

	it('asks first, and staying keeps the learner on the quiz', async () => {
		const wrapper = await started()

		const leaving = navigate()
		await flushPromises()
		expect((wrapper.vm as any).showLeaveConfirmation).toBe(true)
		;(wrapper.vm as any).answerLeave(false)
		expect(await leaving).toBe(false)
		expect(submissionCalls()).toHaveLength(0)
		wrapper.unmount()
	})

	it('submits the attempt when the learner leaves anyway', async () => {
		const wrapper = await started()

		const leaving = navigate()
		await flushPromises()
		;(wrapper.vm as any).answerLeave(true)

		expect(await leaving).toBe(true)
		expect(leftPageSubmits()).toHaveLength(1)
		wrapper.unmount()
	})

	// Guards the learner leaving with nothing saved when the server rejects the
	// submit, as when the schedule closes while the dialog is open.
	it('keeps the learner on the quiz when the save fails', async () => {
		submitOutcome = 'fails'
		const wrapper = await started()

		const leaving = navigate()
		await flushPromises()
		;(wrapper.vm as any).answerLeave(true)

		expect(await leaving).toBe(false)
		// The attempt is still live, so proctoring keeps counting.
		;(wrapper.vm as any).handleViolation('tab_switch')
		expect((wrapper.vm as any).violationCount).toBe(1)
		wrapper.unmount()
	})

	// Guards a second submit, which could spend another attempt, when the learner
	// leaves while one is already on its way.
	it('waits for a submit already under way instead of sending another', async () => {
		vi.useFakeTimers()
		try {
			const wrapper = await started()
			;(wrapper.vm as any).submitQuiz()

			const leaving = navigate()
			await vi.advanceTimersByTimeAsync(1_000)

			expect(await leaving).toBe(true)
			expect((wrapper.vm as any).showLeaveConfirmation).toBe(false)
			expect(submissionCalls()).toHaveLength(1)
			wrapper.unmount()
		} finally {
			vi.useRealTimers()
		}
	})

	// Guards the attempt being submitted twice when the timer or the violation
	// cap saves it while the leave dialog is still open.
	it('does not submit again when the attempt was saved while the dialog was open', async () => {
		vi.useFakeTimers()
		try {
			const wrapper = await started()
			const leaving = navigate()
			await vi.advanceTimersByTimeAsync(0)
			expect((wrapper.vm as any).showLeaveConfirmation).toBe(true)
			;(wrapper.vm as any).submitQuiz('timer_expired')
			await vi.advanceTimersByTimeAsync(1_000)
			;(wrapper.vm as any).answerLeave(true)

			expect(await leaving).toBe(true)
			expect(submissionCalls()).toHaveLength(1)
			expect(leftPageSubmits()).toHaveLength(0)
			wrapper.unmount()
		} finally {
			vi.useRealTimers()
		}
	})

	// Guards the timer, or a second press of Submit, recording another
	// submission while one is already on its way.
	it('sends one submission when a second submit comes in while one is under way', async () => {
		vi.useFakeTimers()
		try {
			const wrapper = await started()
			;(wrapper.vm as any).submitQuiz('manual')
			;(wrapper.vm as any).submitQuiz('timer_expired')
			await vi.advanceTimersByTimeAsync(1_000)

			expect(submissionCalls()).toHaveLength(1)
			wrapper.unmount()
		} finally {
			vi.useRealTimers()
		}
	})

	// Guards the attempt going unsaved when the timer expires within the 500ms a
	// pressed Submit waits: that submit must still go out, once.
	it('still submits once when the timer expires just after Submit', async () => {
		vi.useFakeTimers()
		quizOverrides = { duration: 1, enable_proctoring: 0 }
		try {
			const wrapper = await started()
			await vi.advanceTimersByTimeAsync(59_800)
			;(wrapper.vm as any).submitQuiz('manual')
			await vi.advanceTimersByTimeAsync(2_000)

			const calls = submissionCalls()
			expect(calls).toHaveLength(1)
			expect(JSON.stringify(calls[0][1])).toContain('manual')
			wrapper.unmount()
		} finally {
			quizOverrides = {}
			vi.useRealTimers()
		}
	})

	// Guards an automatic retry when the timer expires during a submit that then
	// fails: a lost response can mean the attempt was saved, so a second submit
	// could duplicate it. The learner resubmits, as after any failure.
	it('does not resubmit on expiry when the submit under way fails', async () => {
		vi.useFakeTimers()
		quizOverrides = { duration: 1, enable_proctoring: 0 }
		submitOutcome = 'fails'
		try {
			const wrapper = await started()
			await vi.advanceTimersByTimeAsync(59_800)
			;(wrapper.vm as any).submitQuiz('manual')
			await vi.advanceTimersByTimeAsync(3_000)

			const reasons = submissionCalls().map(([, p]) =>
				JSON.stringify(p).includes('timer_expired') ? 'timer_expired' : 'manual'
			)
			expect(reasons).toEqual(['manual'])
			wrapper.unmount()
		} finally {
			quizOverrides = {}
			vi.useRealTimers()
		}
	})

	it('never asks in an author preview', async () => {
		const wrapper = mount(Quiz, {
			props: { quizName: 'quiz-a', preview: true },
			global: {
				provide: { $user: { data: { name: 'author@example.com' } } },
				mocks: { __: (s: string) => s },
			},
		})
		await flushPromises()
		;(wrapper.vm as any).startQuiz()
		await flushPromises()

		expect(await navigate()).toBe(true)
		expect((wrapper.vm as any).showLeaveConfirmation).toBe(false)
		wrapper.unmount()
	})

	it('lets the learner go freely before the attempt starts', async () => {
		const wrapper = mountQuiz()
		await flushPromises()

		expect(await navigate()).toBe(true)
		wrapper.unmount()
	})

	it('stops guarding once the quiz is gone', async () => {
		const wrapper = await started()
		const before = routerGuards.length

		wrapper.unmount()

		expect(routerGuards.length).toBe(before - 1)
	})
})

// Guards the timer note sitting by the Start button, apart from the other rules.
// Added on quiz-share-link, when it became a numbered point in the list.
describe('Quiz.vue before-you-start list', () => {
	afterEach(() => {
		quizOverrides = {}
	})

	it('lists leaving the page, then the timer, for a timed proctored quiz', async () => {
		quizOverrides = { duration: 10 }
		const wrapper = mountQuiz()
		await flushPromises()

		const text = wrapper.text()
		const leaving = text.indexOf('leaving this page will submit')
		const timer = text.indexOf('The timer starts as soon as you begin.')
		expect(leaving).toBeGreaterThan(-1)
		expect(timer).toBeGreaterThan(leaving)
		expect(text.split('The timer starts as soon as you begin.')).toHaveLength(2)
		wrapper.unmount()
	})
})

// Guards the result screen: a sentence of score with no verdict, a Try Again
// beside a message saying to ask the instructor, and the activity as a separate
// box with no times. Added on quiz-share-link with the redesigned result.
describe('Quiz.vue result', () => {
	const failedWithRetries = {
		submission: 'sub-1',
		score: 8,
		score_out_of: 20,
		percentage: 40,
		pass: false,
		correct: 4,
		wrong: 5,
		unanswered: 1,
		is_open_ended: 0,
	}

	beforeEach(() => {
		submitOutcome = 'succeeds'
		localStorage.clear()
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
		quizOverrides = {}
		submitResult = { submission: 'sub-1', score: 1, score_out_of: 1 }
	})

	const finish = async (overrides = {}, result = failedWithRetries) => {
		quizOverrides = overrides
		submitResult = result
		const wrapper = mountQuiz()
		await flushPromises()
		;(wrapper.vm as any).startQuiz()
		await flushPromises()
		return wrapper
	}

	const tryAgain = (wrapper: any) =>
		wrapper.findAll('button').find((b: any) => b.text() === 'Try again')

	it('shows the verdict, marks and answer counts', async () => {
		const wrapper = await finish({ enable_proctoring: 0, max_attempts: 3 })
		;(wrapper.vm as any).submitQuiz()
		await runDeferredSubmit()

		const text = wrapper.text()
		expect(wrapper.get('[data-testid="quiz-verdict"]').text()).toBe('Failed')
		expect(text).toContain('8 of 20 marks')
		expect(text).toContain('40%')
		expect(wrapper.get('[data-testid="answer-counts"]').text()).toContain(
			'4 correct'
		)
		expect(text).toContain('5 wrong')
		expect(text).toContain('1 not answered')
		expect(tryAgain(wrapper)).toBeDefined()
		// Once, by Try again, not again in the header.
		expect(text.split('attempts left')).toHaveLength(2)
		// The result says the score; the header's quiz summary would repeat it.
		expect(text).not.toContain('pass at')
		wrapper.unmount()
	})

	it('says Passed on a pass', async () => {
		const wrapper = await finish(
			{ enable_proctoring: 0 },
			{ ...failedWithRetries, score: 16, percentage: 80, pass: true }
		)
		;(wrapper.vm as any).submitQuiz()
		await runDeferredSubmit()

		expect(wrapper.get('[data-testid="quiz-verdict"]').text()).toBe('Passed')
		wrapper.unmount()
	})

	it('sends a learner who hit the violation cap to the instructor, not a retry', async () => {
		const wrapper = await finish()
		const vm = wrapper.vm as any
		vm.handleViolation('tab_switch')
		vm.handleViolation('no_face')
		vm.handleViolation('focus_loss')
		await runDeferredSubmit()

		const text = wrapper.text()
		expect(text).toContain(
			'Submitted automatically after 3 of 3 violations. If you wish to try again, reach out to the instructor.'
		)
		expect(tryAgain(wrapper)).toBeUndefined()
		wrapper.unmount()
	})

	// Guards this attempt's stills, inline images, being dropped by the link
	// allowlist, so the log showed no photos until a reload.
	it('shows the camera still captured during the attempt', async () => {
		const wrapper = await finish()
		const vm = wrapper.vm as any
		vm.handleWarning('no_face', 'data:image/jpeg;base64,AAAA')
		vm.submitQuiz()
		await runDeferredSubmit()

		const still = wrapper.get('[data-testid="activity-row"] img')
		expect(still.attributes('src')).toBe('data:image/jpeg;base64,AAAA')
		wrapper.unmount()
	})

	it('lists the activity with the time into the attempt', async () => {
		const wrapper = await finish()
		const vm = wrapper.vm as any
		await vi.advanceTimersByTimeAsync(125_000)
		vm.handleWarning('no_face')
		vm.submitQuiz()
		await runDeferredSubmit()

		const rows = wrapper.findAll('[data-testid="activity-row"]')
		expect(rows).toHaveLength(1)
		expect(rows[0].text()).toContain('02:05')
		expect(rows[0].text()).toContain('Face not visible')
		expect(wrapper.get('[data-testid="activity-tally"]').text()).toBe(
			'1 warning'
		)
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
