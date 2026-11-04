import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.TZ = 'Asia/Kolkata'

import dayjs, { serverTime } from '@/utils/dayjs'
import { timeAgo } from '@/utils/format'

// 12:00 in Riyadh (UTC+3) is 14:30 in Kolkata (UTC+5:30).
const NOW = '2026-10-16T09:00:00Z'
const MINUTE_AGO_IN_RIYADH = '2026-10-16 11:58:50.123456'

describe('relative times of naive server datetimes', () => {
	beforeEach(() => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date(NOW))
	})
	afterEach(() => {
		vi.useRealTimers()
		delete (window as any).timezone
	})

	it('reads them in the site timezone, not the browser one', () => {
		;(window as any).timezone = { system: 'Asia/Riyadh' }
		expect(timeAgo(MINUTE_AGO_IN_RIYADH)).toBe('1 minute ago')
		expect(serverTime(MINUTE_AGO_IN_RIYADH).fromNow()).toBe('a minute ago')
	})

	it('falls back to browser-local when boot has no timezone', () => {
		expect(serverTime('2026-10-16 14:29:00').fromNow()).toBe(
			dayjs('2026-10-16 14:29:00').fromNow()
		)
		expect(timeAgo('2026-10-16 14:29:00')).toBe('1 minute ago')
	})
})
