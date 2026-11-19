import type { BadgeProps } from 'frappe-ui'
import {
	assessmentTitle,
	chapterTitle,
	lessonTitle,
	relativeDay,
} from '@/utils/dashboard/studentSheet'
import type {
	DaysAgo,
	LessonMark,
	SheetAssessment,
	SheetChapter,
	SheetEvent,
} from '@/utils/dashboard/studentSheet'
import type {
	CourseStudentActivity,
	CourseStudentDetail,
	LessonResult,
	StudentOutlineChapter,
	StudentOutlineLesson,
} from '@/types'

const lessonMark = (
	lesson: StudentOutlineLesson,
	current: string | null
): LessonMark => {
	if (lesson.completed) return 'done'
	return lesson.name === current ? 'current' : 'todo'
}

// Literal class names, so Tailwind emits each one.
const segmentClass = (
	mark: LessonMark,
	finished: boolean,
	inactive: boolean
): string => {
	if (mark === 'done')
		return finished ? 'bg-surface-green-7' : 'bg-surface-gray-10'
	if (mark === 'current')
		return inactive ? 'bg-surface-amber-7' : 'bg-surface-gray-7'
	return 'bg-surface-gray-3'
}

const lessonTip = (
	lesson: StudentOutlineLesson,
	mark: LessonMark,
	formatDate: (at: string) => string
): string => {
	if (mark === 'done')
		return lesson.completed_at
			? __('Completed {0}').format(formatDate(lesson.completed_at))
			: __('Completed')
	return mark === 'current' ? __('Current lesson') : __('Not started')
}

export const sheetChapters = (
	detail: CourseStudentDetail,
	formatDate: (at: string) => string
): SheetChapter[] => {
	const current = detail.up_next?.name ?? null
	const finished = !detail.up_next
	return detail.chapters.map((chapter: StudentOutlineChapter) => {
		const done = chapter.lessons.filter((lesson) => lesson.completed).length
		const title = chapterTitle(chapter.title)
		const count = `${done}/${chapter.lessons.length}`
		return {
			number: chapter.number,
			title,
			count,
			complete: done === chapter.lessons.length,
			tip: `${title} · ${count}`,
			lessons: chapter.lessons.map((lesson) => {
				const mark = lessonMark(lesson, current)
				return {
					name: lesson.name,
					title: lessonTitle(lesson.title),
					mark,
					tip: lessonTip(lesson, mark, formatDate),
					segment: segmentClass(mark, finished, detail.inactive),
				}
			}),
		}
	})
}

// An assessment linked from two lessons is listed once.
const uniqueResults = (detail: CourseStudentDetail): LessonResult[] => {
	const seen = new Set<string>()
	return detail.chapters
		.flatMap((chapter) => chapter.lessons)
		.flatMap((lesson) => lesson.assessments)
		.filter((result) => {
			const key = `${result.type}:${result.name}`
			if (seen.has(key)) return false
			seen.add(key)
			return true
		})
}

const BADGES: Record<
	Exclude<LessonResult['status'], 'not_attempted'>,
	{ label: () => string; theme: BadgeProps['theme'] }
> = {
	passed: { label: () => __('Passed'), theme: 'green' },
	failed: { label: () => __('Failed'), theme: 'red' },
	to_review: { label: () => __('To review'), theme: 'amber' },
}

const assessmentRow = (result: LessonResult): SheetAssessment => {
	const base = {
		key: `${result.type}:${result.name}`,
		title: assessmentTitle(result.title),
		score: null,
		badge: null,
	}
	if (result.type === 'quiz') {
		const kind = __('Quiz')
		if (result.status === 'not_attempted') return { ...base, kind }
		const passed = result.status === 'passed'
		return {
			...base,
			kind:
				result.attempts > 1
					? __('Quiz · {0} attempts').format(String(result.attempts))
					: kind,
			score: `${Math.round(result.score ?? 0)}%`,
			badge: passed
				? { label: __('Passed'), theme: 'green' }
				: { label: __('Failed'), theme: 'red' },
		}
	}
	const kind =
		result.type === 'exercise' ? __('Programming exercise') : __('Assignment')
	if (result.status === 'not_attempted') return { ...base, kind }
	const badge = BADGES[result.status]
	return { ...base, kind, badge: { label: badge.label(), theme: badge.theme } }
}

export const sheetAssessments = (
	detail: CourseStudentDetail
): SheetAssessment[] => uniqueResults(detail).map(assessmentRow)

// "the Networking quiz quiz" reads badly; a title already naming itself a quiz
// goes in as it is.
const quizName = (title: string): string =>
	/\bquiz$/i.test(title) ? title : __('the {0} quiz').format(title)

const quizText = (event: CourseStudentActivity, title: string): string => {
	const score = String(Math.round(event.score ?? 0))
	const name = quizName(title)
	const passed = event.kind === 'quiz_passed'
	const attempt = String(event.attempt ?? 1)
	if ((event.attempts ?? 1) > 1)
		return passed
			? __('Scored {0}% on {1} (passed, attempt {2})').format(
					score,
					name,
					attempt
			  )
			: __('Scored {0}% on {1} (failed, attempt {2})').format(
					score,
					name,
					attempt
			  )
	return passed
		? __('Scored {0}% on {1} (passed)').format(score, name)
		: __('Scored {0}% on {1} (failed)').format(score, name)
}

const eventText = (event: CourseStudentActivity): string => {
	const title = assessmentTitle(event.title ?? '')
	if (event.kind === 'lesson_completed')
		return __('Completed lesson {0} · {1}').format(
			event.number ?? '',
			lessonTitle(title)
		)
	if (event.kind.startsWith('quiz_')) return quizText(event, title)
	if (event.kind.startsWith('assignment_'))
		return __('Submitted the {0} assignment').format(title)
	if (event.kind === 'certified') return __('Certificate issued')
	if (event.kind === 'enrolled') return __('Enrolled')
	return title
}

// Literal class names, so Tailwind emits each one.
const eventDot = (kind: string): string => {
	if (kind === 'certified' || kind === 'quiz_passed')
		return 'bg-surface-green-7'
	if (kind === 'quiz_failed') return 'bg-surface-red-7'
	if (kind.startsWith('assignment_')) return 'bg-surface-amber-7'
	if (kind === 'enrolled') return 'bg-surface-blue-6'
	return 'bg-surface-gray-5'
}

export const sheetTimeline = (
	detail: CourseStudentDetail,
	daysAgo: DaysAgo
): SheetEvent[] =>
	detail.activity.map((event) => ({
		text: eventText(event),
		when: relativeDay(daysAgo(event.at)),
		dot: eventDot(event.kind),
	}))
