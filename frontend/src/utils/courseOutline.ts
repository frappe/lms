import type { OutlineChapter } from '@/types'

type Chapters = OutlineChapter[] | null | undefined

export function findLessonNameByNumber(
	chapters: Chapters,
	number: string
): string | null {
	for (const chapter of chapters ?? []) {
		const lesson = chapter.lessons?.find((l) => l.number === number)
		if (lesson) return lesson.name
	}
	return null
}

export function lessonExistsByNumber(
	chapters: Chapters,
	number: string
): boolean {
	return !!(
		number && chapters?.some((c) => c.lessons?.some((l) => l.number === number))
	)
}

export function lessonExistsByName(chapters: Chapters, name: string): boolean {
	return !!(
		name && chapters?.some((c) => c.lessons?.some((l) => l.name === name))
	)
}

/** The `?editLesson` number of a new, not yet created lesson in a chapter. */
export function draftLessonNumber(chapterIdx: number | string): string {
	return `${chapterIdx}-new`
}

export function findLessonNumberByName(
	chapters: Chapters,
	name: string
): string | null {
	for (const chapter of chapters ?? []) {
		const lesson = chapter.lessons?.find((l) => l.name === name)
		if (lesson) return lesson.number
	}
	return null
}

/**
 * What the course editor is asked to open. A draft is tied to its chapter's
 * docname and a token that the lesson it becomes keeps as its form key. A
 * position (`number`) or the course default is pinned to a lesson docname as
 * soon as it resolves.
 */
export type EditorTarget =
	| { kind: 'draft'; chapter: string; token: string }
	| { kind: 'lesson'; name: string; token?: string; chapter?: string }
	| { kind: 'number'; number: string }
	| { kind: 'default' }

export interface EditorSelection {
	chapterNumber: string
	lessonNumber: string
	number: string
	name: string | null
	title: string
	draftChapter?: string
	formKey: string
}

export type SelectionQuery = Partial<
	Record<'editLesson' | 'draftChapter' | 'editLessonName', string>
>

export const SELECTION_PARAMS = [
	'editLesson',
	'draftChapter',
	'editLessonName',
] as const

type Query = Record<string, unknown>

export function targetFromQuery(
	query: Query,
	draftToken: () => string
): EditorTarget | null {
	const { editLesson, draftChapter, editLessonName } = query
	if (typeof editLessonName === 'string' && editLessonName) {
		return { kind: 'lesson', name: editLessonName }
	}
	if (typeof editLesson !== 'string' || !editLesson) return null
	if (!editLesson.endsWith('-new'))
		return { kind: 'number', number: editLesson }
	if (typeof draftChapter !== 'string' || !draftChapter) return null
	return { kind: 'draft', chapter: draftChapter, token: draftToken() }
}

function lessonSelection(
	number: string,
	name: string,
	formKey: string
): EditorSelection {
	const [chapterNumber, lessonNumber] = number.split('-')
	return { chapterNumber, lessonNumber, number, name, title: '', formKey }
}

function firstLessonNumber(chapters: Chapters): string | null {
	return chapters?.find((c) => c.lessons?.length)?.lessons?.[0]?.number ?? null
}

/**
 * The selection a target resolves to against the outline, or null while the
 * outline doesn't have it yet. A created lesson the outline hasn't caught up
 * with keeps its draft's form open, with no position.
 */
export function resolveTarget(
	target: EditorTarget | null,
	chapters: Chapters,
	storedNumber: string | null
): EditorSelection | null {
	if (!target) return null
	if (target.kind === 'draft') {
		const chapter = chapters?.find((c) => c.name === target.chapter)
		if (!chapter) return null
		return {
			chapterNumber: String(chapter.idx),
			lessonNumber: 'new',
			number: draftLessonNumber(chapter.idx),
			name: null,
			title: '',
			draftChapter: chapter.name,
			formKey: target.token,
		}
	}
	if (target.kind === 'lesson') {
		const number = findLessonNumberByName(chapters, target.name)
		const formKey = target.token ?? target.name
		if (number) return lessonSelection(number, target.name, formKey)
		if (!target.token) return null
		return {
			chapterNumber: '',
			lessonNumber: '',
			number: '',
			name: target.name,
			title: '',
			formKey,
		}
	}
	const number =
		target.kind === 'number'
			? target.number
			: lessonExistsByNumber(chapters, storedNumber ?? '')
			? storedNumber
			: firstLessonNumber(chapters)
	const name = number && findLessonNameByNumber(chapters, number)
	return name ? lessonSelection(number, name, name) : null
}

/**
 * The URL params for what is open: its position once resolved, the docname of
 * a created lesson the outline hasn't confirmed yet, none once the target is
 * cleared. Null leaves the URL alone: an unresolved position or draft came
 * from the URL, which already names it.
 */
export function selectionQuery(
	target: EditorTarget | null,
	selection: EditorSelection | null
): SelectionQuery | null {
	if (!target) return {}
	if (selection?.number) {
		return selection.draftChapter
			? { editLesson: selection.number, draftChapter: selection.draftChapter }
			: { editLesson: selection.number }
	}
	if (target.kind === 'lesson') return { editLessonName: target.name }
	return null
}

/**
 * Whether `lessonName` lives in the chapter `chapterName`. Used when a chapter is
 * deleted to decide whether the open lesson went with it, resolved against the
 * still-current outline (the delete's reload hasn't landed yet) so the editor can
 * suppress that lesson's teardown flush before it writes to the deleted document.
 */
export function isLessonInChapter(
	chapters: Chapters,
	chapterName: string,
	lessonName: string | null | undefined
): boolean {
	if (!lessonName) return false
	const chapter = chapters?.find((c) => c.name === chapterName)
	return !!chapter?.lessons?.some((l) => l.name === lessonName)
}
