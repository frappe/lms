import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
// @ts-expect-error a JS SFC has no generated types (TS7016)
import BatchOverlay from '@/pages/Batches/components/BatchOverlay.vue'

vi.mock('frappe-ui', () => ({
	createResource: () => ({ submit: vi.fn() }),
	toast: { success: vi.fn(), error: vi.fn() },
	Badge: {
		props: ['label'],
		template: `<span class="badge">{{ label }}</span>`,
	},
	Button: {
		inheritAttrs: false,
		props: ['route'],
		template: `<button v-bind="$attrs"><slot /></button>`,
	},
}))

vi.mock('@/utils', () => ({
	formatNumberIntoCurrency: (amount: number) => String(amount),
	formatTime: (time: string) => time,
	getFormattedDateRange: () => '',
}))

vi.mock('@/utils/timezone', () => ({
	formatTimezone: () => '',
	nextOccurrence: () => null,
}))

vi.mock('@/components/VideoPreview.vue', () => ({
	default: { render: () => null },
}))

function mountOverlay(data: Record<string, unknown>) {
	return mount(BatchOverlay, {
		props: {
			batch: {
				data: {
					name: 'B1',
					courses: [],
					start_date: '2099-01-01',
					end_date: '2099-01-10',
					start_time: '09:00:00',
					end_time: '11:00:00',
					accept_enrollments: 1,
					...data,
				},
			},
		},
		global: {
			provide: { $user: { data: { name: 'stu@example.com' } } },
			mocks: { __: (text: string) => text },
		},
	})
}

// Unlimited batches hid both actions since #1327 (seats_left is unset).
// Added for audit finding #18 on branch fix/batch-unlimited-seats.
describe('BatchOverlay seat limits', () => {
	it('offers Register Now on a paid batch with no seat limit', () => {
		const w = mountOverlay({ paid_batch: 1, seat_count: 0 })
		expect(w.text()).toContain('Register Now')
		expect(w.text()).not.toContain('Sold Out')
	})

	it('offers Enroll Now on a free batch with no seat limit', () => {
		const w = mountOverlay({ allow_self_enrollment: 1, seat_count: 0 })
		expect(w.text()).toContain('Enroll Now')
	})

	it('hides both actions once a limited batch is full', () => {
		const paid = mountOverlay({ paid_batch: 1, seat_count: 5, seats_left: 0 })
		expect(paid.text()).toContain('Sold Out')
		expect(paid.text()).not.toContain('Register Now')

		const free = mountOverlay({
			allow_self_enrollment: 1,
			seat_count: 5,
			seats_left: 0,
		})
		expect(free.text()).not.toContain('Enroll Now')
	})
})

describe('BatchOverlay when the viewer cannot join', () => {
	it('says enrollment is closed once the batch has started', () => {
		const w = mountOverlay({ allow_self_enrollment: 1, accept_enrollments: 0 })
		expect(w.text()).toContain('Enrollment for this batch is closed')
		expect(w.text()).not.toContain('Enroll Now')
	})

	it('points to the administrator when self-enrollment is off', () => {
		const w = mountOverlay({ seat_count: 0 })
		expect(w.text()).toContain(
			'Contact the Administrator to enroll for this batch'
		)
	})

	it('leaves a full batch to its Sold Out badge', () => {
		const w = mountOverlay({ seat_count: 5, seats_left: 0 })
		expect(w.text()).toContain('Sold Out')
		expect(w.text()).not.toContain('Contact the Administrator')
	})
})
