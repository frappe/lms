import { describe, expect, it } from 'vitest'
import {
	hasInstructorContent,
	hasEditorContent,
	shouldSkipLessonSave,
} from '@/utils/lessonForm'

// Regression guard: a transient/empty editor (hot-reload remount, render race,
// mid lesson-switch) must NOT be allowed to overwrite a saved lesson. saveLesson
// calls hasEditorContent on the editor payload and refuses to persist when false.
describe('hasEditorContent (anti-wipe guard)', () => {
	it('is false for a missing / non-array blocks payload', () => {
		expect(hasEditorContent(null)).toBe(false)
		expect(hasEditorContent(undefined)).toBe(false)
		expect(hasEditorContent({})).toBe(false)
	})

	it('is false for zero blocks', () => {
		expect(hasEditorContent({ blocks: [] })).toBe(false)
	})

	it('is false for the exact wipe payload: one empty default paragraph', () => {
		// This is what a freshly remounted EditorJS serialises to — the state that
		// reduced real lessons to "1 block / ~109 chars".
		expect(
			hasEditorContent({ blocks: [{ type: 'paragraph', data: { text: '' } }] })
		).toBe(false)
		expect(
			hasEditorContent({
				blocks: [{ type: 'paragraph', data: { text: '   ' } }],
			})
		).toBe(false)
	})

	it('is true for a paragraph with real text', () => {
		expect(
			hasEditorContent({
				blocks: [{ type: 'paragraph', data: { text: 'Real content' } }],
			})
		).toBe(true)
	})

	it('is true for a non-paragraph block (embed/image/quiz)', () => {
		expect(
			hasEditorContent({ blocks: [{ type: 'embed', data: { embed: '/v' } }] })
		).toBe(true)
	})
})

describe('hasInstructorContent', () => {
	it('returns false for empty / nullish input', () => {
		expect(hasInstructorContent(null, null)).toBe(false)
		expect(hasInstructorContent('', '')).toBe(false)
		expect(hasInstructorContent(undefined, undefined)).toBe(false)
	})

	it('returns true when legacy markdown notes are non-empty', () => {
		expect(hasInstructorContent(null, '  some notes  ')).toBe(true)
	})

	it('returns false for legacy notes that are only whitespace', () => {
		expect(hasInstructorContent(null, '   ')).toBe(false)
	})

	it('returns false for EditorJS JSON with no blocks', () => {
		expect(hasInstructorContent(JSON.stringify({ blocks: [] }), null)).toBe(
			false
		)
	})

	it('returns false for a single empty paragraph block', () => {
		const content = JSON.stringify({
			blocks: [{ type: 'paragraph', data: { text: '   ' } }],
		})
		expect(hasInstructorContent(content, null)).toBe(false)
	})

	it('returns true for a paragraph block with text', () => {
		const content = JSON.stringify({
			blocks: [{ type: 'paragraph', data: { text: 'Hello' } }],
		})
		expect(hasInstructorContent(content, null)).toBe(true)
	})

	it('returns true for a non-paragraph block with data (e.g. image)', () => {
		const content = JSON.stringify({
			blocks: [{ type: 'upload', data: { file_url: '/x.png' } }],
		})
		expect(hasInstructorContent(content, null)).toBe(true)
	})

	it('returns false for malformed JSON', () => {
		expect(hasInstructorContent('{not json', null)).toBe(false)
	})
})

// A freshly created lesson opens with the title "Untitled lesson" and an empty
// body; autosaving its title must work (content is optional). Only a fully
// empty lesson is skipped, so autosave doesn't error on the required title.
describe('shouldSkipLessonSave', () => {
	it('saves a title-only lesson (empty body)', () => {
		expect(shouldSkipLessonSave('My Lesson', false)).toBe(false)
	})

	it('saves when the body has content even if the title is blank', () => {
		expect(shouldSkipLessonSave('', true)).toBe(false)
		expect(shouldSkipLessonSave('   ', true)).toBe(false)
	})

	it('skips only when both title and body are empty', () => {
		expect(shouldSkipLessonSave('', false)).toBe(true)
		expect(shouldSkipLessonSave('   ', false)).toBe(true)
		expect(shouldSkipLessonSave(null, false)).toBe(true)
		expect(shouldSkipLessonSave(undefined, false)).toBe(true)
	})
})
