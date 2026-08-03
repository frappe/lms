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
			body: [
				`{{ Video("/files/intro.mp4") }}`,
				`{{ Audio("/files/a.mp3") }}`,
			].join('\n'),
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

// Regression: a stored lesson with a malformed macro (empty parens / unbalanced
// quotes) used to hit an unguarded `.match(...)[1]` in every macro branch and
// throw, crashing the lesson editor on open. Every branch now routes through
// getMacroArg and must degrade to an empty arg instead of throwing.
describe('convertBodyToBlocks — malformed macros never crash the editor', () => {
	const malformed = [
		'{{ Video() }}',
		'{{ Audio() }}',
		'{{ PDF() }}',
		'{{ Quiz() }}',
		'{{ Embed() }}',
		'{{ YouTubeVideo() }}',
		'![]', // image macro with no parens
		`{{ PDF("unterminated }}`,
	]

	it.each(malformed)('does not throw on %s', (line) => {
		expect(() => convertBodyToBlocks({ body: line })).not.toThrow()
	})

	it('does not throw when a bad macro is mixed with good content', () => {
		const body = [
			'# Heading',
			'{{ Video() }}',
			'{{ PDF("/files/ok.pdf") }}',
			'plain text',
		].join('\n')
		let blocks: ReturnType<typeof convertBodyToBlocks> = []
		expect(() => (blocks = convertBodyToBlocks({ body }))).not.toThrow()
		// the well-formed PDF still resolves correctly alongside the bad macro
		expect(
			blocks.some(
				(b) => b.type === 'upload' && b.data.file_url === '/files/ok.pdf',
			),
		).toBe(true)
	})
})

// Bug 3: header detection used `block.includes('#')`, so any prose line
// containing a '#' anywhere (e.g. "Great for C# developers") became a header
// with every '#' stripped, mangling the body. Only a leading '#' run is a header.
describe('convertBodyToBlocks — header detection is leading-only', () => {
	it('keeps prose with an inline # as a paragraph, verbatim', () => {
		expect(convertBodyToBlocks({ body: 'Great for C# developers' })).toEqual([
			{ type: 'paragraph', data: { text: 'Great for C# developers' } },
		])
	})

	it('treats a leading # run as a header and strips only that run', () => {
		expect(convertBodyToBlocks({ body: '## Notes on C# and F#' })).toEqual([
			{ type: 'header', data: { text: 'Notes on C# and F#', level: 2 } },
		])
	})

	it('derives level from the leading run, not the total # count', () => {
		const [block] = convertBodyToBlocks({ body: '# One # inline' })
		expect(block).toEqual({
			type: 'header',
			data: { text: 'One # inline', level: 1 },
		})
	})
})

// Bug 4: a `youtube` field holding a full "watch?v=ID" URL was reduced with
// split('/').pop(), yielding "watch?v=ID" and a broken /embed/watch?v=ID src.
describe('convertBodyToBlocks — youtube field URL forms', () => {
	it.each([
		['https://www.youtube.com/watch?v=abc123', 'abc123'],
		['https://youtu.be/abc123', 'abc123'],
		['https://www.youtube.com/embed/abc123', 'abc123'],
		['abc123', 'abc123'],
	])('embeds %s as the ID %s', (youtube, id) => {
		const blocks = convertBodyToBlocks({ body: '', youtube })
		expect(blocks[0]).toEqual({
			type: 'embed',
			data: {
				service: 'youtube',
				embed: `https://www.youtube.com/embed/${id}`,
			},
		})
	})
})

// Bug 5: file_type came from url.split('.').pop() without stripping the query
// string, so "/files/clip.mp4?v=2" produced "mp4?v=2" and failed isVideo().
describe('convertBodyToBlocks — media file_type ignores query strings', () => {
	it('strips a query string before deriving the extension', () => {
		const blocks = convertBodyToBlocks({
			body: [
				`{{ Video("/files/clip.mp4?v=2") }}`,
				`{{ Audio("/files/a.mp3#t=3") }}`,
			].join('\n'),
		})
		expect(blocks[0].data.file_type).toBe('mp4')
		expect(blocks[1].data.file_type).toBe('mp3')
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
