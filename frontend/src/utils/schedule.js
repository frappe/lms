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
 * Prefer the server-provided `schedule_block_reason` on quiz/assignment
 * payloads when present — Frappe Datetimes are system-timezone wall clocks,
 * so a browser-local parse can disagree with the server across timezones.
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
	if (scheduleStart && now < new Date(scheduleStart)) return 'not_started'
	if (scheduleEnd && now > new Date(scheduleEnd)) return 'ended'
	return null
}
