import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('@/utils', () => ({
	formatTime: (time: string) => time.slice(0, 5),
	getFormattedDateRange: (start: string, end: string) => `${start} - ${end}`,
}))
vi.mock('@/utils/timezone', () => ({
	formatTimezone: (zone: string) => zone,
	nextOccurrence: () => undefined,
}))

import BatchFacts from '@/pages/Batches/components/overview/BatchFacts.vue'

const factsFor = (batch: Record<string, unknown>) =>
	mount(BatchFacts, {
		props: {
			batch: {
				start_date: '2099-01-01',
				end_date: '2099-02-01',
				start_time: '09:00:00',
				end_time: '11:00:00',
				...batch,
			},
		},
	})
		.findAll('li')
		.map((item) => item.text())

describe('the enrol card facts', () => {
	it('lists only what the batch offers', () => {
		expect(factsFor({ medium: 'Offline' })).toEqual([
			'2099-01-01 - 2099-02-01',
			'09:00 – 11:00',
			'In person',
		])
	})

	it('counts courses and seats, and names certificate and evaluation', () => {
		const facts = factsFor({
			timezone: 'Asia/Kolkata',
			courses: [{ course: 'C1' }],
			seat_count: 20,
			certification: 1,
			evaluation: 1,
		})
		expect(facts).toEqual([
			'2099-01-01 - 2099-02-01',
			'09:00 – 11:00',
			'Asia/Kolkata',
			'Online',
			'1 course',
			'20 seats',
			'Certificate',
			'1-on-1 evaluation',
		])
	})
})
