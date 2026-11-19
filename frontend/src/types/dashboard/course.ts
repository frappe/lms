import type {
	CourseFeedbackSummary,
	PaymentStatus,
	PeriodCounts,
} from '@/types/dashboard/common'

export type StudentStage =
	| 'not_started'
	| 'in_progress'
	| 'completed'
	| 'certified'

// The funnel steps a filter can pick, each cumulative: everyone who got at
// least that far.
export type FunnelFilter =
	| 'started'
	| 'halfway'
	| 'finished'
	| 'evaluation_requested'

// `inactive` narrows `in_progress`; neither it nor a funnel step is a stage.
export type StudentFilter = StudentStage | 'inactive' | 'active' | FunnelFilter

export interface CourseFunnel {
	enrolled: number
	started: number
	halfway: number
	finished: number
	evaluation_requested: number
	certified: number
}

// One reading per week, oldest first, aligned with `weeks` (each a Monday).
// Counts are per week; completion rate and review backlog are as of the week's
// end; rating is that week's average, carried over weeks without reviews.
export interface CourseWeeklyTrends {
	weeks: string[]
	enrollments: number[]
	lessons_completed: number[]
	certificates: number[]
	active: number[]
	completion_rate: (number | null)[]
	awaiting_review: number[]
	rating: (number | null)[]
}

export interface CourseDeltas {
	enrollments: PeriodCounts
	active: PeriodCounts
	certificates: PeriodCounts
	awaiting_review: PeriodCounts
	completion_rate: PeriodCounts
	rating: PeriodCounts
}

export interface CourseDashboardStats {
	enrolled: number
	started: number
	completed: number
	certified: number
	completed_not_certified: number
	inactive: number
	active_7d: number
	awaiting_review: number
	total_lessons: number
	chapters: number
	feedback: CourseFeedbackSummary
	stages: Record<StudentStage, number>
	funnel: CourseFunnel
	// Certified by evaluation: the funnel shows the request step.
	has_evaluation: boolean
	deltas: CourseDeltas
	weekly: CourseWeeklyTrends
}

export interface QuizStats {
	name: string
	title: string
	attempts: number
	students: number
	passed: number
	pass_rate: number | null
	average_score: number | null
}

export interface AssignmentStats {
	name: string
	title: string
	submitted: number
	passed: number
	failed: number
	not_graded: number
}

export interface CourseAssessmentStats {
	quizzes: QuizStats[]
	assignments: AssignmentStats[]
}

// A type alias, not an interface, so it satisfies ResponsiveListView's
// index-signature ListRow.
export type CourseStudentRow = {
	enrollment: string
	member: string
	member_name: string
	member_image: string | null
	email: string
	progress: number
	lessons_completed: number
	stage: StudentStage
	certificate: string | null
	payment_status: PaymentStatus
	amount: number | null
	currency: string | null
	last_active: string | null
	enrolled_on: string
}

export interface CourseStudentsPage {
	total: number
	rows: CourseStudentRow[]
}

export interface CourseStudentsParams {
	course: string
	stage: StudentFilter | null
	search: string | null
	start: number
	page_length: number
}

export interface LessonCompletionRow {
	idx: number
	chapter_idx: number
	lesson: string | null
	title: string
	lesson_name: string
	completion_count: number
	// Average seconds of video watched per student who watched; null with no views.
	watch_seconds?: number | null
}

export type LessonResultStatus =
	| 'passed'
	| 'failed'
	| 'to_review'
	| 'not_attempted'

export interface LessonResult {
	type: 'quiz' | 'assignment' | 'exercise'
	name: string
	title: string
	status: LessonResultStatus
	score: number | null
	attempts: number
	at: string | null
}

export interface StudentOutlineLesson {
	name: string
	title: string
	number: string
	completed: boolean
	completed_at: string | null
	assessments: LessonResult[]
}

export interface StudentOutlineChapter {
	title: string
	number: number
	lessons: StudentOutlineLesson[]
}

export interface CourseStudentActivity {
	kind: string
	title: string | null
	number?: string
	score?: number | null
	// A quiz attempt's place among the student's attempts at that quiz, and their count.
	attempt?: number
	attempts?: number
	at: string
}

export type CourseStudentDetail = CourseStudentRow & {
	inactive: boolean
	chapters: StudentOutlineChapter[]
	up_next:
		| (StudentOutlineLesson & { chapter: string; chapter_number: number })
		| null
	quizzes: { attempted: number; passed: number; average: number | null }
	assignments: {
		total: number
		passed: number
		to_review: number
		failed: number
		not_attempted: number
	}
	certificate_detail: { name: string; issue_date: string } | null
	certification_enabled: boolean
	activity: CourseStudentActivity[]
}
