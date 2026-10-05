/**
 * Bridge Frappe Datetime ("YYYY-MM-DD HH:MM:SS") and <input type="datetime-local">
 * ("YYYY-MM-DDTHH:MM").
 */

export function toDatetimeLocal(value) {
	if (!value) return ''
	return String(value).replace(' ', 'T').slice(0, 16)
}

export function fromDatetimeLocal(value) {
	if (!value) return null
	const normalized = String(value).replace('T', ' ')
	return normalized.length === 16 ? `${normalized}:00` : normalized
}

/**
 * Client-side schedule window check. Mirrors lms.lms.schedule_utils.
 *
 * Prefer offset-bearing ISO values from the server (`schedule_start_iso` /
 * `schedule_end_iso`) so browser and system timezones agree. Naive Frappe
 * strings are a last-resort fallback only.
 *
 * @returns {'not_started' | 'ended' | null}
 */
export function getScheduleBlockReason(
	enableScheduling,
	scheduleStart,
	scheduleEnd,
	now = new Date()
) {
	if (!enableScheduling) return null
	const start = parseScheduleInstant(scheduleStart)
	const end = parseScheduleInstant(scheduleEnd)
	if (start && now < start) return 'not_started'
	if (end && now > end) return 'ended'
	return null
}

function parseScheduleInstant(value) {
	if (!value) return null
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value
	}
	const date = new Date(value)
	return Number.isNaN(date.getTime()) ? null : date
}
