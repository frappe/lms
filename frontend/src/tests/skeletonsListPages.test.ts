/**
 * Skeletons on the list pages: ListPage's #card-skeleton grid, and the extra
 * fetches above it (category chips, the "Coming soon" row, the member count).
 * Each shows until its own resource has data, drops when the data lands, and
 * stays away for a refetch that keeps the data on screen.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'

vi.stubGlobal('__', (text: string) =>
	/{\d+}/.test(text)
		? {
				format: (...args: string[]) =>
					text.replace(/{(\d+)}/g, (_, i) => args[Number(i)]),
		  }
		: text
)

type Fake = {
	url: string
	data: unknown
	loading: boolean
	list: { loading: boolean; abort: () => void }
	hasNextPage: boolean
	pageLength: number
	submit: () => void
	reload: () => void
	update: () => void
	abort: () => void
	next: () => void
}

const { resources } = vi.hoisted(() => ({
	resources: [] as Fake[],
}))

const fake = (options: Record<string, any>) => {
	const resource: Fake = reactive({
		url: options.url || options.doctype,
		data: null,
		loading: false,
		list: { loading: Boolean(options.auto), abort() {} },
		hasNextPage: false,
		pageLength: 24,
		submit() {
			resource.loading = true
		},
		reload() {
			resource.list.loading = true
			return Promise.resolve()
		},
		update() {},
		abort() {},
		next() {},
	})
	resources.push(resource)
	return resource
}

const byUrl = (part: string) =>
	resources.find((resource) => resource.url.includes(part)) as Fake

const passthrough = { template: '<div><slot /></div>' }

vi.mock('frappe-ui', () => ({
	createResource: (options: Record<string, any>) => fake(options),
	createListResource: (options: Record<string, any>) => fake(options),
	call: () => new Promise(() => {}),
	usePageMeta: () => {},
	toast: {},
	Badge: passthrough,
	Button: passthrough,
	Dropdown: passthrough,
	FormControl: { template: '<input />' },
	TabButtons: { template: '<div />' },
}))
vi.mock('frappe-ui/experimental', () => ({ ListFooter: { template: '<i />' } }))
vi.mock('@/components/Layouts/pages/PageHeader.vue', () => ({
	default: { template: '<i />' },
}))
vi.mock('@/components/Layouts/pages/PageBody.vue', () => ({
	default: { template: '<div><slot /></div>' },
}))
vi.mock('@/components/ResponsiveListView.vue', () => ({
	default: { template: '<i />' },
}))
vi.mock('@/components/CourseCard.vue', () => ({
	default: { template: '<article data-testid="course-card" />' },
}))
vi.mock('@/components/UserAvatar.vue', () => ({
	default: { template: '<i />' },
}))
vi.mock('@/utils/a11y', () => ({ useLoadingAnnouncement: () => '' }))
vi.mock('@/stores/session', () => ({ sessionStore: () => ({ brand: {} }) }))
vi.mock('@/utils', () => ({ canCreateCourse: () => false }))
vi.mock('vue-router', () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))
vi.mock('@framework/ui/telemetry/index', () => ({
	useTelemetry: () => ({ capture: () => {} }),
}))

const global = {
	provide: {
		$user: { data: { name: 'learner@example.com' } },
		$dayjs: () => ({ add: () => ({ format: () => '' }) }),
	},
	mocks: { __: globalThis.__ },
	stubs: { 'router-view': true, 'router-link': passthrough },
}

beforeEach(() => {
	resources.length = 0
	window.history.replaceState({}, '', '/lms/courses')
})

describe('ListPage card skeletons', () => {
	const mountList = async (props: Record<string, unknown>) => {
		const { default: ListPage } = await import(
			'@/components/Layouts/pages/ListPage.vue'
		)
		return mount(ListPage, {
			props: { breadcrumbs: [], rows: [], ...props },
			slots: {
				'card-skeleton': '<div data-testid="card-skeleton" />',
				card: '<div data-testid="card" />',
			},
			global,
		})
	}

	it('draws the page card skeleton until the first rows land', async () => {
		const wrapper = await mountList({ loading: true })
		expect(wrapper.findAll('[data-testid="card-skeleton"]')).toHaveLength(8)

		await wrapper.setProps({ loading: false, rows: [{ name: 'a' }] })
		expect(wrapper.find('[data-testid="card-skeleton"]').exists()).toBe(false)
		expect(wrapper.findAll('[data-testid="card"]')).toHaveLength(1)

		await wrapper.setProps({ loading: true })
		expect(wrapper.find('[data-testid="card-skeleton"]').exists()).toBe(false)
	})

	it('falls back to the generic skeleton for a list layout', async () => {
		const wrapper = await mountList({ loading: true, layout: 'list' })
		expect(wrapper.find('[data-testid="card-skeleton"]').exists()).toBe(false)
		expect(wrapper.find('[aria-hidden="true"]').exists()).toBe(true)
	})
})

describe('Courses extra fetches', () => {
	const mountCourses = async () => {
		const { default: Courses } = await import('@/pages/Courses/Courses.vue')
		const wrapper = mount(Courses, { global })
		await nextTick()
		return wrapper
	}

	it('holds the category chips on a skeleton until categories land', async () => {
		const wrapper = await mountCourses()
		const categories = byUrl('get_course_categories')
		expect(wrapper.find('[data-testid="category-skeleton"]').exists()).toBe(
			true
		)

		categories.data = [{ label: 'Design', value: 'Design' }]
		categories.list.loading = false
		await nextTick()
		expect(wrapper.find('[data-testid="category-skeleton"]').exists()).toBe(
			false
		)
		expect(wrapper.find('[data-testid="category-Design"]').exists()).toBe(true)

		categories.list.loading = true
		await nextTick()
		expect(wrapper.find('[data-testid="category-skeleton"]').exists()).toBe(
			false
		)
	})

	it('holds "Coming soon" on a skeleton until upcoming courses land', async () => {
		const wrapper = await mountCourses()
		const upcoming = resources.filter((r) => r.url.includes('get_courses'))[1]
		const skeleton = '[data-testid="coming-soon-skeleton"]'
		expect(wrapper.find(skeleton).exists()).toBe(true)
		expect(wrapper.find(skeleton).attributes('aria-hidden')).toBe('true')

		upcoming.data = [{ name: 'soon', title: 'Soon' }]
		upcoming.loading = false
		await nextTick()
		expect(wrapper.find(skeleton).exists()).toBe(false)
		expect(wrapper.find('[data-testid="coming-soon"]').exists()).toBe(true)

		upcoming.loading = true
		await nextTick()
		expect(wrapper.find(skeleton).exists()).toBe(false)
	})
})
