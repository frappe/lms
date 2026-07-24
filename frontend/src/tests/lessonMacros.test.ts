import { describe, expect, it } from 'vitest'
import { convertBodyToBlocks, getMacroArg } from '@/utils/lessonMacros'

// Bug 1: a legacy `{{ PDF("...") }}` lesson, when re-opened in the editor, was
// tagged file_type 'pdf' (lowercase). utils/upload.js renders on `== 'PDF'`
// (uppercase, matching Frappe's File.set_file_type), so the block fell through
// to the <img> branch and rendered as a broken image on EVERY browser.
describe('convertBodyToBlocks — PDF macro casing', () => {
	it('tags a PDF macro block with uppercase file_type "PDF"', () => {
		const blocks = convertBodyToBlocks({
			body: `{{ PDF("/files/handbook.pdf") }}`,
		})
		expect(blocks).toEqual([
			{
				type: 'upload',
				data: { file_url: '/files/handbook.pdf', file_type: 'PDF' },
			},
		])
	})

	it('keeps other upload macros on their existing lowercase file_type', () => {
		const blocks = convertBodyToBlocks({
			body: [`{{ Video("/files/intro.mp4") }}`, `{{ Audio("/files/a.mp3") }}`].join(
				'\n'
			),
		})
		expect(blocks[0].data.file_type).toBe('mp4')
		expect(blocks[1].data.file_type).toBe('mp3')
	})

	it('maps a plain text line to a paragraph block (happy path preserved)', () => {
		expect(convertBodyToBlocks({ body: 'hello world' })).toEqual([
			{ type: 'paragraph', data: { text: 'hello world' } },
		])
	})
})

// Bug 2: getId() (via getMacroArg) ran `.match(...)[1]` unguarded. A malformed
// macro made .match() return null, and null[1] threw — taking down the whole
// lesson render instead of just skipping the bad block.
describe('getMacroArg — malformed-macro guard', () => {
	it('extracts the quoted argument from a well-formed macro', () => {
		expect(getMacroArg(`{{ PDF("/files/a.pdf") }}`)).toBe('/files/a.pdf')
		expect(getMacroArg(`{{ PDF('/files/b.pdf') }}`)).toBe('/files/b.pdf')
	})

	it('returns null instead of throwing on a malformed macro', () => {
		expect(getMacroArg(`{{ PDF() }}`)).toBeNull()
		expect(getMacroArg(`{{ PDF("unterminated }}`)).toBeNull()
		expect(getMacroArg('')).toBeNull()
	})
})
