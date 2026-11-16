import { flushPromises, mount } from '@vue/test-utils'
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest'

import Quiz from '@/components/Quiz.vue'

const resourceState = vi.hoisted(() => ({
	request: vi.fn(),
	response: null as any,
	attempts: [] as unknown[] | null,
	attemptsFail: false,
}))

vi.mock('frappe-ui', async () => {
	const { reactive } = await import('vue')

	const createResource = (options: any) => {
		let resource: any
		const reload = vi.fn(async () => {
			// Like a real request, answer after setup has assigned the resource.
			await Promise.resolve()
			resource.loading = true
			resourceState.request(options.url, options.makeParams?.())

			if (options.url === 'lms.lms.utils.get_quiz_with_questions') {
				const raw = structuredClone(resourceState.response)
				const transformed = options.transform?.(raw)
				resource.data = transformed == null ? raw : transformed
				options.onSuccess?.(raw)
			} else if (options.url === 'frappe.client.get_list') {
				// null leaves the request in flight.
				if (resourceState.attemptsFail) resource.error = new Error('failed')
				else resource.data = structuredClone(resourceState.attempts)
			}

			resource.loading = false
			return resource.data
		})

		resource = reactive({
			auto: options.auto,
			data: null,
			error: null,
			loading: false,
			reload,
			fetch: reload,
			submit: vi.fn(),
			reset: vi.fn(() => {
				resource.data = null
			}),
		})

		if (options.auto) void reload()
		return resource
	}

	const empty = { template: '<div><slot /></div>' }

	return {
		createResource,
		call: vi.fn(),
		toast: { warning: vi.fn(), error: vi.fn() },
		Button: {
			props: { disabled: { type: Boolean, default: false } },
			emits: ['click'],
			template: `<button type="button" :disabled="disabled" @click="$emit('click')"><slot /></button>`,
		},
		Badge: empty,
		Alert: {
			props: ['title', 'description'],
			template: '<div>{{ title }} {{ description }}</div>',
		},
		Checkbox: {
			props: ['modelValue'],
			template: '<div><slot name="label" /><slot /></div>',
		},
		RadioGroup: {
			props: ['modelValue', 'name'],
			emits: ['update:modelValue'],
			template: '<div><slot /></div>',
		},
		Radio: { props: ['value'], template: '<div><slot name="label" /></div>' },
		Dialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
		FormControl: empty,
		LoadingIndicator: empty,
	}
})

vi.mock('frappe-ui/experimental', () => ({
	ListView: { template: '<div><slot /></div>' },
}))

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

String.prototype.format = function (...args: unknown[]) {
	return this.replace(/\{(\d+)\}/g, (_match: string, index: number) =>
		String(args[index])
	)
}

// The site runs on Asia/Kolkata (+05:30) while the learner's browser runs on
// UTC, so a naive site time read as browser time lands 5.5 hours off.
const SITE_ZONE_OFFSET = '+05:30'
const PAST_NAIVE = '2020-01-15 12:00:00'
const FUTURE_NAIVE = '2099-12-31 18:00:00'
const PAST_ISO = `2020-01-15T12:00:00${SITE_ZONE_OFFSET}`
const FUTURE_ISO = `2099-12-31T18:00:00${SITE_ZONE_OFFSET}`

