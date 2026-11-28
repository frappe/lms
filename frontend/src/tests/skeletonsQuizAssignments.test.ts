/**
 * Loading skeletons on the quiz and assignment pages: each section shows its
 * skeleton until its own data lands, and a refetch that keeps the data never
 * brings the skeleton back.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, reactive } from 'vue'

enableAutoUnmount(afterEach)

const { resources } = vi.hoisted(() => {
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
	return { resources: {} as Record<string, any> }
})

vi.stubGlobal('__', (text: string) => text)
if (!('format' in String.prototype)) {
	Object.defineProperty(String.prototype, 'format', {
		value: function (...args: string[]) {
			return this.replace(/\{(\d+)\}/g, (_: string, i: number) => args[i] ?? '')
		},
	})
}

const stub = (tag = 'div') => ({ template: `<${tag}><slot /></${tag}>` })

vi.mock('frappe-ui', async () => {
	const { reactive } = await import('vue')
	const resource = (key: string, extra = {}) => {
		resources[key] = reactive({
			data: null,
			loading: true,
			fetch: vi.fn(),
			reload: vi.fn(),
			update: vi.fn(),
			submit: vi.fn(),
			...extra,
		})
		return resources[key]
	}
	return {
		createResource: (options: { url: string; params?: any }) =>
			resource(
				[options.url, options.params?.doctype].filter(Boolean).join(':')
			),
		createDocumentResource: () => {
			resources.doc = reactive({
				doc: null,
				get: { loading: true },
				save: { loading: false },
				isDirty: false,
			})
			return resources.doc
		},
		createListResource: (options: { doctype: string }) =>
			resource('list:' + options.doctype, {
				list: { loading: true },
				hasNextPage: false,
			}),
		usePageMeta: vi.fn(),
		toast: { error: vi.fn() },
		Button: stub('button'),
		Badge: stub('span'),
		Avatar: stub('span'),
		Popover: stub(),
		FormControl: stub('span'),
	}
})
vi.mock('vue-router', () => ({
	useRouter: () => ({ push: vi.fn(), currentRoute: { value: { query: {} } } }),
}))
vi.mock('@/stores/session', () => ({ sessionStore: () => ({ brand: {} }) }))
vi.mock('@/composables/useKeyboardShortcuts', () => ({
	useKeyboardShortcuts: vi.fn(),
	saveShortcut: () => ({}),
}))
vi.mock('@/components/Layouts/pages/PageHeader.vue', () => ({
	default: defineComponent({
		props: { loading: Boolean },
		setup: (props) => () =>
			h('header', { 'data-loading': String(props.loading) }),
	}),
}))
vi.mock('@/components/Layouts/pages/PageBody.vue', () => ({
	default: stub(),
}))
vi.mock('@/components/Assessment/AssessmentAuthors.vue', () => ({
	default: stub(),
}))
vi.mock('@/components/HeaderButton.vue', () => ({ default: stub('button') }))
vi.mock('@/components/ShortcutTooltip.vue', () => ({ default: stub() }))
vi.mock('@/components/Quiz.vue', () => ({ default: stub() }))
vi.mock('@/components/Layouts/pages/ListPage.vue', () => ({
	default: {
		props: ['title'],
		template: '<div><h1><slot name="name">{{ title }}</slot></h1></div>',
	},
}))
vi.mock('@/utils/bulkDelete', () => ({
	useBulkDeleteAction: () => ({ deleting: false, deleteSelected: vi.fn() }),
}))

const MODERATOR = { data: { name: 'mod@x.com', is_moderator: true } }
const mountPage = (component: any, props: Record<string, unknown> = {}) =>
	mount(component, {
		props,
		global: {
			provide: { $user: MODERATOR, $dayjs: () => ({}) },
			mocks: { __: (text: string) => text },
			stubs: { 'router-view': true, EmptyStateActions: true },
		},
	})

describe('QuizSubmission skeletons', () => {
	const load = async () => {
		const { default: QuizSubmission } = await import(
			'@/pages/QuizSubmission.vue'
		)
		return mountPage(QuizSubmission, { submission: 'SUB-1' })
	}
	const skeleton = '[data-testid="quiz-submission-skeleton"]'
	const logSkeleton = '[data-testid="violation-log-skeleton"]'

	it('shows the page skeleton until the submission lands', async () => {
		const wrapper = await load()
		expect(wrapper.find(skeleton).attributes('aria-hidden')).toBe('true')

		resources.doc.doc = {
			quiz_title: 'Utility Quiz',
			member_name: 'Learner',
			result: [],
			violation_count: 2,
		}
		resources.doc.get.loading = false
		await nextTick()
		expect(wrapper.find(skeleton).exists()).toBe(false)
		expect(wrapper.text()).toContain('Utility Quiz')

		// A refetch keeps the doc, so the page stays.
		resources.doc.get.loading = true
		await nextTick()
		expect(wrapper.find(skeleton).exists()).toBe(false)
	})

	it('shows a log skeleton until the proctoring events land', async () => {
		const wrapper = await load()
		resources.doc.doc = { result: [], violation_count: 2 }
		resources.doc.get.loading = false
		await nextTick()
		expect(wrapper.find(logSkeleton).exists()).toBe(true)

		const log =
			resources['lms.lms.doctype.lms_quiz.lms_quiz.get_quiz_violation_logs']
		log.data = []
		log.loading = false
		await nextTick()
		expect(wrapper.find(logSkeleton).exists()).toBe(false)
		expect(wrapper.text()).toContain('No event details were recorded')

		log.loading = true
		await nextTick()
		expect(wrapper.find(logSkeleton).exists()).toBe(false)
	})

	it('announces the load for screen readers', async () => {
		vi.useFakeTimers()
		const wrapper = await load()
		vi.advanceTimersByTime(600)
		await nextTick()
		expect(wrapper.get('[role="status"]').text()).toBe('Loading…')
		resources.doc.doc = { result: [] }
		resources.doc.get.loading = false
		await nextTick()
		vi.advanceTimersByTime(600)
		await nextTick()
		expect(wrapper.get('[role="status"]').text()).toBe('Submission loaded')
		vi.useRealTimers()
	})
})

describe('QuizPage header', () => {
	it('holds the header skeleton until the quiz title lands', async () => {
		const { default: QuizPage } = await import('@/pages/QuizPage.vue')
		const wrapper = mountPage(QuizPage, { quizID: 'QZ-1' })
		const header = () => wrapper.get('header').attributes('data-loading')
		expect(header()).toBe('true')

		resources['frappe.client.get_value:LMS Quiz'].data = {
			title: 'Chart of Accounts',
		}
		resources['frappe.client.get_value:LMS Quiz'].loading = false
		await nextTick()
		expect(header()).toBe('false')

		resources['frappe.client.get_value:LMS Quiz'].loading = true
		await nextTick()
		expect(header()).toBe('false')
	})
})

describe('Assignments heading', () => {
	it('shows a count skeleton, not "0 Assignments", until the count lands', async () => {
		const { default: Assignments } = await import('@/pages/Assignments.vue')
		const wrapper = mountPage(Assignments)
		await flushPromises()
		const count = '[data-testid="count-skeleton"]'
		expect(wrapper.find(count).exists()).toBe(true)
		expect(wrapper.text()).not.toContain('0 Assignments')

		const total = resources['frappe.client.get_count:LMS Assignment']
		total.data = 7
		total.loading = false
		await nextTick()
		expect(wrapper.find(count).exists()).toBe(false)
		expect(wrapper.get('h1').text()).toBe('7 Assignments')

		total.loading = true
		await nextTick()
		expect(wrapper.find(count).exists()).toBe(false)
	})
})
