import type { EvaluatorSchedule } from '@/types/lms/EvaluatorSchedule'

export type Weekday = EvaluatorSchedule['day']

export const WEEKDAYS: Weekday[] = [
	'Monday',
	'Tuesday',
	'Wednesday',
	'Thursday',
	'Friday',
	'Saturday',
	'Sunday',
]

export interface TimeRange {
	key: number
	start: string
	end: string
}

export type Week = Record<Weekday, TimeRange[]>

export interface ScheduleRow {
	day: Weekday
	start_time: string
	end_time: string
}

let nextKey = 0

export const newRange = (start: string, end: string): TimeRange => ({
	key: ++nextKey,
	start,
	end,
})

// The server sends Time as "9:00:00"; the picker and comparisons want "09:00".
export const toHHMM = (time: string | null | undefined): string => {
	if (!time) return ''
	const [hour = '', minute = ''] = time.split(':')
	return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
}

export const emptyWeek = (): Week =>
	Object.fromEntries(WEEKDAYS.map((day) => [day, []])) as unknown as Week

const WORKDAYS: Weekday[] = [
	'Monday',
	'Tuesday',
	'Wednesday',
	'Thursday',
	'Friday',
]

export const toWeek = (rows: ScheduleRow[]): Week => {
	const week = emptyWeek()
	for (const row of rows) {
		if (!week[row.day]) continue
		week[row.day].push(newRange(toHHMM(row.start_time), toHHMM(row.end_time)))
	}
	for (const day of WEEKDAYS) {
		week[day].sort((a, b) => a.start.localeCompare(b.start))
	}
	return week
}

export const toRows = (week: Week): ScheduleRow[] =>
	WEEKDAYS.flatMap((day) =>
		week[day].map((range) => ({
			day,
			start_time: range.start,
			end_time: range.end,
		}))
	)

const addHour = (time: string): string => {
	const [hour, minute = '00'] = time.split(':')
	const next = Number(hour) + 1
	if (next > 23) return '23:59'
	return `${String(next).padStart(2, '0')}:${minute}`
}

// A new range starts where the day's last one ends, so it never overlaps.
export const nextRange = (ranges: TimeRange[]): TimeRange => {
	const last = ranges[ranges.length - 1]
	if (!last) return newRange('09:00', '10:00')
	const start = last.end || '09:00'
	return newRange(start, addHour(start))
}

// Each range is one bookable evaluation, so 09:00 to 17:00, Monday to Friday, is
// offered as hour-long slots, in the same wall clock as every other slot.
export const standardWeek = (): Week => {
	const week = emptyWeek()
	for (const day of WORKDAYS) {
		week[day] = Array.from({ length: 8 }, (_, hour) => {
			const start = `${String(9 + hour).padStart(2, '0')}:00`
			return newRange(start, addHour(start))
		})
	}
	return week
}

export const formatRange = (range: TimeRange): string =>
	`${range.start} – ${range.end}`

const minutesOf = (time: string): number => {
	const [hours, minutes] = time.split(':').map(Number)
	return hours * 60 + (minutes || 0)
}

// Counts only ranges that make sense, so a half-typed slot doesn't skew it.
export const dayTotal = (ranges: TimeRange[]): string => {
	let total = 0
	for (const range of ranges) {
		if (range.start && range.end && range.end > range.start) {
			total += minutesOf(range.end) - minutesOf(range.start)
		}
	}
	if (!total) return ''
	const hours = Math.floor(total / 60)
	const minutes = total % 60
	if (!minutes) return __('{0}h').format(hours)
	if (!hours) return __('{0}m').format(minutes)
	return __('{0}h {1}m').format(hours, minutes)
}

// Keyed by range, so each message renders under the row it belongs to.
export const rangeErrors = (ranges: TimeRange[]): Record<number, string> => {
	const errors: Record<number, string> = {}
	for (const range of ranges) {
		if (!range.start || !range.end) {
			errors[range.key] = __('Set both a start and an end time.')
		} else if (range.end <= range.start) {
			errors[range.key] = __('End time must be after the start time.')
		}
	}
	const valid = ranges.filter((range) => !errors[range.key])
	for (const range of valid) {
		const clash = valid.find(
			(other) =>
				other !== range && other.start < range.end && range.start < other.end
		)
		if (clash) {
			errors[range.key] = __('Overlaps with {0}.').format(formatRange(clash))
		}
	}
	return errors
}

export type TimeOff = [string, string] | []

interface TimeOffSource {
	unavailable_from?: string | null
	unavailable_to?: string | null
}

export const toTimeOff = (source: TimeOffSource | null | undefined): TimeOff =>
	source?.unavailable_from && source?.unavailable_to
		? [source.unavailable_from, source.unavailable_to]
		: []
