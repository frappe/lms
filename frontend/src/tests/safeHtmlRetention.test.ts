import { describe, expect, it } from 'vitest'
import { SAFE_HTML_LEVELS, sanitizeAt } from '../directives/safeHtmlLevels'

// The companion to safeHtmlDirective.test.ts. That file proves the profiles
// block what they must; this one proves they do not eat what authors write.
// Over-sanitizing is the failure mode nobody reports as a security bug — a
// lesson table silently loses its header scope, an image loses its alt text,
// and the page still looks roughly right.
//
// `rich` is the profile that matters here: it renders lesson content, course
// and batch descriptions, quiz questions and answers, assignment questions and
// feedback, job descriptions and announcements. It is a denylist, so the
// assertion is that authored markup arrives intact.

const RICH_SURVIVES: Record<string, string> = {
	'table header scope and colspan':
		'<table><thead><tr><th scope="col" colspan="2">Marks</th></tr></thead></table>',
	'table caption and rowspan':
		'<table><caption>Results</caption><tbody><tr><td rowspan="2">1</td></tr></tbody></table>',
	'image alt text': '<img src="/files/d.png" alt="A sequence diagram">',
	'image dimensions': '<img src="/files/d.png" width="400" height="300">',
	'highlighted code block':
		'<pre><code class="language-python">print("hi")</code></pre>',
	'heading toc anchor': '<h2 data-toc-id="intro">Intro</h2>',
	'author classes and inline styles':
		'<p class="lead" style="color:red">styled</p>',
	'nested ordered list': '<ul><li>a<ol><li>b</li></ol></li></ul>',
	'blockquote and rule': '<blockquote>q</blockquote><hr>',
	'subscript superscript mark strikethrough':
		'<p>x<sub>1</sub><sup>2</sup><mark>m</mark><del>d</del></p>',
	'definition list': '<dl><dt>t</dt><dd>d</dd></dl>',
	'katex output': '<span class="katex" aria-hidden="true">x²</span>',
	'editorjs checklist item':
		'<div class="cdx-checklist__item"><span>done</span></div>',
}

