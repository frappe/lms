/**
 * Home and Statistics hold each section's place with a skeleton until that
 * section's own resource answers, and never put it back over data a refetch
 * is refreshing.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { mount } from '@vue/test-utils'

vi.stubGlobal('__', (text: string) =>
	/{\d+}/.test(text)
		? {
				format: (...args: string[]) =>
					text.replace(/{(\d+)}/g, (_, i) => args[Number(i)]),
		  }
		: text
)

type FakeResource = {
	url: string
	data: unknown
	error: unknown
	loading: boolean
}

const { resources } = vi.hoisted(() => ({
	resources: [] as FakeResource[],
}))

const byUrl = (fragment: string) =>
	resources.filter((resource) => resource.url.includes(fragment)).at(-1)!

vi.mock('frappe-ui', async () => {
	const { reactive } = await import('vue')
	return {
		createResource: (options: { url: string; auto?: boolean }) => {
			const resource = reactive({
				url: options.url,
				data: null,
				error: null,
				loading: Boolean(options.auto),
			})
			resources.push(resource)
			return resource
		},
		call: () => new Promise(() => {}),
		usePageMeta: vi.fn(),
		Button: { template: '<button><slot /></button>' },
		Tooltip: { template: '<div><slot /></div>' },
	}
})
vi.mock('frappe-ui/charts', () => ({
	ChartCard: { template: '<div><slot /></div>' },
	NumberCard: {
		props: ['loading', 'value', 'title'],
		template:
			'<div data-testid="number-card" :data-loading="String(!!loading)"><slot v-if="loading" name="loading" /><span v-else>{{ value }}</span></div>',
	},
	LineChart: {
		props: ['loading'],
		template:
			'<div data-testid="line-chart" :data-loading="String(!!loading)" />',
	},
	DonutChart: {
		props: ['loading'],
		template:
			'<div data-testid="donut-chart" :data-loading="String(!!loading)" />',
	},
}))
vi.mock('@/utils', () => ({ formatTime: (time: string) => time }))
vi.mock('@/stores/session', () => ({ sessionStore: () => ({ brand: {} }) }))
vi.mock('@/components/Layouts/pages/PageHeader.vue', () => ({
	default: { template: '<i />' },
}))
vi.mock('@/components/ChartEmptyState.vue', () => ({
	default: { template: '<p data-testid="chart-empty" />' },
}))
vi.mock('@/components/CourseCard.vue', () => ({
	default: { template: '<article data-testid="course-card" />' },
}))
vi.mock('@/pages/Batches/components/BatchCard.vue', () => ({
	default: { template: '<article data-testid="batch-card" />' },
}))
vi.mock('@/components/UpcomingEvaluations.vue', () => ({
	default: { template: '<i />' },
}))
vi.mock('@/pages/Home/Streak.vue', () => ({ default: { template: '<i />' } }))

const MODERATOR = { data: { full_name: 'Ada', is_moderator: true } }
const STUDENT = { data: { full_name: 'Ada', name: 'ada@example.com' } }

const mountPage = async (path: string, user = MODERATOR) => {
	const { default: Page } = await import(path)
	return mount(Page, {
		global: {
			provide: { $user: user, $dayjs: () => ({ format: () => '' }) },
			mocks: { __: globalThis.__ },
			stubs: { 'router-link': { template: '<a><slot /></a>' } },
		},
	})
}

const land = async (resource: FakeResource, data: unknown) => {
	resource.data = data
	resource.loading = false
	await nextTick()
}

const refetch = async (resource: FakeResource) => {
	resource.loading = true
	await nextTick()
}

beforeEach(() => {
	resources.length = 0
	vi.resetModules()
})

describe('Admin home', () => {
	it('holds the courses section until created courses land', async () => {
		const wrapper = await mountPage('@/pages/Home/Home.vue')
		const courses = byUrl('get_created_courses')
		expect(wrapper.find('[data-testid="courses-skeleton"]').exists()).toBe(true)

		await land(courses, [{ name: 'a' }])
		expect(wrapper.find('[data-testid="courses-skeleton"]').exists()).toBe(
			false
		)
		expect(wrapper.findAll('[data-testid="course-card"]')).toHaveLength(1)

		await refetch(courses)
		expect(wrapper.find('[data-testid="courses-skeleton"]').exists()).toBe(
			false
		)
		expect(wrapper.findAll('[data-testid="course-card"]')).toHaveLength(1)
	})

	it('holds batches apart from courses', async () => {
		const wrapper = await mountPage('@/pages/Home/Home.vue')
		await land(byUrl('get_created_courses'), [{ name: 'a' }])
		expect(wrapper.find('[data-testid="batches-skeleton"]').exists()).toBe(true)

		await land(byUrl('get_created_batches'), [{ name: 'b' }])
		expect(wrapper.find('[data-testid="batches-skeleton"]').exists()).toBe(
			false
		)
		expect(wrapper.findAll('[data-testid="batch-card"]')).toHaveLength(1)
	})

	it('says nothing is created only once both lists have answered', async () => {
		const wrapper = await mountPage('@/pages/Home/Home.vue')
		expect(wrapper.text()).not.toContain('No courses created')

		await land(byUrl('get_created_courses'), [])
		expect(wrapper.text()).not.toContain('No courses created')

		await land(byUrl('get_created_batches'), [])
		expect(wrapper.text()).toContain('No courses created')
	})

	it('holds the subtitle until the live classes and evaluations it counts land', async () => {
		const wrapper = await mountPage('@/pages/Home/Home.vue')
		expect(wrapper.find('[data-testid="subtitle-skeleton"]').exists()).toBe(
			true
		)

		await land(byUrl('get_admin_live_classes'), [])
		expect(wrapper.find('[data-testid="subtitle-skeleton"]').exists()).toBe(
			true
		)

		await land(byUrl('get_admin_evals'), [])
		expect(wrapper.find('[data-testid="subtitle-skeleton"]').exists()).toBe(
			false
		)
		expect(wrapper.text()).toContain('Manage your courses and batches')

		await refetch(byUrl('get_admin_evals'))
		expect(wrapper.find('[data-testid="subtitle-skeleton"]').exists()).toBe(
			false
		)
	})

	it('drops a skeleton whose resource failed instead of holding it forever', async () => {
		const wrapper = await mountPage('@/pages/Home/Home.vue')
		const courses = byUrl('get_created_courses')
		courses.error = new Error('boom')
		courses.loading = false
		await nextTick()
		expect(wrapper.find('[data-testid="courses-skeleton"]').exists()).toBe(
			false
		)
	})
})

describe('Student home', () => {
	it('holds my courses until they land, and not on refetch', async () => {
		const wrapper = await mountPage('@/pages/Home/Home.vue', STUDENT)
		const courses = byUrl('get_my_courses')
		expect(wrapper.find('[data-testid="courses-skeleton"]').exists()).toBe(true)

		await land(courses, [{ name: 'a', membership: {} }])
		expect(wrapper.find('[data-testid="courses-skeleton"]').exists()).toBe(
			false
		)

		await refetch(courses)
		expect(wrapper.find('[data-testid="courses-skeleton"]').exists()).toBe(
			false
		)
		expect(wrapper.findAll('[data-testid="course-card"]')).toHaveLength(1)
	})
})

describe('Statistics', () => {
	const loadingFlags = (wrapper: any, testid: string) =>
		wrapper
			.findAll(`[data-testid="${testid}"]`)
			.map((card: any) => card.attributes('data-loading'))

	it('skeletons the number cards until the counts land, and not on refetch', async () => {
		const wrapper = await mountPage('@/pages/Statistics.vue')
		const details = byUrl('get_chart_details')
		expect(loadingFlags(wrapper, 'number-card')).toEqual(Array(5).fill('true'))

		await land(details, { courses: 3, users: 1 })
		expect(loadingFlags(wrapper, 'number-card')).toEqual(Array(5).fill('false'))

		await refetch(details)
		expect(loadingFlags(wrapper, 'number-card')).toEqual(Array(5).fill('false'))
	})

	it('draws every chart card while its own data is on the way', async () => {
		const wrapper = await mountPage('@/pages/Statistics.vue')
		expect(loadingFlags(wrapper, 'line-chart')).toEqual([
			'true',
			'true',
			'true',
		])
		expect(loadingFlags(wrapper, 'donut-chart')).toEqual(['true'])

		const completion = byUrl('get_course_completion_data')
		await land(completion, [{ label: 'Completed', value: 2 }])
		expect(loadingFlags(wrapper, 'donut-chart')).toEqual(['false'])
		expect(loadingFlags(wrapper, 'line-chart')).toEqual([
			'true',
			'true',
			'true',
		])
	})
})
