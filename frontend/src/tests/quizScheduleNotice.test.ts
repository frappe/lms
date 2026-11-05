import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { quizScheduleNotice } from '@/utils/quizSchedule'

vi.stubGlobal('__', (value: string) => value)

String.prototype.format = function (...args: unknown[]) {
	return this.replace(/\{(\d+)\}/g, (_match: string, index: number) =>
		String(args[index])
	)
}

// Wednesday, 5 November 2026, 3:00 PM in the learner's (UTC) browser.
const NOW = new Date('2026-11-05T15:00:00Z')

const scheduled = (start: string | null, end: string | null) => ({
	enable_scheduling: 1 as const,
	schedule_start_iso: start,
	schedule_end_iso: end,
})

let originalTZ: string | undefined

beforeAll(() => {
	originalTZ = process.env.TZ
	process.env.TZ = 'UTC'
})

afterAll(() => {
	process.env.TZ = originalTZ
})

describe('quizScheduleNotice', () => {
	it('says nothing for a quiz without a schedule', () => {
		expect(quizScheduleNotice({ enable_scheduling: 0 }, NOW)).toBeNull()
	})

	it('says nothing for an open quiz with no closing date', () => {
		expect(
			quizScheduleNotice(scheduled('2026-11-01T10:00:00Z', null), NOW)
		).toBeNull()
	})

	it('says the day and how far away it opens', () => {
		const notice = quizScheduleNotice(
			scheduled('2026-11-17T10:32:00Z', null),
			NOW
		)
		expect(notice?.state).toBe('not_started')
		expect(notice?.title).toBe('Opens on Tuesday, 17 November at 10:32 AM')
		expect(notice?.description).toBe(
			"That's in 12 days. Come back then to start it."
		)
	})

	it('says today when it opens later today', () => {
		const notice = quizScheduleNotice(
			scheduled('2026-11-05T18:00:00Z', null),
			NOW
		)
		expect(notice?.title).toBe('Opens today at 6:00 PM')
		expect(notice?.description).toBe(
			"That's in 3 hours. Come back then to start it."
		)
	})

	it('shows the year only when it is not this year', () => {
		const notice = quizScheduleNotice(
			scheduled('2027-01-04T09:00:00Z', null),
			NOW
		)
		expect(notice?.title).toBe('Opens on Monday, 4 January 2027 at 9:00 AM')
	})

	it('says when an open quiz closes and how long is left', () => {
		const notice = quizScheduleNotice(
			scheduled('2026-11-01T10:00:00Z', '2026-11-09T18:00:00Z'),
			NOW
		)
		expect(notice?.state).toBe('open')
		expect(notice?.theme).toBe('blue')
		expect(notice?.title).toBe('Open until Monday, 9 November at 6:00 PM')
		expect(notice?.description).toBe(
			'You have 4 days. Finish your attempt before it closes.'
		)
	})

	it('warns when it closes within a day', () => {
		const today = quizScheduleNotice(
			scheduled(null, '2026-11-05T18:00:00Z'),
			NOW
		)
		expect(today?.state).toBe('closing_soon')
		expect(today?.theme).toBe('amber')
		expect(today?.title).toBe('Closes today at 6:00 PM')
		expect(today?.description).toBe(
			"That's in 3 hours. Start soon so you have time to finish."
		)

		const tomorrow = quizScheduleNotice(
			scheduled(null, '2026-11-06T09:00:00Z'),
			NOW
		)
		expect(tomorrow?.title).toBe('Closes tomorrow at 9:00 AM')
	})

	it('says when a closed quiz closed', () => {
		const notice = quizScheduleNotice(
			scheduled(null, '2026-11-03T18:00:00Z'),
			NOW
		)
		expect(notice?.state).toBe('ended')
		expect(notice?.title).toBe('This quiz closed on Tuesday, 3 November at 6:00 PM')
		expect(notice?.description).toBe(
			'Reach out to your instructor if you still need to take it.'
		)
	})
})
