import { describe, expect, it } from 'vitest'
import { sanitizeOnWrite } from '../utils/sanitizeOnWrite'

describe('sanitizeOnWrite', () => {
	it('still removes the things that make it a sanitizer', () => {
		const out = sanitizeOnWrite(
			'<img src=x onerror=alert(1)><script>alert(1)</script><form><input></form>'
		)
		expect(out).not.toContain('onerror')
		expect(out).not.toContain('<script')
		expect(out).not.toContain('<input')
	})

	it('preserves table structure that the short-field allowlist destroys', () => {
		const table =
			'<table><caption>Week</caption><tr><th scope="col" rowspan="2">Mon</th><td>a</td></tr></table>'
		const out = sanitizeOnWrite(table)
		expect(out).toContain('<caption>')
		expect(out).toContain('scope="col"')
		expect(out).toContain('rowspan="2"')
	})

	it('preserves author alt text, including the empty decorative case', () => {
		expect(
			sanitizeOnWrite('<img src="/f.png" alt="Scan of the syllabus">')
		).toContain('alt="Scan of the syllabus"')
		expect(sanitizeOnWrite('<img src="/f.png" alt="">')).toContain('alt=""')
	})

	it('preserves lang and dir', () => {
		const out = sanitizeOnWrite('<p lang="fr" dir="rtl">bonjour</p>')
		expect(out).toContain('lang="fr"')
		expect(out).toContain('dir="rtl"')
	})
})
