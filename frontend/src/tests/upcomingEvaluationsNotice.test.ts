/**
 * The scheduling-deadline notices in UpcomingEvaluations are frappe-ui Alerts
 * rather than hand-rolled coloured divs. The layout assertions matter: Alert's
 * row layout truncates its title, so a notice whose whole message is one long
 * sentence has to reach the banner layout or the deadline reads as an ellipsis.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import dayjs from '@/utils/dayjs'

window.matchMedia ??= (() => ({
	matches: false,
	addEventListener: () => {},
	removeEventListener: () => {},
})) as unknown as typeof window.matchMedia

vi.stubGlobal('__', (text: string) => text)

vi.mock('frappe-ui', async (importOriginal) => {
	const actual = await importOriginal<Record<string, unknown>>()
	return {
		...actual,
		// Alert, Button and Dropdown stay real — the Alert markup is the subject.
		createListResource: () => ({ data: [], reload: vi.fn() }),
		call: vi.fn(),
		toast: { error: vi.fn(), success: vi.fn() },
	}
})
vi.mock('@/components/Modals/EvaluationModal.vue', () => ({ default: {} }))

const mountNotice = async (endDate: string) => {
	const UpcomingEvaluations = (
		await import('@/components/UpcomingEvaluations.vue')
	).default
	return mount(UpcomingEvaluations, {
		props: { endDate, courses: [], batch: 'B1' },
		global: {
			provide: { $dayjs: dayjs, $user: { data: { name: 'me@example.com' } } },
			mocks: { __: (s: string) => s },
			config: { globalProperties: { $dialog: vi.fn() } },
		},
	})
}

const FUTURE = dayjs().add(30, 'day').format('YYYY-MM-DD')
const PAST = dayjs().subtract(30, 'day').format('YYYY-MM-DD')

describe('UpcomingEvaluations deadline notices', () => {
	it('warns in amber while the deadline is still ahead', async () => {
		const w = await mountNotice(FUTURE)
		const alert = w.get('[data-color="amber"]')

		expect(alert.attributes('data-layout')).toBe('banner')
		// The date keeps its own emphasis, so the title stays a slot.
		expect(alert.get('[data-slot="title"]').text()).toContain(
			dayjs(FUTURE).format('DD MMMM YYYY')
		)
		expect(alert.get('[data-slot="description"]').text()).toBe(
			'Please make sure to schedule your evaluation before this date.'
		)
	})

	it('reports a passed deadline in red, in full', async () => {
		const w = await mountNotice(PAST)
		const alert = w.get('[data-color="red"]')

		// Banner, not row: the row layout would truncate this sentence.
		expect(alert.attributes('data-layout')).toBe('banner')
		expect(alert.get('[data-slot="description"]').text()).toBe(
			'The deadline to schedule evaluations has passed. Please contact the Instructor for assistance.'
		)
		// Red and amber are mutually exclusive.
		expect(w.find('[data-color="amber"]').exists()).toBe(false)
	})

	it('announces an urgent notice rather than leaving it to be noticed', async () => {
		const w = await mountNotice(PAST)
		expect(w.get('[data-color="red"]').attributes('role')).toBe('alert')
	})
})
