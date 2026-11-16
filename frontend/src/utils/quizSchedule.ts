import dayjs from '@/utils/dayjs'
import type { Dayjs } from 'dayjs'
import type { ScheduledAssessment } from '@/composables/useAssessmentSchedule'

export type ScheduleState = 'not_started' | 'open' | 'closing_soon' | 'ended'

export interface ScheduleNotice {
	state: ScheduleState
	theme: 'amber' | 'blue' | 'gray'
	title: string
	description: string
}

const DAY_MS = 24 * 60 * 60 * 1000

// What a student reads on a scheduled quiz's start screen. An open quiz with
// no end date needs no notice.
export function quizScheduleNotice(
	quiz: ScheduledAssessment | null | undefined,
	now: Date
): ScheduleNotice | null {
	if (!quiz?.enable_scheduling) return null
	const at = dayjs(now)
	const start = instant(quiz.schedule_start_iso || quiz.schedule_start)
	const end = instant(quiz.schedule_end_iso || quiz.schedule_end)

	if (start && at.isBefore(start)) return notStarted(start, at)
	if (end && at.isAfter(end)) return ended(end, at)
	if (!end) return null
	if (end.diff(at) < DAY_MS) return closingSoon(end, at)
	return open(end, at)
}

function notStarted(start: Dayjs, at: Dayjs): ScheduleNotice {
	return {
		state: 'not_started',
		theme: 'amber',
		title: onDay(start, at, {
			today: __('Opens today at {0}'),
			tomorrow: __('Opens tomorrow at {0}'),
			later: __('Opens on {0} at {1}'),
		}),
		description: __("That's {0}. Come back then to start it.").format(
			start.from(at)
		),
	}
}

function open(end: Dayjs, at: Dayjs): ScheduleNotice {
	return {
		state: 'open',
		theme: 'blue',
		title: __('Open until {0} at {1}').format(dateLabel(end, at), timeLabel(end)),
		description: __('You have {0}. Finish your attempt before it closes.').format(
			end.from(at, true)
		),
	}
}

function closingSoon(end: Dayjs, at: Dayjs): ScheduleNotice {
	return {
		state: 'closing_soon',
		theme: 'amber',
		title: onDay(end, at, {
			today: __('Closes today at {0}'),
			tomorrow: __('Closes tomorrow at {0}'),
			later: __('Closes on {0} at {1}'),
		}),
		description: __("That's {0}. Start soon so you have time to finish.").format(
			end.from(at)
		),
	}
}

function ended(end: Dayjs, at: Dayjs): ScheduleNotice {
	return {
		state: 'ended',
		theme: 'gray',
		title: __('This quiz closed on {0} at {1}').format(
			dateLabel(end, at),
			timeLabel(end)
		),
		description: __(
			'Reach out to your instructor if you still need to take it.'
		),
	}
}

// "today at" and "tomorrow at" are whole sentences so each can be translated.
function onDay(
	moment: Dayjs,
	at: Dayjs,
	copy: { today: string; tomorrow: string; later: string }
): string {
	if (moment.isSame(at, 'day')) return copy.today.format(timeLabel(moment))
	if (moment.isSame(at.add(1, 'day'), 'day'))
		return copy.tomorrow.format(timeLabel(moment))
	return copy.later.format(dateLabel(moment, at), timeLabel(moment))
}

function dateLabel(moment: Dayjs, at: Dayjs): string {
	return moment.format(
		moment.isSame(at, 'year') ? 'dddd, D MMMM' : 'dddd, D MMMM YYYY'
	)
}

function timeLabel(moment: Dayjs): string {
	return moment.format('LT')
}

function instant(value: string | null | undefined): Dayjs | null {
	if (!value) return null
	const moment = dayjs(value)
	return moment.isValid() ? moment : null
}