const scheduledQuizResponse = (window: Record<string, string | null>) => ({
	quiz: {
		name: 'QUIZ-1',
		title: 'Scheduled quiz',
		duration: 10,
		passing_percentage: 70,
		shuffle_questions: 0,
		show_answers: 0,
		show_submission_history: 0,
		max_attempts: 3,
		enable_scheduling: 1,
		...window,
		questions: [{ question: 'Q1', marks: 1 }],
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

const openWindow = {
	schedule_start: PAST_NAIVE,
	schedule_end: FUTURE_NAIVE,
	schedule_start_iso: PAST_ISO,
	schedule_end_iso: FUTURE_ISO,
}

const notOpenWindow = {
	schedule_start: FUTURE_NAIVE,
	schedule_end: null,
	schedule_start_iso: FUTURE_ISO,
	schedule_end_iso: null,
}

const mountQuiz = async (props: Record<string, unknown> = {}) => {
	const wrapper = mount(Quiz, {
		props: { quizName: 'QUIZ-1', ...props },
		global: {
			provide: { $user: { data: { name: 'learner@example.com' } } },
			mocks: { __: (value: string) => value },
			stubs: {
				QuizStats: { template: '<div data-testid="quiz-stats" />' },
				Alert: {
					props: ['title', 'description'],
					template: '<div>{{ title }} {{ description }}</div>',
				},
			},
		},
	})
	await flushPromises()
	return wrapper
}

const startButton = (wrapper: Awaited<ReturnType<typeof mountQuiz>>) =>
	wrapper.findAll('button').find((button) => button.text() === 'Start Quiz')

let originalTZ: string | undefined

beforeAll(() => {
	originalTZ = process.env.TZ
	process.env.TZ = 'UTC'
})

afterAll(() => {
	process.env.TZ = originalTZ
})

beforeEach(() => {
	resourceState.request.mockReset()
	resourceState.attempts = []
	resourceState.attemptsFail = false
	localStorage.clear()
})

describe('Scheduled quiz start screen', () => {
	it('shows only when it opens before the quiz opens', async () => {
		resourceState.response = scheduledQuizResponse(notOpenWindow)
		const wrapper = await mountQuiz()

		const notice = wrapper.find('[data-testid="quiz-schedule-notice"]')
		expect(notice.attributes('data-state')).toBe('not_started')
		// 18:00 at +05:30 is 12:30 in the learner's UTC browser, not 6:00 PM.
		expect(notice.text()).toContain('Opens on Thursday, 31 December 2099 at 12:30 PM')
		expect(wrapper.find('[data-testid="quiz-stats"]').exists()).toBe(false)
		expect(wrapper.text()).not.toContain('attempts left')
		expect(wrapper.text()).not.toContain('Before you start')
		expect(startButton(wrapper)).toBeUndefined()
		wrapper.unmount()
	})

	it('shows the details, the closing time and Start while it is open', async () => {
		resourceState.response = scheduledQuizResponse(openWindow)
		const wrapper = await mountQuiz()

		const notice = wrapper.find('[data-testid="quiz-schedule-notice"]')
		expect(notice.attributes('data-state')).toBe('open')
		expect(notice.text()).toContain(
			'Open until Thursday, 31 December 2099 at 12:30 PM'
		)
		expect(wrapper.find('[data-testid="quiz-stats"]').exists()).toBe(true)
		expect(wrapper.text()).toContain('Before you start')
		expect(startButton(wrapper)).toBeDefined()
		wrapper.unmount()
	})

	// The author's own submissions load in a preview, so their count says nothing
	// about what a student will see.
	it('shows the configured attempts, not the author\'s, in a preview', async () => {
		resourceState.response = scheduledQuizResponse(openWindow)
		const wrapper = await mountQuiz({ preview: true })

		const stats = wrapper.find('[data-testid="quiz-stats"]')
		expect(stats.attributes('maxattempts')).toBe('3')
		expect(stats.attributes('attemptsleft')).toBeUndefined()
		expect(wrapper.text()).not.toContain('attempts left')
		wrapper.unmount()
	})

	it('lets an author who used up their own attempts start a preview', async () => {
		resourceState.response = scheduledQuizResponse(openWindow)
		resourceState.attempts = [{ name: 'S1' }, { name: 'S2' }, { name: 'S3' }]
		const wrapper = await mountQuiz({ preview: true })

		expect(startButton(wrapper)).toBeDefined()
		expect(wrapper.text()).not.toContain("You've used all")
		wrapper.unmount()
	})

	it('waits for the learner\'s attempts before offering Start', async () => {
		resourceState.response = scheduledQuizResponse(openWindow)
		resourceState.attempts = null
		const wrapper = await mountQuiz()

		expect(startButton(wrapper)).toBeUndefined()
		const stats = wrapper.find('[data-testid="quiz-stats"]')
		expect(stats.attributes('attemptsloading')).toBe('true')
		expect(stats.attributes('maxattempts')).toBeUndefined()
		wrapper.unmount()
	})

	it('offers Try again, not Start, when the attempts fail to load', async () => {
		resourceState.response = scheduledQuizResponse(openWindow)
		resourceState.attemptsFail = true
		const wrapper = await mountQuiz()

		expect(startButton(wrapper)).toBeUndefined()
		expect(wrapper.text()).toContain("Your past attempts didn't load.")
		expect(
			wrapper.findAll('button').some((button) => button.text() === 'Try again')
		).toBe(true)
		wrapper.unmount()
	})

	it('asks for no camera while the attempts cannot load', async () => {
		resourceState.response = scheduledQuizResponse(openWindow)
		resourceState.response.quiz.enable_proctoring = 1
		resourceState.attemptsFail = true
		const wrapper = await mountQuiz()

		expect(wrapper.text()).not.toContain('Camera Setup')
		wrapper.unmount()
	})

	it('keeps Resume Video beside Try again in a video', async () => {
		resourceState.response = scheduledQuizResponse(openWindow)
		resourceState.attemptsFail = true
		const wrapper = await mountQuiz({ inVideo: true, backToVideo: vi.fn() })

		const labels = wrapper.findAll('button').map((button) => button.text())
		expect(labels).toContain('Resume Video')
		expect(labels).toContain('Try again')
		wrapper.unmount()
	})

	it('shows only when it closed after the quiz closes', async () => {
		resourceState.response = scheduledQuizResponse({
			schedule_start: null,
			schedule_end: PAST_NAIVE,
			schedule_start_iso: null,
			schedule_end_iso: PAST_ISO,
		})
		const wrapper = await mountQuiz()

		const notice = wrapper.find('[data-testid="quiz-schedule-notice"]')
		expect(notice.attributes('data-state')).toBe('ended')
		expect(notice.text()).toContain(
			'This quiz closed on Wednesday, 15 January 2020 at 6:30 AM'
		)
		expect(wrapper.find('[data-testid="quiz-stats"]').exists()).toBe(false)
		expect(startButton(wrapper)).toBeUndefined()
		wrapper.unmount()
	})

	// The server withholds the questions from a student until the quiz opens.
	it('says when it opens, not that it has no questions, for a student', async () => {
		resourceState.response = scheduledQuizResponse(notOpenWindow)
		resourceState.response.quiz.questions = []
		resourceState.response.questions_by_name = {}
		const wrapper = await mountQuiz()

		expect(
			wrapper.find('[data-testid="quiz-schedule-notice"]').attributes('data-state')
		).toBe('not_started')
		expect(wrapper.text()).not.toContain('no questions')
		wrapper.unmount()
	})
})
