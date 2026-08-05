/**
 * Batch, live class and evaluation timezones are free-text `Data` fields. New
 * records hold an IANA zone name picked from `get_country_timezone_info`
 * ("Asia/Kolkata"), but older rows predate that control and can hold anything
 * ("IST (GMT+5:30)"). Rendering the raw value therefore reads differently from
 * one record to the next, so every surface goes through here instead.
 *
 * Evaluation slots are the exception: `get_schedule` formats its own labels
 * server-side, so the picker and the confirmation email cannot drift apart.
 */

/** "GMT+05:30" -> "GMT+5:30", "GMT-04:00" -> "GMT-4:00", "GMT" -> "GMT+0:00" */
function tidyOffset(offset: string): string {
	if (offset === 'GMT' || offset === 'UTC') return 'GMT+0:00'
	return offset.replace(/^GMT([+-])0?(\d+)/, 'GMT$1$2')
}

/**
 * `new Date('2026-08-03')` is UTC midnight, which is the previous day in every
 * westward zone, enough to report the wrong side of a DST transition. A
 * date-only value is anchored at local midday instead, which no transition
 * crosses.
 */
function toInstant(at?: string | Date): Date {
	if (!at) return new Date()
	if (at instanceof Date) return at

	const parts = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(at)
	if (!parts) return new Date(at)

	const [, year, month, day, hour, minute] = parts
	return new Date(
		Number(year),
		Number(month) - 1,
		Number(day),
		hour ? Number(hour) : 12,
		minute ? Number(minute) : 0
	)
}

/**
 * The UTC offset of `timezone` is not constant (it shifts across DST), so the
 * instant being labelled has to be passed in.
 */
function offsetOn(timezone: string, at?: string | Date): string {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: timezone,
		timeZoneName: 'longOffset',
	}).formatToParts(toInstant(at))

	return parts.find((part) => part.type === 'timeZoneName')?.value ?? ''
}

/**
 * "Asia/Kolkata" -> "Asia/Kolkata (GMT+5:30)".
 *
 * Mirrors `lms.lms.utils.format_timezone`. `at` is the instant to read the
 * offset at, defaulting to now.
 *
 * Values Intl does not recognise as a zone are legacy free text and are echoed
 * unchanged. They already read as a timezone to a human, and there is no safe
 * way to parse them back into a zone.
 */
export function formatTimezone(
	timezone?: string | null,
	at?: string | Date
): string {
	if (!timezone) return ''

	try {
		const offset = offsetOn(timezone, at)
		return offset ? `${timezone} (${tidyOffset(offset)})` : timezone
	} catch {
		// RangeError: invalid time zone specified
		return timezone
	}
}

/**
 * The date a batch's timezone should be labelled at. A batch spanning a DST
 * transition has two offsets, and the one worth showing is the one in force at
 * the next class a learner could attend: the first day before the batch starts,
 * the last day after it ends, today in between.
 */
export function nextOccurrence(
	startDate?: string | null,
	endDate?: string | null
): string | undefined {
	if (!startDate) return undefined

	const today = new Date().toLocaleDateString('en-CA')
	if (today < startDate) return startDate
	if (endDate && today > endDate) return endDate
	return today
}
