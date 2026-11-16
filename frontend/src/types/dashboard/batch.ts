import type { FeedbackSummary, PeriodCounts } from '@/types/dashboard/common'

export type BatchFilter =
	| 'on_track'
	| 'behind'
	| 'at_risk'
	| 'not_started'
	| 'completed'
	| 'certified'
	| 'started'
	| 'evaluation_requested'
	| 'no_evaluation'

export type BatchState = 'upcoming' | 'live' | 'ended'

// Days and weeks count from 1; before the start both are 0, and after the end
// they hold the last day and week.
export interface BatchTimeline {
	state: BatchState
	days: number
	day: number
	weeks: number
	week: number
	elapsed: number
	days_to_start: number | null
	days_since_end: number | null
	start_date: string
	end_date: string
	evaluation_end_date: string | null
}

export interface BatchFunnel {
	enrolled: number
	started: number
	completed: number
	evaluation_requested: number
	certified: number
}

export interface BatchClassAttendance {
	name: string
	title: string
	date: string
	time: string | null
	duration: number
	attended: number
	rate: number | null
}

export interface BatchAttendance {
	held: number
	upcoming: number
	attended: number
	rate: number | null
	classes: BatchClassAttendance[]
	upcoming_classes: {
		name: string
		title: string
		date: string
		time: string | null
	}[]
}

export interface BatchCourseProgress {
	course: string
	title: string
	average_progress: number
	completed: number
}

export interface BatchAgendaClass {
	name: string
	title: string
	date: string
	time: string | null
	duration: number
	timezone: string | null
	host: string | null
	host_name: string | null
	join_url: string | null
}

export interface BatchAgendaEvaluation {
	name: string
	member: string
	member_name: string
	member_image: string | null
	course_title: string | null
	date: string
	start_time: string | null
}

// One reading per week, oldest first, aligned with `weeks` (each a Monday).
export interface BatchWeeklyTrends {
	weeks: string[]
	enrollments: number[]
	awaiting_review: number[]
	certificates: number[]
	lessons_completed: number[]
	// Students who completed no lesson that week, of those enrolled by then.
	idle: number[]
}

export interface BatchDashboardStats {
	enrolled: number
	seat_count: number
	timeline: BatchTimeline
	counts: Record<BatchFilter, number>
	funnel: BatchFunnel
	attendance: BatchAttendance
	awaiting_review: number
	has_assignments: boolean
	total_assessments: number
	evaluations: { scheduled: number; passed: number; failed: number }
	courses: BatchCourseProgress[]
	agenda: {
		classes: BatchAgendaClass[]
		evaluations: BatchAgendaEvaluation[]
		evaluations_total: number
	}
	feedback: FeedbackSummary
	deltas: {
		enrollments: PeriodCounts
		attendance_rate: PeriodCounts
		awaiting_review: PeriodCounts
		certificates: PeriodCounts
	}
	weekly: BatchWeeklyTrends
}
