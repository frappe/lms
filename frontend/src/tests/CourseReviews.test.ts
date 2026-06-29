/**
 * CourseReviews.vue — review list rendering.
 *
 * Date guard: the "every review shows Today" bug came from the backend
 * overwriting `creation` with pretty_date() ("2 days ago"), which the frontend
 * fed into dayjs() → Invalid Date → diff NaN → every row collapsed to
 * __('Today'). The backend now returns the raw datetime; these tests assert real
 * datetimes render their true relative age, plus the list's other display rules
 * (null-author drop, preview limit, star fill, header summary, clamp toggle).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import dayjs from 'dayjs'
import CourseReviews from '@/components/CourseReviews.vue'

const fmt = (d: dayjs.Dayjs) => d.format('YYYY-MM-DD HH:mm:ss')

type Review = {
	name: string
	rating: number
	owner: string
	creation: string
	review?: string
	owner_details: { username: string; full_name: string; user_image: string } | null
}

const review = (over: Partial<Review> & { name: string }): Review => ({
	rating: 5,
	owner: 'a@b.c',
	creation: fmt(dayjs()),
	owner_details: { username: 'a', full_name: 'A', user_image: '' },
	...over,
})

const DEFAULT_REVIEWS: Review[] = [
	review({ name: 'r-today', rating: 5, creation: fmt(dayjs()) }),
	review({
		name: 'r-1-day',
		rating: 4,
		creation: fmt(dayjs().subtract(1, 'day').subtract(1, 'hour')),
	}),
	review({ name: 'r-5-days', rating: 3, creation: fmt(dayjs().subtract(5, 'day')) }),
	review({
		name: 'r-2-months',
		rating: 2,
		creation: fmt(dayjs().subtract(2, 'month').subtract(3, 'day')),
	}),
]

// Mutable so each test can swap in its own fixture before mounting; the resource
// exposes `data` via a getter so the component reads the current value.
let currentReviews: Review[] = DEFAULT_REVIEWS

// frappe-ui's internal module resolution doesn't work under vitest; stub the
// pieces CourseReviews uses. The reviews resource returns the fixture; the
// has-reviewed count resource returns 0.
vi.mock('frappe-ui', () => ({
	Button: { template: '<button><slot /></button>' },
	createResource: (opts: { url: string }) =>
		opts.url === 'lms.lms.utils.get_reviews'
			? {
					get data() {
						return currentReviews
					},
					reload: vi.fn(),
					refresh: vi.fn(),
			  }
			: { data: 0, reload: vi.fn(), refresh: vi.fn() },
}))
vi.mock('@/components/UserAvatar.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/components/Modals/ReviewModal.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/utils', () => ({ formatRating: (r: string) => String(r) }))

vi.stubGlobal('__', (s: string) => s)

const mountReviews = (props: Record<string, unknown> = {}) =>
	mount(CourseReviews, {
		props: { courseName: 'C1', ...props },
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

beforeEach(() => {
	currentReviews = DEFAULT_REVIEWS
})

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

describe('CourseReviews list rendering', () => {
	it('drops reviews whose author record is missing', async () => {
		currentReviews = [
			review({ name: 'ok' }),
			review({ name: 'ghost', owner: 'x@y.z', owner_details: null }),
		]
		const wrapper = mountReviews()
		await flushPromises()
		// the null-author row would crash on the avatar/profile deref, so it's filtered
		expect(wrapper.findAll('article')).toHaveLength(1)
	})

	it('shows only the first 4 reviews until "View all reviews" is clicked', async () => {
		currentReviews = Array.from({ length: 6 }, (_, i) =>
			review({ name: `r-${i}`, owner: `u${i}@b.c` })
		)
		const wrapper = mountReviews()
		await flushPromises()
		expect(wrapper.findAll('article')).toHaveLength(4)

		const viewAll = wrapper
			.findAll('button')
			.find((b) => b.text() === 'View all reviews')!
		await viewAll.trigger('click')
		expect(wrapper.findAll('article')).toHaveLength(6)
	})

	it('fills one star per (rounded-up) rating point', async () => {
		currentReviews = [review({ name: 'r3', rating: 3 })]
		const wrapper = mountReviews()
		await flushPromises()
		const row = wrapper.get('article')
		expect(row.findAll('.fill-yellow-500')).toHaveLength(3)
		expect(row.findAll('.fill-surface-gray-3')).toHaveLength(2)
	})

	it('summarizes the rating and pluralizes the count', async () => {
		currentReviews = [review({ name: 'only' })]
		const wrapper = mountReviews({ avg_rating: '4.5' })
		await flushPromises()
		const header = wrapper.text()
		expect(header).toContain('4.5')
		expect(header).toContain('1 user rating')
		expect(header).not.toContain('user ratings')
	})

	it('clamps long review text behind a "See more" toggle', async () => {
		currentReviews = [review({ name: 'long', review: 'x'.repeat(300) })]
		const wrapper = mountReviews()
		await flushPromises()
		const body = wrapper.get('article p')
		expect(body.classes()).toContain('line-clamp-5')

		await wrapper.get('article button').trigger('click')
		expect(wrapper.get('article p').classes()).not.toContain('line-clamp-5')
	})
})
