import type { BadgeProps } from 'frappe-ui'
import dayjs from '@/utils/dayjs'
import {
	assessmentTitle,
	chapterTitle,
	relativeDay,
} from '@/utils/dashboard/studentSheet'
import type {
	ClassStripCell,
	DaysAgo,
	LessonMark,
	SheetAssessmentGroup,
	SheetAssessmentRow,
	SheetCourse,
	SheetEvent,
	SheetSegmentGroup,
} from '@/utils/dashboard/studentSheet'
import type {
	BatchStudentDetail,
	StudentActivity,
	StudentAssessment,
	StudentAssessmentStatus,
	StudentClass,
	StudentClassStatus,
	StudentCourseAssessment,
	StudentCourseOutline,
} from '@/types'

export const courseFinished = (course: StudentCourseOutline): boolean =>
	course.lessons > 0 && course.completed >= course.lessons

export const allCoursesFinished = (detail: BatchStudentDetail): boolean =>
	detail.courses.length > 0 && detail.courses.every(courseFinished)

// Same rule as the server's at-risk check: under half of the classes held.
export const isLowAttendance = (attended: number, held: number): boolean =>
	held > 0 && attended * 2 < held

// Literal class names, so Tailwind emits each one.
const segmentClass = (
	done: boolean,
	current: boolean,
	finished: boolean,
	atRisk: boolean
): string => {
	if (done) return finished ? 'bg-surface-green-7' : 'bg-surface-gray-10'
	if (current) return atRisk ? 'bg-surface-amber-7' : 'bg-surface-gray-7'
	return 'bg-surface-gray-3'
}

// One segment per lesson, grouped by course; the first lesson not done is the
// current one, unless the batch has not started or every course is done.
export const sheetSegments = (
	detail: BatchStudentDetail,
	upcoming: boolean
): SheetSegmentGroup[] => {
	const finished = allCoursesFinished(detail)
	const atRisk = detail.track === 'at_risk'
	let currentSet = upcoming || finished
	return detail.courses.map((course) => ({
		key: course.course,
		lessons: course.lessons,
		segments: Array.from({ length: course.lessons }, (_, index) => {
			const done = index < course.completed
			const current = !done && !currentSet
			if (current) currentSet = true
			let state = __('not started')
			if (done) state = __('done')
			else if (current) state = __('current')
			return {
				key: index,
				segment: segmentClass(done, current, finished, atRisk),
				tip: __('{0} · lesson {1} · {2}').format(
					course.title,
					String(index + 1),
					state
				),
			}
		}),
	}))
}

// Literal class names, so Tailwind emits each one.
const CLASS_CELLS: Record<StudentClassStatus, string> = {
	attended: 'border-transparent bg-surface-green-4',
	missed: 'border-transparent bg-surface-red-4',
	upcoming: 'border-dashed border-outline-gray-3',
}

const classTip = (cls: StudentClass): string => {
	const date = dayjs(cls.date).format('ddd D MMM')
	if (cls.status === 'attended')
		return __('{0} · {1} · attended {2} min').format(
			date,
			cls.title,
			String(cls.minutes ?? 0)
		)
	if (cls.status === 'missed')
		return __('{0} · {1} · missed').format(date, cls.title)
	return __('{0} · {1} · upcoming').format(date, cls.title)
}

// One square per class, oldest first, so a batch of any length stays compact.
export const sheetClassStrip = (classes: StudentClass[]): ClassStripCell[] =>
	[...classes]
		.sort((a, b) =>
			`${a.date} ${a.time ?? ''}`.localeCompare(`${b.date} ${b.time ?? ''}`)
		)
		.map((cls) => ({
			key: cls.name,
			date: cls.date,
			tip: classTip(cls),
			cell: CLASS_CELLS[cls.status],
		}))

const BADGES: Record<
	Exclude<StudentAssessmentStatus, 'not_attempted'>,
	{ label: () => string; theme: BadgeProps['theme'] }
> = {
	passed: { label: () => __('Passed'), theme: 'green' },
	failed: { label: () => __('Failed'), theme: 'red' },
	to_review: { label: () => __('To review'), theme: 'amber' },
}

const KINDS: Record<StudentAssessment['type'], () => string> = {
	quiz: () => __('Quiz'),
	assignment: () => __('Assignment'),
	exercise: () => __('Programming exercise'),
}

const assessmentRow = (
	row: StudentAssessment | StudentCourseAssessment,
	kind: string
): SheetAssessmentRow => {
	const base = {
		key: `${row.type}:${row.name}`,
		title: assessmentTitle(row.title),
		kind,
		score: null,
		badge: null,
		pending: null,
	}
	if (row.status === 'not_attempted')
		return {
			...base,
			pending: row.type === 'quiz' ? __('Not attempted') : __('Not submitted'),
		}
	const badge = BADGES[row.status]
	return {
		...base,
		score: row.type === 'quiz' ? `${Math.round(row.score ?? 0)}%` : null,
		badge: { label: badge.label(), theme: badge.theme },
	}
}

