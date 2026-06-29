/**
 * CourseReviews.vue — review date rendering.
 *
 * Regression guard for the "every review shows Today" bug: the backend used to
 * overwrite `creation` with pretty_date() (e.g. "2 days ago"), and the frontend
 * then fed that string into dayjs(), which produced an Invalid Date so every row
 * collapsed to __('Today'). The backend now returns the raw datetime; this test
 * asserts that real datetimes render their true relative age, so a regression to
 * pre-formatted `creation` (which dayjs can't parse) fails here instead of in prod.
 */
import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import dayjs from 'dayjs'
import CourseReviews from '@/components/CourseReviews.vue'

const fmt = (d: dayjs.Dayjs) => d.format('YYYY-MM-DD HH:mm:ss')

const REVIEWS = [
	{
		name: 'r-today',
		rating: 5,
		owner: 'a@b.c',
		creation: fmt(dayjs()),
		owner_details: { username: 'a', full_name: 'A', user_image: '' },
	},
	{
		name: 'r-1-day',
		rating: 4,
		owner: 'b@b.c',
		creation: fmt(dayjs().subtract(1, 'day').subtract(1, 'hour')),
		owner_details: { username: 'b', full_name: 'B', user_image: '' },
	},
	{
		name: 'r-5-days',
		rating: 3,
		owner: 'c@b.c',
		creation: fmt(dayjs().subtract(5, 'day')),
		owner_details: { username: 'c', full_name: 'C', user_image: '' },
	},
	{
		name: 'r-2-months',
		rating: 2,
		owner: 'd@b.c',
		creation: fmt(dayjs().subtract(2, 'month').subtract(3, 'day')),
		owner_details: { username: 'd', full_name: 'D', user_image: '' },
	},
]

// frappe-ui's internal module resolution doesn't work under vitest; stub the
// pieces CourseReviews uses. The reviews resource returns our fixture; the
// has-reviewed count resource returns 0.
vi.mock('frappe-ui', () => ({
	Button: { template: '<button><slot /></button>' },
	createResource: (opts: { url: string }) =>
		opts.url === 'lms.lms.utils.get_reviews'
			? { data: REVIEWS, reload: vi.fn(), refresh: vi.fn() }
			: { data: 0, reload: vi.fn(), refresh: vi.fn() },
}))
vi.mock('@/components/UserAvatar.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/components/Modals/ReviewModal.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/utils', () => ({ formatRating: (r: string) => String(r) }))

vi.stubGlobal('__', (s: string) => s)

const mountReviews = () =>
	mount(CourseReviews, {
		props: { courseName: 'C1' },
		global: {
			provide: {
				$user: { data: { name: 'a@b.c' } },
				$dayjs: dayjs,
			},
			mocks: { __: (s: string) => s },
			stubs: { LucideStar: true, RouterLink: true },
		},
	})

const renderedDates = async () => {
	const wrapper = mountReviews()
	await flushPromises()
	return wrapper.findAll('article span.text-ink-gray-5').map((n) => n.text())
}

describe('CourseReviews date rendering', () => {
	it('renders the true relative age of each review', async () => {
		expect(await renderedDates()).toEqual([
			'Today',
			'1 day ago',
			'5 days ago',
			'2 months ago',
		])
	})

	it('does not collapse old reviews to "Today" (the pretty_date regression)', async () => {
		const dates = await renderedDates()
		// every row but the first is older than a day and must not read "Today"
		expect(dates.slice(1).every((d) => d !== 'Today')).toBe(true)
	})
})
