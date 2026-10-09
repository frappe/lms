import { describe, expect, it } from 'vitest'
import {
	draftLessonNumber,
	findLessonNameByNumber,
	findLessonNumberByName,
	lessonExistsByNumber,
	lessonExistsByName,
	resolveTarget,
	isLessonInChapter,
} from '@/utils/courseOutline'

// Two lessons in one chapter. `number` is positional ("chapterIdx-lessonIdx")
// and shifts when references resequence on delete; `name` is the stable docname.
const outline = [
	{
		name: 'CH-1',
		title: 'Chapter 1',
		idx: 1,
		lessons: [
			{ name: 'LESSON-A', title: 'Intro', number: '1-1' },
			{ name: 'LESSON-B', title: 'Deep dive', number: '1-2' },
		],
	},
]

describe('findLessonNameByNumber', () => {
	it('resolves the stable docname from a positional number', () => {
		expect(findLessonNameByNumber(outline, '1-2')).toBe('LESSON-B')
	})

	it('returns null for an unknown number or empty outline', () => {
		expect(findLessonNameByNumber(outline, '9-9')).toBeNull()
		expect(findLessonNameByNumber(null, '1-1')).toBeNull()
	})
})

describe('lessonExistsByNumber / lessonExistsByName', () => {
	it('detects presence by number and by name', () => {
		expect(lessonExistsByNumber(outline, '1-1')).toBe(true)
		expect(lessonExistsByNumber(outline, '1-9')).toBe(false)
		expect(lessonExistsByName(outline, 'LESSON-B')).toBe(true)
		expect(lessonExistsByName(outline, 'LESSON-Z')).toBe(false)
	})
})

describe('resolveTarget (what the editor opens)', () => {
	const afterDelete = [
		{
			name: 'CH-1',
			title: 'Chapter 1',
			idx: 1,
			lessons: [{ name: 'LESSON-B', title: 'Deep dive', number: '1-1' }],
		},
	]

	it('follows a lesson by docname when its number shifts', () => {
		// LESSON-A was deleted; LESSON-B resequenced into its old number "1-1".
		const b = { kind: 'lesson', name: 'LESSON-B' } as const
		expect(resolveTarget(b, outline, null)?.number).toBe('1-2')
		expect(resolveTarget(b, afterDelete, null)?.number).toBe('1-1')
	})

	it('resolves nothing for a lesson the outline no longer has', () => {
		const a = { kind: 'lesson', name: 'LESSON-A' } as const
		expect(resolveTarget(a, afterDelete, null)).toBeNull()
		expect(resolveTarget(a, null, null)).toBeNull()
	})

	it('resolves a number to the lesson there', () => {
		expect(
			resolveTarget({ kind: 'number', number: '1-2' }, outline, null)?.name
		).toBe('LESSON-B')
		expect(
			resolveTarget({ kind: 'number', number: '9-9' }, outline, null)
		).toBeNull()
	})

	it('opens the stored lesson by default, else the first one', () => {
		const d = { kind: 'default' } as const
		expect(resolveTarget(d, outline, '1-2')?.name).toBe('LESSON-B')
		expect(resolveTarget(d, outline, '9-9')?.name).toBe('LESSON-A')
	})
})

describe('draft lesson selection', () => {
	const draft = { kind: 'draft', chapter: 'CH-1', token: 'draft-1' } as const

	it('numbers a draft by its chapter', () => {
		expect(draftLessonNumber(1)).toBe('1-new')
	})

	it('resolves while its chapter is in the outline, though no lesson matches', () => {
		expect(resolveTarget(draft, outline, null)).toMatchObject({
			number: '1-new',
			draftChapter: 'CH-1',
			formKey: 'draft-1',
		})
	})

	it('resolves nothing once its chapter is gone', () => {
		expect(resolveTarget(draft, [], null)).toBeNull()
	})

	it('finds a created lesson number by its docname', () => {
		expect(findLessonNumberByName(outline, 'LESSON-B')).toBe('1-2')
		expect(findLessonNumberByName(outline, 'NOPE')).toBeNull()
	})
})

describe('isLessonInChapter (chapter delete takes its lessons)', () => {
	it('is true when the lesson belongs to the named chapter', () => {
		expect(isLessonInChapter(outline, 'CH-1', 'LESSON-B')).toBe(true)
	})

	it('is false when the lesson is in a different chapter', () => {
		const twoChapters = [
			...outline,
			{
				name: 'CH-2',
				title: 'Chapter 2',
				idx: 2,
				lessons: [{ name: 'LESSON-C', title: 'Outro', number: '2-1' }],
			},
		]
		expect(isLessonInChapter(twoChapters, 'CH-2', 'LESSON-A')).toBe(false)
		expect(isLessonInChapter(twoChapters, 'CH-2', 'LESSON-C')).toBe(true)
	})

	it('is false for an unknown chapter, missing lesson, or empty outline', () => {
		expect(isLessonInChapter(outline, 'CH-9', 'LESSON-A')).toBe(false)
		expect(isLessonInChapter(outline, 'CH-1', null)).toBe(false)
		expect(isLessonInChapter(outline, 'CH-1', undefined)).toBe(false)
		expect(isLessonInChapter(null, 'CH-1', 'LESSON-A')).toBe(false)
	})
})
