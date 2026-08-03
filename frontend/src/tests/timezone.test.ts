import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatTimezone, nextOccurrence } from '@/utils/timezone'

describe('formatTimezone', () => {
	it('appends the offset to an IANA zone name', () => {
		expect(formatTimezone('Asia/Kolkata', '2026-07-29')).toBe(
			'Asia/Kolkata (GMT+5:30)'
		)
		expect(formatTimezone('Europe/Berlin', '2026-07-29')).toBe(
			'Europe/Berlin (GMT+2:00)'
		)
	})

	it('strips the leading zero from the hour', () => {
		expect(formatTimezone('America/New_York', '2026-01-15')).toBe(
			'America/New_York (GMT-5:00)'
		)
	})

	it('resolves the offset for the given date, not today', () => {
		// America/New_York is GMT-5 in January and GMT-4 in July. A single label
		// computed once would be wrong for half the 60-day slot window.
		expect(formatTimezone('America/New_York', '2026-01-15')).toContain(
			'GMT-5:00'
		)
		expect(formatTimezone('America/New_York', '2026-07-29')).toContain(
			'GMT-4:00'
		)
	})

	it('echoes legacy free-text values unchanged', () => {
		expect(formatTimezone('IST (GMT+5:30)', '2026-07-29')).toBe(
			'IST (GMT+5:30)'
		)
		expect(formatTimezone('Pacific Time', '2026-07-29')).toBe('Pacific Time')
	})

	it('does not throw on a hostile value', () => {
		expect(formatTimezone('../../etc/passwd', '2026-07-29')).toBe(
			'../../etc/passwd'
		)
	})

	it('returns an empty string for a missing zone', () => {
		expect(formatTimezone('')).toBe('')
		expect(formatTimezone(null)).toBe('')
		expect(formatTimezone(undefined)).toBe('')
	})

	it('renders UTC as a zero offset', () => {
		expect(formatTimezone('UTC', '2026-07-29')).toBe('UTC (GMT+0:00)')
	})
})

describe('formatTimezone date anchoring', () => {
	it('reads a date-only value on that date, not the day before', () => {
		// America/Santiago moves GMT-4 -> GMT-3 overnight on 2026-09-05.
		// `new Date('2026-09-06')` is UTC midnight, which is still 2026-09-05
		// there: the wrong side of the transition.
		expect(formatTimezone('America/Santiago', '2026-09-06')).toBe(
			'America/Santiago (GMT-3:00)'
		)
		expect(formatTimezone('America/Santiago', '2026-09-05')).toBe(
			'America/Santiago (GMT-4:00)'
		)
	})

	it('accepts a full timestamp', () => {
		expect(formatTimezone('Europe/Berlin', '2026-07-29 06:30:00')).toBe(
			'Europe/Berlin (GMT+2:00)'
		)
	})
})

describe('nextOccurrence', () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	const freeze = (date: string) => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date(`${date}T09:00:00`))
	}

	it('is the start date before the batch begins', () => {
		freeze('2026-07-01')
		expect(nextOccurrence('2026-08-01', '2026-09-01')).toBe('2026-08-01')
	})

	it('is today while the batch is running', () => {
		freeze('2026-08-15')
		expect(nextOccurrence('2026-08-01', '2026-09-01')).toBe('2026-08-15')
	})

	it('is the end date once the batch is over', () => {
		freeze('2026-10-01')
		expect(nextOccurrence('2026-08-01', '2026-09-01')).toBe('2026-09-01')
	})

	it('is today for an open-ended batch that has started', () => {
		freeze('2026-08-15')
		expect(nextOccurrence('2026-08-01', null)).toBe('2026-08-15')
	})

	it('is undefined without a start date', () => {
		expect(nextOccurrence(null, '2026-09-01')).toBeUndefined()
	})
})
