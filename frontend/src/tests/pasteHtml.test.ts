import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Markdown } from '@/utils/markdownParser'

// The Markdown block's constructor calls the Frappe `__` translation global.
declare global {
	// eslint-disable-next-line no-var
	var __: (text: string) => string
}
globalThis.__ = (text: string) => text

type Block = { type: string; data: any }

function newBlock() {
	// api is only touched by paste *insertion*, not by the pure HTML->blocks
	// parser, so a bare stub is enough for parser-level unit tests.
	return new Markdown({
		data: {},
		api: {
			blocks: {
				getCurrentBlockIndex: () => 0,
				insert: vi.fn(),
				delete: vi.fn(),
			},
			caret: { setToBlock: vi.fn() },
		},
		readOnly: false,
		config: {},
	}) as any
}

function parse(html: string): Block[] {
	return newBlock()._parsePastedHTMLToBlocks(html)
}

describe('_parsePastedHTMLToBlocks — inline formatting', () => {
	it('preserves bold, italic and inline code inside a paragraph', () => {
		const blocks = parse(
			'<p>Plain <b>bold</b> and <i>italic</i> and <code>code()</code>.</p>'
		)
		expect(blocks).toHaveLength(1)
		expect(blocks[0].type).toBe('paragraph')
		expect(blocks[0].data.text).toContain('<b>bold</b>')
		expect(blocks[0].data.text).toContain('<i>italic</i>')
		expect(blocks[0].data.text).toContain('code()')
	})

	it('normalizes strong/em/del to the editor’s inline tags', () => {
		const blocks = parse('<p><strong>a</strong><em>b</em><del>c</del></p>')
		expect(blocks[0].data.text).toBe('<b>a</b><i>b</i><s>c</s>')
	})

	it('keeps safe links and drops the tag (keeping text) for unsafe hrefs', () => {
		const ok = parse('<p><a href="https://x.io/y">link</a></p>')
		expect(ok[0].data.text).toBe('<a href="https://x.io/y">link</a>')

		const bad = parse('<p><a href="javascript:alert(1)">x</a></p>')
		expect(bad[0].data.text).toBe('x')
		expect(bad[0].data.text).not.toContain('javascript')
	})

	it('drops protocol-relative links but keeps a same-site path', () => {
		const evil = parse('<p><a href="//evil.com/x">x</a></p>')
		expect(evil[0].data.text).toBe('x')
		expect(evil[0].data.text).not.toContain('evil.com')

		const local = parse('<p><a href="/courses/1">c</a></p>')
		expect(local[0].data.text).toBe('<a href="/courses/1">c</a>')
	})

	it('strips presentational wrappers (span/font/color) but keeps their text', () => {
		const blocks = parse(
			'<p><span style="color:red">red</span> <font color="blue">blue</font></p>'
		)
		expect(blocks[0].data.text).toBe('red blue')
		expect(blocks[0].data.text).not.toContain('style')
		expect(blocks[0].data.text).not.toContain('color')
	})

	it('escapes raw angle brackets in text content', () => {
		const blocks = parse('<p>1 &lt; 2 &amp; 3 &gt; 0</p>')
		expect(blocks[0].data.text).toBe('1 &lt; 2 &amp; 3 &gt; 0')
	})
})

