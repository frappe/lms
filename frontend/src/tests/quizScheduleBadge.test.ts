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
}))

vi.mock('frappe-ui', async () => {
	const { reactive } = await import('vue')

	const createResource = (options: any) => {
		let resource: any
		const reload = vi.fn(async () => {
			resource.loading = true
			resourceState.request(options.url, options.makeParams?.())

			if (options.url === 'lms.lms.utils.get_quiz_with_questions') {
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
// UTC. The window is open (2020 to 2099), so the "not started"/"ended" banner
// stays out of the markup and only the badges carry these timestamps.
const SITE_ZONE_OFFSET = '+05:30'
const START_NAIVE = '2020-01-15 12:00:00'
const END_NAIVE = '2099-12-31 18:00:00'
const START_ISO = `2020-01-15T12:00:00${SITE_ZONE_OFFSET}`
const END_ISO = `2099-12-31T18:00:00${SITE_ZONE_OFFSET}`

const rendered = (value: string) => new Date(value).toLocaleString()

const scheduledQuizResponse = () => ({
	quiz: {
		name: 'QUIZ-1',
		title: 'Scheduled quiz',
		duration: 0,
		passing_percentage: 0,
		shuffle_questions: 0,
		show_answers: 0,
		show_submission_history: 0,
		enable_scheduling: 1,
		schedule_start: START_NAIVE,
		schedule_end: END_NAIVE,
		schedule_start_iso: START_ISO,
		schedule_end_iso: END_ISO,
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

const mountQuiz = () =>
	mount(Quiz, {
		props: { quizName: 'QUIZ-1' },
		global: {
			provide: { $user: { data: { name: 'learner@example.com' } } },
			mocks: { __: (value: string) => value },
		},
	})

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
	resourceState.response = scheduledQuizResponse()
	localStorage.clear()
})

describe('Quiz schedule badges', () => {
	// Guards the two assertions below: if the process timezone stayed on the
	// site's own zone, the naive string and the offset-bearing one would render
	// identically and the test could not tell them apart.
	it('renders the naive and offset-bearing timestamps differently', () => {
		expect(rendered(START_NAIVE)).not.toBe(rendered(START_ISO))
		expect(rendered(END_NAIVE)).not.toBe(rendered(END_ISO))
	})

	it('shows the opening time as the instant the server will open the quiz', async () => {
		const wrapper = mountQuiz()
		await flushPromises()

		expect(wrapper.text()).toContain('Opens')
		expect(wrapper.text()).toContain(rendered(START_ISO))
		expect(wrapper.text()).not.toContain(rendered(START_NAIVE))
		wrapper.unmount()
	})

	it('shows the closing time as the instant the server will close the quiz', async () => {
		const wrapper = mountQuiz()
		await flushPromises()

		expect(wrapper.text()).toContain('Closes')
		expect(wrapper.text()).toContain(rendered(END_ISO))
		expect(wrapper.text()).not.toContain(rendered(END_NAIVE))
		wrapper.unmount()
	})
})