describe('rich renders authored content without trimming it', () => {
	it.each(Object.entries(RICH_SURVIVES))('keeps %s', (_name, html) => {
		expect(sanitizeAt('rich', html)).toBe(html)
	})

	// Not in the table above because the anchor hook rewrites them by design.
	// The point of the assertion is that the author's own href and title ride
	// through untouched alongside the added rel/target.
	it('keeps an author link intact while adding safe rel and target', () => {
		const out = sanitizeAt('rich', '<a href="https://x.test" title="go">x</a>')
		expect(out).toContain('href="https://x.test"')
		expect(out).toContain('title="go"')
		expect(out).toContain('rel="noopener noreferrer"')
		expect(out).toContain('target="_blank"')
	})

	// No profile embeds an iframe — that is what block components are for — but
	// a legacy lesson body can still hold one, and dropping it silently loses
	// the URL it pointed at. It degrades to a link instead.
	it('degrades an iframe to a link rather than blanking it', () => {
		const out = sanitizeAt(
			'rich',
			'<iframe src="https://www.youtube.com/embed/x"></iframe>'
		)
		expect(out).toContain('href="https://www.youtube.com/embed/x"')
		expect(out).toContain('https://www.youtube.com/embed/x</a>')
		expect(out).not.toContain('<iframe')
	})

	it('leaves nothing behind for an iframe with an unusable scheme', () => {
		expect(
			sanitizeAt('rich', '<iframe src="javascript:alert(1)"></iframe>')
		).toBe('')
		expect(sanitizeAt('rich', '<iframe></iframe>')).toBe('')
	})

	it('degrades embeds at every level, not only rich', () => {
		for (const level of Object.keys(SAFE_HTML_LEVELS)) {
			expect(
				sanitizeAt(level, '<iframe src="https://x.test/e"></iframe>')
			).toContain('href="https://x.test/e"')
		}
	})

	// Tag names are case-insensitive, and a body pasted out of the jinja portal
	// or Word is exactly where an uppercase one comes from. The rewrite runs
	// inside DOMPurify's traversal, after the parser has settled the case.
	it('degrades an uppercase iframe too', () => {
		for (const markup of [
			'<IFRAME SRC="https://x.test/e"></IFRAME>',
			'<IFrame src="https://x.test/e"></IFrame>',
		]) {
			expect(sanitizeAt('rich', markup)).toContain('href="https://x.test/e"')
		}
	})

	// The standard embed snippet for years. safeUrl rejects //host as an
	// attribute, so the URL has to be given a scheme to survive as a link.
	it('degrades a protocol-relative embed by naming https', () => {
		const out = sanitizeAt(
			'rich',
			'<iframe src="//player.vimeo.com/v/1"></iframe>'
		)
		expect(out).toContain('href="https://player.vimeo.com/v/1"')
	})

	// `/\host` is `//host` to the URL parser, so a link built from it leaves the
	// origin while both href and link text read as a path.
	it('drops an embed whose src only looks site-relative', () => {
		expect(sanitizeAt('rich', '<iframe src="/\\evil.test/p"></iframe>')).toBe(
			''
		)
	})

	it('gives every degraded embed target and rel', () => {
		const out = sanitizeAt('rich', '<iframe src="https://x.test/e"></iframe>')
		expect(out).toContain('target="_blank"')
		expect(out).toContain('rel="noopener noreferrer"')
	})

	// An <a> in SVG content re-parses as an SVG-namespaced anchor, which the
	// anchor hook's tagName === 'A' test misses. DOMPurify's namespace check
	// drops it first, so the embed is lost rather than degraded — the trade is
	// deliberate for markup no editor path produces: an unguarded link that
	// navigates the lesson away would be worse than a lost one.
	it('never leaves an unguarded link for an embed inside svg', () => {
		const out = sanitizeAt(
			'rich',
			'<svg><iframe src="https://x.test/e"></iframe></svg>'
		)
		expect(out).not.toContain('<a')
		expect(out).not.toContain('<iframe')
	})

	it('keeps native video and audio players', () => {
		expect(
			sanitizeAt('rich', '<video src="/f.mp4" controls></video>')
		).toContain('<video src="/f.mp4"')
		expect(
			sanitizeAt('rich', '<audio src="/f.mp3" controls></audio>')
		).toContain('<audio src="/f.mp3"')
	})
})

// The two allowlist profiles are deliberately narrow, and both render short
// strings — a notification subject, a profile bio. These assertions record
// what that costs, so that widening either one is a visible change rather
// than a surprise.
describe('the allowlist profiles are narrow on purpose', () => {
	it('basic keeps a table but loses scope, colspan and caption', () => {
		const out = sanitizeAt(
			'basic',
			'<table><caption>c</caption><tr><th scope="col" colspan="2">A</th></tr></table>'
		)
		expect(out).toContain('<table>')
		expect(out).toContain('<th>A</th>')
		expect(out).not.toContain('scope')
		expect(out).not.toContain('colspan')
		expect(out).not.toContain('<caption>')
	})

	it('basic drops image alt text', () => {
		expect(sanitizeAt('basic', '<img src="/a.png" alt="chart">')).toBe(
			'<img src="/a.png">'
		)
	})

	it('bio keeps prose and links but drops headings, tables and code', () => {
		expect(sanitizeAt('bio', '<p>hi <strong>there</strong></p>')).toBe(
			'<p>hi <strong>there</strong></p>'
		)
		expect(sanitizeAt('bio', '<h2>Intro</h2>')).toBe('Intro')
		expect(sanitizeAt('bio', '<table><tr><td>1</td></tr></table>')).toBe('1')
		expect(sanitizeAt('bio', '<pre><code>x</code></pre>')).toBe('x')
	})

	// Text is never destroyed at any level, only its markup — a stripped tag
	// still leaves the words on the page.
	it('preserves the text of anything it strips', () => {
		for (const level of ['rich', 'basic', 'bio']) {
			expect(sanitizeAt(level, '<h3>Kept words</h3>')).toContain('Kept words')
			expect(sanitizeAt(level, '<dl><dt>term</dt></dl>')).toContain('term')
		}
	})
})
