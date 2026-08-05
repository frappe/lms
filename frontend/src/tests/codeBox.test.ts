import { describe, expect, it, vi } from 'vitest'
import CodeBox from '@/utils/code'

const makeBox = (data: Record<string, any>, readOnly = true) =>
	new CodeBox({
		data,
		api: { listeners: { on: vi.fn(), off: vi.fn() } },
		config: {},
		readOnly,
	})

const renderArea = (data: Record<string, any>, readOnly = true) => {
	const holder = makeBox(data, readOnly).render()
	return holder.querySelector('.codeBoxTextArea') as HTMLElement
}

describe('CodeBox legacy data normalization', () => {
	it('preserves line breaks stored as <br> when highlighting', () => {
		const area = renderArea({
			code: 'def add(a, b):<br>    return a + b<br><br>print(add(1, 2))',
			language: 'python',
		})
		expect(area.textContent).toBe(
			'def add(a, b):\n    return a + b\n\nprint(add(1, 2))'
		)
	})

	it('preserves line breaks stored as <div> rows', () => {
		const area = renderArea({
			code: 'line1<div>line2</div><div>line3</div>',
			language: 'plaintext',
		})
		expect(area.textContent).toBe('line1\nline2\nline3')
	})

	it('strips pasted style markup, keeping its text', () => {
		const area = renderArea({
			code: '<span style="color:red">const</span> x = <b>1</b>',
			language: 'javascript',
		})
		expect(area.textContent).toBe('const x = 1')
	})

	it('renders escaped markup as text, never as elements', () => {
		const area = renderArea({
			code: '&lt;img src=x onerror=alert(1)&gt;',
			language: 'Auto-detect',
		})
		expect(area.querySelector('img')).toBeNull()
		expect(area.textContent).toContain('<img src=x onerror=alert(1)>')
	})

	it('never re-normalizes plain-text data (format: text)', () => {
		const area = renderArea({
			code: 'if (a < b) { render("<div>") }',
			format: 'text',
			language: 'javascript',
		})
		expect(area.textContent).toBe('if (a < b) { render("<div>") }')
	})
})

describe('CodeBox strict language highlighting', () => {
	it('highlights the saved language', () => {
		const area = renderArea({
			code: 'def add(a, b):<br>    return a + b',
			language: 'python',
		})
		const keywords = Array.from(area.querySelectorAll('.hljs-keyword')).map(
			(el) => el.textContent
		)
		expect(keywords).toContain('def')
	})

	it('never auto-detects: legacy Auto-detect renders as plaintext', () => {
		const box = makeBox({
			code: 'def add(a, b):<br>    return a + b',
			language: 'Auto-detect',
		})
		const area = box.render().querySelector('.codeBoxTextArea') as HTMLElement
		// the stored language is preserved verbatim (resolution happens at render),
		// so a later grammar registration can pick it back up
		expect(box.data.language).toBe('Auto-detect')
		expect(box.save(null).language).toBe('Auto-detect')
		expect(area.querySelectorAll('[class*="hljs-"]').length).toBe(0)
		expect(area.textContent).toBe('def add(a, b):\n    return a + b')
	})

	it('defaults new blocks to plaintext', () => {
		const box = makeBox({ code: '' })
		expect(box.data.language).toBe('plaintext')
	})
})

describe('CodeBox save', () => {
	it('saves normalized plain text flagged as format: text', () => {
		const box = makeBox({
			code: '<span style="font-family:Consolas">a</span><br>b',
			language: 'python',
		})
		box.render()
		const saved = box.save(null)
		expect(saved.code).toBe('a\nb')
		expect(saved.format).toBe('text')
	})
})

describe('CodeBox theme styles', () => {
	it('injects a self-hosted token palette instead of the CDN stylesheet', () => {
		makeBox({ code: 'x = 1', language: 'python' })
		const styleEl = document.getElementById('highlightJSCSSElement')
		expect(styleEl?.tagName).toBe('STYLE')
		expect(styleEl?.textContent).toContain('.codeBoxHolder')
		expect(document.querySelector('link[href*="jsdelivr"]')).toBeNull()
	})
})

describe('CodeBox editing surface', () => {
	it('is plaintext-only editable in edit mode', () => {
		const area = renderArea({ code: 'x', format: 'text' }, false)
		expect(area.getAttribute('contenteditable')).toBe('plaintext-only')
	})

	it('is not editable in read-only mode', () => {
		const area = renderArea({ code: 'x', format: 'text' }, true)
		expect(area.hasAttribute('contenteditable')).toBe(false)
	})

	it('paste inserts the clipboard text/plain payload only', () => {
		const box = makeBox({ code: '', format: 'text' }, false)
		const area = box.render().querySelector('.codeBoxTextArea') as HTMLElement
		document.body.appendChild(area.parentElement as HTMLElement)
		const event = {
			preventDefault: vi.fn(),
			stopPropagation: vi.fn(),
			clipboardData: {
				getData: (type: string) =>
					type === 'text/plain'
						? 'plain\ncode'
						: '<span style="color:red">styled</span>',
			},
		}
		box._handleCodeAreaPaste(event)
		expect(event.preventDefault).toHaveBeenCalled()
		expect(box.data.code).toBe('plain\ncode')
		expect(area.querySelector('span')).toBeNull()
	})
})