export const sheetAssessmentGroups = (
	detail: BatchStudentDetail
): SheetAssessmentGroup[] =>
	[
		{
			label: __('Batch'),
			rows: detail.assessments.map((row) =>
				assessmentRow(row, KINDS[row.type]())
			),
		},
		{
			label: __('From courses'),
			rows: detail.course_assessments.map((row) =>
				assessmentRow(row, `${KINDS[row.type]()} · ${row.course_title}`)
			),
		},
	].filter((group) => group.rows.length)

const chapterMark = (
	course: StudentCourseOutline,
	index: number,
	firstOpen: number
): LessonMark => {
	const chapter = course.chapters[index]!
	if (chapter.completed >= chapter.lessons) return 'done'
	return course.completed && index === firstOpen ? 'current' : 'todo'
}

export const sheetCourses = (detail: BatchStudentDetail): SheetCourse[] =>
	detail.courses.map((course) => {
		const firstOpen = course.chapters.findIndex(
			(chapter) => chapter.completed < chapter.lessons
		)
		return {
			key: course.course,
			title: course.title,
			count: `${course.completed}/${course.lessons}`,
			complete: courseFinished(course),
			chapters: course.chapters.map((chapter, index) => ({
				key: index,
				title: `${index + 1}. ${chapterTitle(chapter.title)}`,
				count: `${chapter.completed}/${chapter.lessons}`,
				mark: chapterMark(course, index, firstOpen),
			})),
		}
	})

const quizText = (event: StudentActivity, title: string): string => {
	const score = String(Math.round(event.score ?? 0))
	const passed = event.kind === 'quiz_passed'
	if ((event.attempts ?? 1) > 1) {
		const attempt = String(event.attempt ?? 1)
		return passed
			? __('Scored {0}% on {1} (passed, attempt {2})').format(
					score,
					title,
					attempt
			  )
			: __('Scored {0}% on {1} (failed, attempt {2})').format(
					score,
					title,
					attempt
			  )
	}
	return passed
		? __('Scored {0}% on {1} (passed)').format(score, title)
		: __('Scored {0}% on {1} (failed)').format(score, title)
}

const submissionText = (event: StudentActivity, title: string): string => {
	if (event.kind.endsWith('_to_review'))
		return __('Submitted {0} · awaiting review').format(title)
	if (event.kind.endsWith('_failed'))
		return __('Submitted {0} · not passed').format(title)
	return __('Submitted {0}').format(title)
}

const eventText = (event: StudentActivity): string => {
	const title = assessmentTitle(event.title ?? '')
	if (event.kind === 'attended') return __('Attended {0}').format(title)
	if (event.kind === 'missed') return __('Missed {0}').format(title)
	if (event.kind.startsWith('quiz_')) return quizText(event, title)
	if (
		event.kind.startsWith('assignment_') ||
		event.kind.startsWith('exercise_')
	)
		return submissionText(event, title)
	if (event.kind === 'course_completed')
		return __('Completed {0}').format(title)
	if (event.kind === 'evaluation_requested')
		return event.date
			? __('Requested evaluation · scheduled {0}').format(
					dayjs(event.date).format('D MMM')
			  )
			: __('Requested evaluation')
	if (event.kind === 'evaluation_pass') return __('Passed evaluation')
	if (event.kind === 'evaluation_fail') return __('Did not pass evaluation')
	if (event.kind === 'certified') return __('Certificate issued')
	if (event.kind === 'joined') return __('Joined the batch')
	return title
}

// Literal class names, so Tailwind emits each one.
const eventDot = (kind: string): string => {
	if (kind.endsWith('_failed') || kind === 'evaluation_fail')
		return 'bg-surface-red-7'
	if (kind.endsWith('_to_review')) return 'bg-surface-amber-7'
	if (kind === 'course_completed' || kind === 'evaluation_requested')
		return 'bg-surface-blue-6'
	if (kind === 'missed' || kind === 'joined') return 'bg-surface-gray-5'
	return 'bg-surface-green-7'
}

export const sheetTimeline = (
	detail: BatchStudentDetail,
	daysAgo: DaysAgo
): SheetEvent[] =>
	detail.activity.map((event) => ({
		text: eventText(event),
		when:
			event.kind === 'joined'
				? dayjs(event.at).format('D MMM')
				: relativeDay(daysAgo(event.at)),
		dot: eventDot(event.kind),
	}))
