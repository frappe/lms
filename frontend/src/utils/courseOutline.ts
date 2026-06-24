import type { OutlineChapter } from '@/types/api'

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

export function lessonExistsByNumber(chapters: Chapters, number: string): boolean {
	return !!(
		number &&
		chapters?.some((c) => c.lessons?.some((l) => l.number === number))
	)
}

export function lessonExistsByName(chapters: Chapters, name: string): boolean {
	return !!(name && chapters?.some((c) => c.lessons?.some((l) => l.name === name)))
}

export interface LessonSelection {
	number?: string
	name?: string | null
}

/**
 * A lesson selection is stale once the lesson it points at has left the outline
 * (e.g. it was deleted). Prefer the stable docname — the positional `number`
 * shifts when lesson references resequence on delete/reorder, so it's only a
 * fallback when a name wasn't resolved.
 */
export function isSelectionStale(
	selected: LessonSelection | null | undefined,
	chapters: Chapters
): boolean {
	if (!selected || !chapters) return false
	return selected.name
		? !lessonExistsByName(chapters, selected.name)
		: !lessonExistsByNumber(chapters, selected.number ?? '')
}
