import type { BatchFilter } from '@/types/dashboard/batch'
import type { PaymentStatus } from '@/types/dashboard/common'

export type EvaluationStatus =
	| 'not_requested'
	| 'scheduled'
	| 'passed'
	| 'failed'

export type StudentTrack =
	| 'on_track'
	| 'behind'
	| 'at_risk'
	| 'not_started'
	| 'completed'

// A type alias, not an interface, so it satisfies ResponsiveListView's
// index-signature ListRow.
export type BatchStudentRow = {
	enrollment: string
	member: string
	member_name: string
	member_image: string | null
	email: string
	progress: number
	courses: { course: string; title: string; progress: number }[]
	courses_completed: number
	total_courses: number
	attended: number
	held: number
	assessments_passed: number
	total_assessments: number
	evaluation: { status: EvaluationStatus; date: string | null }
	certificate: string | null
	certificate_course: string | null
	on_track: boolean
	at_risk: boolean
	track: StudentTrack
	payment_status: PaymentStatus
	amount: number | null
	currency: string | null
	last_active: string | null
	enrolled_on: string
}

export interface BatchStudentsPage {
	total: number
	rows: BatchStudentRow[]
}

export interface BatchStudentsParams {
	batch: string
	stage: BatchFilter | null
	search: string | null
	start: number
	page_length: number
	live_class: string | null
	attendance: 'attended' | 'missed' | null
}

export interface BatchClassAttendee {
	member: string
	member_name: string
	member_image: string | null
	duration?: number
	joined_at?: string | null
}

export interface BatchClassAttendanceDetail {
	live_class: {
		name: string
		title: string
		date: string
		time: string | null
		duration: number
	}
	attended: BatchClassAttendee[]
	missed: BatchClassAttendee[]
}

export interface StudentCourseOutline {
	course: string
	title: string
	progress: number
	lessons: number
	completed: number
	up_next: {
		chapter: string
		lesson: string
		number: number
		of: number
	} | null
	finished_at: string | null
	chapters: { title: string; lessons: number; completed: number }[]
}

export type StudentClassStatus = 'attended' | 'missed' | 'upcoming'

export interface StudentClass {
	name: string
	title: string
	date: string
	time: string | null
	status: StudentClassStatus
	minutes: number | null
	joined_at: string | null
}

export type StudentAssessmentStatus =
	| 'passed'
	| 'failed'
	| 'to_review'
	| 'not_attempted'

export interface StudentAssessment {
	type: 'quiz' | 'assignment' | 'exercise'
	name: string
	title: string
	status: StudentAssessmentStatus
	score: number | null
	at: string | null
}

// A quiz, assignment or exercise from one of the batch's course lessons.
export interface StudentCourseAssessment {
	type: 'quiz' | 'assignment' | 'exercise'
	name: string
	title: string
	status: StudentAssessmentStatus
	score: number | null
	attempts: number
	at: string | null
	course: string
	course_title: string
}

export interface StudentActivity {
	kind: string
	title: string | null
	score?: number | null
	// A quiz attempt's place among the student's attempts at that quiz, and their count.
	attempt?: number
	attempts?: number
	date?: string
	at: string
}

export type BatchStudentDetail = Omit<BatchStudentRow, 'courses'> & {
	courses: StudentCourseOutline[]
	classes: StudentClass[]
	assessments: StudentAssessment[]
	course_assessments: StudentCourseAssessment[]
	evaluation_detail: {
		request: {
			date: string
			start_time: string | null
			status: string
			evaluator_name: string | null
			course_title: string | null
		} | null
		result: {
			status: 'Pass' | 'Fail'
			date: string
			evaluator_name: string | null
		} | null
		certificate: { name: string; course: string; issue_date: string } | null
	}
	activity: StudentActivity[]
	feedback: { rating: number | null; text: string | null } | null
}

// A live class picked on the attendance chart: the students to show are the
// ones who attended it, or the ones who missed it.
export interface ClassAttendanceFilter {
	liveClass: string
	label: string
	attendance: 'attended' | 'missed'
}
