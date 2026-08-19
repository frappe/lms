import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { safeUrl } from '../utils/safeUrl'

describe('safeUrl', () => {
	it('passes http, https and site-relative URLs through unchanged', () => {
		expect(safeUrl('https://example.com/a.pdf')).toBe(
			'https://example.com/a.pdf'
		)
		expect(safeUrl('/files/a.pdf')).toBe('/files/a.pdf')
	})

	it('drops javascript: in any casing or with padding', () => {
		expect(safeUrl('javascript:alert(1)')).toBeUndefined()
		expect(safeUrl('JaVaScRiPt:alert(1)')).toBeUndefined()
		expect(safeUrl('  javascript:alert(1)')).toBeUndefined()
		expect(safeUrl('java\tscript:alert(1)')).toBeUndefined()
	})

	it('drops data: and vbscript:', () => {
		expect(safeUrl('data:text/html,<script>alert(1)</script>')).toBeUndefined()
		expect(safeUrl('vbscript:msgbox(1)')).toBeUndefined()
	})

	it('drops protocol-relative URLs', () => {
		expect(safeUrl('//evil.example.com/a.pdf')).toBeUndefined()
	})

	// The URL parser normalises a backslash to a slash for http(s), so `/\host`
	// resolves off-origin while reading as a path — in an href it is a phishing
	// link that survives a glance at the status bar.
	it('drops a URL whose leading slash is followed by a backslash', () => {
		expect(safeUrl('/\\evil.example.com/p')).toBeUndefined()
		expect(safeUrl('/\\\\evil.example.com/p')).toBeUndefined()
		expect(safeUrl('\\/evil.example.com/p')).toBeUndefined()
	})

	// The rejection above must not take real paths with it: a backslash anywhere
	// but immediately after the leading slash cannot introduce an authority.
	it('keeps a path that merely contains a backslash', () => {
		expect(safeUrl('/files/a\\b.pdf')).toBe('/files/a\\b.pdf')
	})

	it('returns undefined for nullish input', () => {
		expect(safeUrl(null)).toBeUndefined()
		expect(safeUrl(undefined)).toBeUndefined()
	})

	// The reason the reject value is undefined rather than ''. Vue only removes
	// an attribute when the bound value is nullish; '' is set, and src=""
	// resolves to the current page — an iframe would load the whole SPA inside
	// itself and <a href=""> would stay focusable and go nowhere.
	it('removes the attribute rather than emptying it', () => {
		const wrapper = mount({
			template: '<a :href="safeUrl(url)">x</a><iframe :src="safeUrl(url)" />',
			setup: () => ({ safeUrl, url: 'javascript:alert(1)' }),
		})
		expect(wrapper.find('a').attributes('href')).toBeUndefined()
		expect(wrapper.find('iframe').attributes('src')).toBeUndefined()
	})
})

// Vite's own loader rather than node:fs — it needs no @types/node, so the type
// check stays clean, and it resolves the same tree the app builds from.
const sources = import.meta.glob('../**/*.vue', {
	query: '?raw',
	import: 'default',
	eager: true,
}) as Record<string, string>

// :src / :href bound to an expression. Literal bindings and ones already routed
// through safeUrl() are fine.
const BOUND_URL = /\s(?::|v-bind:)(src|href)="([^"]+)"/g
const HTML_COMMENT = /<!--[\s\S]*?-->/g

const EXEMPT = new Map<string, string>([
	// A path belongs here only when the binding is provably not user-authored:
	// a constant, a router-built path, an import.meta.env value.
	['../components/Modals/Event.vue', 'template literals rooted at /lms/'],
	['../components/PersonaToolIcon.vue', 'static toolLogos map'],
	[
		'../components/Settings/EmailAccount/EmailAdd.vue',
		'link comes from the services table in emailConfig.ts',
	],
	[
		'../components/Settings/EmailAccount/EmailProviderIcon.vue',
		'logo comes from the services table in emailConfig.ts',
	],
	[
		'../components/Settings/Raven/RavenNotInstalledBanner.vue',
		'constant https literal',
	],
	[
		'../pages/ProfileCertificates.vue',
		'template literal rooted at /api/method/',
	],
])

describe('bound url attributes route through safeUrl', () => {
	const files = Object.entries(sources)

	it('finds components to scan', () => {
		expect(files.length).toBeGreaterThan(50)
	})

	// Without this, a regex that stopped matching would look exactly like a
	// clean tree.
	it('matches a known-positive binding', () => {
		const positive = '<iframe :src="getId(block)" />'
		expect([...positive.matchAll(BOUND_URL)].length).toBe(1)
	})

	it('finds no unguarded :src or :href binding', () => {
		const offenders: string[] = []
		for (const [path, src] of files) {
			if (EXEMPT.has(path)) continue
			const live = src.replace(HTML_COMMENT, '')
			for (const [, attr, expr] of live.matchAll(BOUND_URL)) {
				if (expr.includes('safeUrl(')) continue
				if (/^'[^']*'$/.test(expr.trim())) continue
				offenders.push(`${path} :${attr}="${expr}"`)
			}
		}
		expect(offenders, offenders.join('\n')).toEqual([])
	})
})