describe('_parsePastedHTMLToBlocks — block structure', () => {
	it('maps h1..h6 to header blocks with the right level and inline text', () => {
		const blocks = parse('<h2>Title <b>here</b></h2>')
		expect(blocks[0]).toMatchObject({ type: 'header' })
		expect(blocks[0].data.level).toBe(2)
		expect(blocks[0].data.text).toBe('Title <b>here</b>')
	})

	it('preserves nested lists with inline formatting', () => {
		const blocks = parse(
			'<ul><li>one <b>bold</b><ul><li>nested</li></ul></li><li>two</li></ul>'
		)
		expect(blocks[0].type).toBe('list')
		expect(blocks[0].data.style).toBe('unordered')
		const [first, second] = blocks[0].data.items
		expect(first.content).toBe('one <b>bold</b>')
		expect(first.items).toHaveLength(1)
		expect(first.items[0].content).toBe('nested')
		expect(second.content).toBe('two')
	})

	it('emits images inside list items as image blocks after the list', () => {
		const blocks = parse(
			'<ul><li>one <img src="https://cdn.x/i.png" alt="cat"></li><li>two</li></ul>'
		)
		expect(blocks.map((b) => b.type)).toEqual(['list', 'image'])
		expect(blocks[0].data.items.map((i) => i.content)).toEqual([
			'one ',
			'two',
		])
		expect(blocks[1].data.url).toBe('https://cdn.x/i.png')
		expect(blocks[1].data.caption).toBe('cat')
	})

	it('drops image-only list items instead of leaving blank bullets', () => {
		const blocks = parse(
			'<ul><li><img src="https://cdn.x/a.png"></li><li>text</li></ul>'
		)
		expect(blocks.map((b) => b.type)).toEqual(['list', 'image'])
		expect(blocks[0].data.items.map((i) => i.content)).toEqual(['text'])

		const imageOnly = parse(
			'<ul><li><img src="https://cdn.x/a.png"></li></ul>'
		)
		expect(imageOnly.map((b) => b.type)).toEqual(['image'])
	})

	it('hoists nested items when an unordered image-only item has children', () => {
		const blocks = parse(
			'<ul><li><img src="https://cdn.x/a.png"><ul><li>nested</li></ul></li></ul>'
		)
		expect(blocks.map((b) => b.type)).toEqual(['list', 'image'])
		expect(blocks[0].data.items).toEqual([{ content: 'nested', items: [] }])
	})

	it('keeps image-only items in ordered lists so steps are not renumbered', () => {
		const blocks = parse(
			'<ol><li>Step 1</li><li><img src="https://cdn.x/a.png"></li><li>Step 3</li></ol>'
		)
		expect(blocks.map((b) => b.type)).toEqual(['list', 'image'])
		expect(blocks[0].data.items.map((i) => i.content)).toEqual([
			'Step 1',
			'',
			'Step 3',
		])
	})

	it('converts a table (with th header row) to a table block', () => {
		const blocks = parse(
			'<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>'
		)
		expect(blocks[0].type).toBe('table')
		expect(blocks[0].data.withHeadings).toBe(true)
		expect(blocks[0].data.content).toEqual([
			['A', 'B'],
			['1', '2'],
		])
	})

	it('extracts https and base64 images into image blocks', () => {
		const https = parse('<p><img src="https://cdn.x/i.png" alt="cat"></p>')
		expect(https[0]).toMatchObject({ type: 'image' })
		expect(https[0].data.url).toBe('https://cdn.x/i.png')
		expect(https[0].data.caption).toBe('cat')

		const data = parse(
			'<figure><img src="data:image/png;base64,AAAA"></figure>'
		)
		expect(data[0].type).toBe('image')
		expect(data[0].data.url).toBe('data:image/png;base64,AAAA')
	})

	it('drops images with unsafe or protocol-relative src', () => {
		expect(
			parse('<p><img src="javascript:alert(1)"></p>').filter(
				(b) => b.type === 'image'
			)
		).toHaveLength(0)
		expect(
			parse('<p><img src="//evil.com/x.png"></p>').filter(
				(b) => b.type === 'image'
			)
		).toHaveLength(0)
	})

	it('does not duplicate rows or text from a nested table', () => {
		const blocks = parse(
			'<table><tr><td>outer<table><tr><td>inner</td></tr></table></td><td>B</td></tr></table>'
		)
		const tables = blocks.filter((b) => b.type === 'table')
		expect(tables).toHaveLength(1)
		// Only the outer table's single row, with its two direct cells.
		expect(tables[0].data.content).toHaveLength(1)
		expect(tables[0].data.content[0]).toHaveLength(2)
		expect(tables[0].data.content[0][1]).toBe('B')
		// The inner text appears once (folded into the parent cell), not as an
		// extra row.
		const innerCount = (tables[0].data.content[0][0].match(/inner/g) || [])
			.length
		expect(innerCount).toBe(1)
	})

	it('recurses through wrapper divs/sections and preserves order', () => {
		const blocks = parse(
			'<div><h3>Head</h3><div><p>para</p></div><ul><li>item</li></ul></div>'
		)
		expect(blocks.map((b) => b.type)).toEqual(['header', 'paragraph', 'list'])
	})

	it('keeps a PRE block as code (angle brackets escaped)', () => {
		const blocks = parse('<pre>let x = 1 &lt; 2</pre>')
		expect(blocks[0].type).toBe('codeBox')
		expect(blocks[0].data.code).toContain('let x')
		expect(blocks[0].data.code).toContain('&lt;')
	})

	it('ignores blank/whitespace-only paragraphs', () => {
		const blocks = parse('<p>real</p><p></p><p>&nbsp;</p>')
		expect(blocks).toHaveLength(1)
		expect(blocks[0].data.text).toBe('real')
	})
})