describe('CodeBox caret visibility', () => {
	it('bundled theme sets a visible caret color on the dark editing surface', () => {
		makeBox({ code: 'x', format: 'text' }, false)
		const styleEl = document.getElementById('highlightJSCSSElement')
		expect(styleEl?.textContent).toMatch(
			/\.codeBoxTextArea\.dark[^{]*\{[^}]*caret-color/
		)
	})
})

describe('CodeBox storage escaping (server sanitizer safety)', () => {
	it('save() entity-escapes the plain text so nh3 cannot mangle it', () => {
		const stored = 'a -&gt; b &amp;&amp; c &lt; d'
		const box = makeBox({ code: stored, format: 'text', language: 'plaintext' }, false)
		box.render()
		expect(box.data.code).toBe('a -> b && c < d')
		const saved = box.save(null)
		expect(saved.code).toBe(stored)
		expect(box.data.code).toBe('a -> b && c < d')
	})

	it('decodes stored entities on load (round-trip)', () => {
		const area = renderArea({
			code: '&lt;div class="x"&gt; &amp;&amp; a -&gt; b',
			format: 'text',
			language: 'plaintext',
		})
		expect(area.textContent).toBe('<div class="x"> && a -> b')
	})
})

describe('CodeBox long lines', () => {
	it('bundled theme makes the code area scroll horizontally inside the block', () => {
		makeBox({ code: 'x', format: 'text' }, false)
		const styleEl = document.getElementById('highlightJSCSSElement')
		expect(styleEl?.textContent).toMatch(
			/\.codeBoxHolder \.codeBoxTextArea[^{]*\{[^}]*overflow-x:\s*auto/
		)
	})
})

describe('CodeBox review fixes', () => {
	it('converts legacy <p>/<li> block boundaries to line breaks', () => {
		const p = renderArea({
			code: '<p>line1</p><p>line2</p>',
			language: 'plaintext',
		})
		expect(p.textContent).toBe('line1\nline2')
		const li = renderArea({
			code: 'intro<ul><li>x</li><li>y</li></ul>',
			language: 'plaintext',
		})
		expect(li.textContent).toBe('intro\nx\ny')
	})

	it('decodes quote/backtick entities from storage (escapeHTML output)', () => {
		const area = renderArea({
			code: '&quot;hi&quot; &#39;s &#x27;t&#x27; &#x60;tick&#x60; &amp;lt;',
			format: 'text',
			language: 'plaintext',
		})
		expect(area.textContent).toBe('"hi" \'s \'t\' `tick` &lt;')
	})

	it('keeps an unregistered language verbatim but renders it as plaintext', () => {
		const box = makeBox(
			{ code: 'FROM alpine', format: 'text', language: 'dockerfile' },
			false
		)
		const area = box.render().querySelector('.codeBoxTextArea') as HTMLElement
		expect(box.data.language).toBe('dockerfile')
		expect(box.save(null).language).toBe('dockerfile')
		expect(area.querySelectorAll('[class*="hljs-"]').length).toBe(0)
	})
})

describe('CodeBox review fixes, round 2', () => {
	it('preserves a deliberate trailing blank line from legacy <br><br>', () => {
		const area = renderArea({ code: 'end<br><br>', language: 'plaintext' })
		expect(area.textContent).toBe('end\n\n')
	})

	it('does not double line breaks for nested legacy block wrappers', () => {
		const area = renderArea({
			code: '<ul><li><div>a</div></li><li>b</li></ul>',
			language: 'plaintext',
		})
		expect(area.textContent).toBe('a\nb')
	})

	it('decodes every escapeHTML entity, including &#x3D;', () => {
		const area = renderArea({
			code: 'a &#x3D; b &#x60;t&#x60;',
			format: 'text',
			language: 'plaintext',
		})
		expect(area.textContent).toBe('a = b `t`')
	})

	it('custom theme configs keep their own <link> without evicting the bundled <style>', () => {
		makeBox({ code: 'x', format: 'text' })
		const style = document.getElementById('highlightJSCSSElement')
		expect(style?.tagName).toBe('STYLE')
		new CodeBox({
			data: { code: 'y', format: 'text' },
			api: { listeners: { on: vi.fn(), off: vi.fn() } },
			config: { themeURL: 'https://example.test/theme.css' },
			readOnly: true,
		})
		expect(document.getElementById('highlightJSCSSElement')?.tagName).toBe('STYLE')
		const link = document.getElementById('highlightJSCSSLinkElement')
		expect(link?.tagName).toBe('LINK')
		expect(link?.getAttribute('href')).toBe('https://example.test/theme.css')
	})
})
