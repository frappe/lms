import { describe, expect, it } from 'vitest'
import {
	findLessonNameByNumber,
	lessonExistsByNumber,
	lessonExistsByName,
	isSelectionStale,
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

describe('isSelectionStale (delete clears the editor)', () => {
	it('is not stale while the selected lesson is still in the outline', () => {
		const selected = { number: '1-1', name: 'LESSON-A' }
		expect(isSelectionStale(selected, outline)).toBe(false)
	})

	it('is stale once the selected lesson is deleted from the outline', () => {
		// LESSON-A was deleted; LESSON-B resequenced into its old number "1-1".
		const afterDelete = [
			{
				name: 'CH-1',
				title: 'Chapter 1',
				idx: 1,
				lessons: [{ name: 'LESSON-B', title: 'Deep dive', number: '1-1' }],
			},
		]
		// The open lesson was LESSON-A at number 1-1. Tracking by number alone
		// would wrongly match LESSON-B's new 1-1; tracking by name catches it.
		const selected = { number: '1-1', name: 'LESSON-A' }
		expect(isSelectionStale(selected, afterDelete)).toBe(true)
	})

	it('does not flag a surviving lesson whose number shifted after a delete', () => {
		const afterDelete = [
			{
				name: 'CH-1',
				title: 'Chapter 1',
				idx: 1,
				lessons: [{ name: 'LESSON-B', title: 'Deep dive', number: '1-1' }],
			},
		]
		// LESSON-B is still open; only its number changed from 1-2 to 1-1.
		const selected = { number: '1-2', name: 'LESSON-B' }
		expect(isSelectionStale(selected, afterDelete)).toBe(false)
	})

	it('falls back to the number when no name was resolved', () => {
		expect(isSelectionStale({ number: '1-2' }, outline)).toBe(false)
		expect(isSelectionStale({ number: '9-9' }, outline)).toBe(true)
	})

	it('is never stale with no selection or no outline', () => {
		expect(isSelectionStale(null, outline)).toBe(false)
		expect(isSelectionStale({ name: 'LESSON-A' }, null)).toBe(false)
	})
})