describe('_onNativePaste — routing', () => {
	function fakeEvent(data: Record<string, string>) {
		return {
			clipboardData: { getData: (t: string) => data[t] || '' },
			preventDefault: vi.fn(),
			stopPropagation: vi.fn(),
			stopImmediatePropagation: vi.fn(),
		} as any
	}

	let block: any
	beforeEach(() => {
		block = newBlock()
		block._insertBlocks = vi.fn()
		block._insertMarkdownAsBlocks = vi.fn()
	})

	it('takes over rich HTML pastes and inserts parsed blocks', () => {
		const e = fakeEvent({
			'text/html':
				'<h1>T</h1><p><b>x</b></p><table><tr><td>c</td></tr></table>',
			'text/plain': 'T x c',
		})
		block._onNativePaste(e)
		expect(e.preventDefault).toHaveBeenCalled()
		expect(block._insertBlocks).toHaveBeenCalledTimes(1)
		const inserted = block._insertBlocks.mock.calls[0][0]
		expect(inserted.map((b: Block) => b.type)).toEqual([
			'header',
			'paragraph',
			'table',
		])
	})

	it('defers to EditorJS for internal block paste (x-editor-js clipboard)', () => {
		const e = fakeEvent({
			'application/x-editor-js': '[{"type":"paragraph"}]',
			'text/html': '<p>hi</p>',
		})
		block._onNativePaste(e)
		expect(e.preventDefault).not.toHaveBeenCalled()
		expect(block._insertBlocks).not.toHaveBeenCalled()
	})

	it('leaves plain non-markdown text to the default handler', () => {
		const e = fakeEvent({ 'text/plain': 'just a sentence' })
		block._onNativePaste(e)
		expect(e.preventDefault).not.toHaveBeenCalled()
		expect(block._insertBlocks).not.toHaveBeenCalled()
		expect(block._insertMarkdownAsBlocks).not.toHaveBeenCalled()
	})
})

describe('pasted code block language detection', () => {
	it('reads language- class from an inner <code>', () => {
		const blocks = parse('<pre><code class="language-python">x = 1</code></pre>')
		expect(blocks[0].type).toBe('codeBox')
		expect(blocks[0].data.language).toBe('python')
	})

	it('reads language- class from the <pre> itself (Prism markup)', () => {
		const blocks = parse('<pre class="language-javascript"><code>let x</code></pre>')
		expect(blocks[0].data.language).toBe('javascript')
	})

	it('reads lang- and brush: variants', () => {
		expect(
			parse('<pre><code class="lang-ruby">x</code></pre>')[0].data.language
		).toBe('ruby')
		expect(
			parse('<pre class="brush: php">x</pre>')[0].data.language
		).toBe('php')
	})

	it('falls back to plaintext when no language class is present', () => {
		expect(parse('<pre>plain</pre>')[0].data.language).toBe('plaintext')
	})
})

describe('pasted code language detection edge cases', () => {
	it('ignores language- as a substring of an unrelated class', () => {
		expect(
			parse('<pre class="prism-language-toolbar">x</pre>')[0].data.language
		).toBe('plaintext')
	})

	it('prefers the inner <code> language over a generic <pre> class', () => {
		const blocks = parse(
			'<pre class="language-markup"><code class="language-python">x = 1</code></pre>'
		)
		expect(blocks[0].data.language).toBe('python')
	})

	it('still reads a language- class on the <pre> when the inner <code> has none', () => {
		expect(
			parse('<pre class="language-javascript"><code>x</code></pre>')[0].data
				.language
		).toBe('javascript')
	})
})
