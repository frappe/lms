import type { NumberCardSparkline } from 'frappe-ui/charts'

// One NumberCard on a dashboard's KPI strip. `fallbackCaption` replaces the
// "vs last month" caption when there is no delta to print.
export interface DashboardKpi {
	key: string
	title: string
	value: number | null
	// Ink for a reading that needs attention, e.g. `var(--ink-amber-7)`.
	color?: string
	suffix?: string
	target?: number
	format?: (value: number) => string
	delta: number | null
	deltaSuffix?: string
	deltaFormat?: (value: number) => string
	negativeIsBetter?: boolean
	fallbackCaption: string
	sparkline?: NumberCardSparkline
	// A card that filters the student list when pressed: its tooltip, what it
	// does, and whether that filter is the one applied now.
	select?: { label: string; pressed: boolean; onSelect: () => void }
}

// One of the filters the student list can switch between in place.
export interface FilterChoice {
	value: string
	label: string
}

// What an analytics export covers, and the file it comes back as.
export type AnalyticsKind = 'course' | 'batch'
export type AnalyticsFormat = 'xlsx' | 'pdf' | 'png'
export type AnalyticsTimeFrame = 'all' | '7d' | '30d' | '90d' | 'custom'

// The enrollment window as `YYYY-MM-DD` days, both counted in full; null leaves
// that end open.
export interface AnalyticsWindow {
	from_date: string | null
	to_date: string | null
}

// The start of an export's real sheet: the summary rows, the student header at
// `header_row`, then the students.
export interface AnalyticsPreviewSheet {
	rows: (string | number | null)[][]
	header_row: number
	columns: number
}

// What an export would hold; `shown` of its `students` came back. A sheet for
// Excel, the report's HTML for PDF and image.
export interface AnalyticsPreview {
	students: number
	shown: number
	html: string | null
	sheet: AnalyticsPreviewSheet | null
}

export type PaymentStatus = 'Paid' | 'Pending' | 'Free'

// The last 30 days against the 30 before them. A null reading has nothing to
// measure: no enrollments to take a rate of, or no reviews in the window.
export interface PeriodCounts {
	current: number | null
	previous: number | null
}

/** One row of a feedback list, as the endpoints return it. Scores are 0-5 stars, 0 when left blank. */
export interface FeedbackRow {
	name: string
	member_name: string
	member_image?: string | null
	feedback: string | null
	creation: string
	[score: string]: string | number | null | undefined
}

export interface FeedbackTotals {
	responses: number
	low_responses: number
}

export interface FeedbackScoreColumn {
	key: string
	label: string
}

export interface FeedbackCard {
	title: string
	value: number | null
	/** A star average, with a star and one decimal; otherwise a plain count. */
	isAverage: boolean
}

/** What a FeedbackModal lists: the batch's training feedback or a course's reviews. */
export interface FeedbackModalConfig {
	title: string
	url: string
	params: Record<string, string>
	/** The one overall rating, for a list with a single score; cards are then unused. */
	average?: number
	cards: FeedbackCard[]
	scores: FeedbackScoreColumn[]
	filename: string
	labels: {
		filter: string
		empty: string
		list: string
		item: string
		previous: string
		next: string
		select: string
	}
}

export type RatingKey = 'content' | 'instructors' | 'value'

export interface FeedbackResponse
	extends FeedbackRow,
		Record<RatingKey, number> {}

export interface FeedbackSummary extends FeedbackTotals {
	averages: Record<RatingKey, number>
	latest: FeedbackResponse[]
}

export interface CourseReviewRow extends FeedbackRow {
	rating: number
}

export interface CourseFeedbackSummary extends FeedbackTotals {
	/** On the 0-5 scale, 0 when no review has a rating. */
	average: number
	latest: CourseReviewRow[]
}
