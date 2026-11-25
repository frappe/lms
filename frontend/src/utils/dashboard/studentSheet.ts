import { nextTick } from 'vue'
import type { BadgeProps } from 'frappe-ui'
import dayjs, { serverTime } from '@/utils/dayjs'

// Days between two calendar dates, so "yesterday" means the day before today
// whatever the hour.
export type DaysAgo = (at: string) => number

export type LessonMark = 'done' | 'current' | 'todo'

export interface SheetEvent {
	text: string
	when: string
	dot: string
}

export interface SheetAction {
	label: string
	loading: boolean
	run: () => void
}

export const daysAgo: DaysAgo = (at) =>
	dayjs().startOf('day').diff(serverTime(at).startOf('day'), 'day')

export const relativeDay = (days: number): string => {
	if (days <= 0) return __('today')
	if (days === 1) return __('yesterday')
	return __('{0} days ago').format(String(days))
}

// Points the way the section opens: down when open, toward the reading end
// when closed.
export const chevronClass = (open: boolean): string =>
	open ? 'lucide-chevron-down' : 'lucide-chevron-right rtl:-scale-x-100'

export const revealSection = async (
	section: () => HTMLElement | null,
	open: () => void
): Promise<void> => {
	open()
	await nextTick()
	section()?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
}

// "Chapter 2: Foundations" under a row already numbered 2 reads the number
// twice. The prefix goes only when what follows it is a real title.
const ordinalPrefix = (word: string): RegExp =>
	new RegExp(
		`^${word}\\s+\\d+(?:\\.\\d+)*(?:\\s*[:\\-–—]|\\.(?=\\s))\\s*(?=\\S)`,
		'i'
	)

export const withoutOrdinal = (title: string, word: string): string =>
	title.replace(ordinalPrefix(word), '')

export const chapterTitle = (title: string): string =>
	withoutOrdinal(title, 'chapter')

export const lessonTitle = (title: string): string =>
	withoutOrdinal(title, 'lesson')

// Generated assessment titles repeat the course title before an em dash.
export const assessmentTitle = (title: string): string =>
	title.split(' — ').slice(1).join(' — ') || title

export interface SheetSegmentGroup {
	key: string
	lessons: number
	segments: { key: number; segment: string; tip: string }[]
}

export interface ClassStripCell {
	key: string
	date: string
	tip: string
	cell: string
}

export interface SheetAssessmentRow {
	key: string
	title: string
	kind: string
	score: string | null
	badge: { label: string; theme: BadgeProps['theme'] } | null
	pending: string | null
}

export interface SheetAssessmentGroup {
	label: string
	rows: SheetAssessmentRow[]
}

export interface SheetCourseChapter {
	key: number
	title: string
	count: string
	mark: LessonMark
}

export interface SheetCourse {
	key: string
	title: string
	count: string
	complete: boolean
	chapters: SheetCourseChapter[]
}

export interface SheetLesson {
	name: string
	title: string
	mark: LessonMark
	tip: string
	segment: string
}

export interface SheetChapter {
	number: number
	title: string
	count: string
	complete: boolean
	tip: string
	lessons: SheetLesson[]
}

export interface SheetAssessment {
	key: string
	title: string
	kind: string
	score: string | null
	badge: { label: string; theme: BadgeProps['theme'] } | null
}
