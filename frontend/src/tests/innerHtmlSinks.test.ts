import { describe, expect, it } from 'vitest'

// The JavaScript-side counterpart of the template gates. v-safe-html, the
// semgrep rules and the :src scanner all stop at .vue markup, and the EditorJS
// blocks under src/utils build their DOM by hand — which is where every
// innerHTML sink in this app has actually been.

const sources = import.meta.glob('../**/*.{js,ts,vue}', {
	query: '?raw',
	import: 'default',
	eager: true,
}) as Record<string, string>

const LINE_COMMENT = /^\s*(?:\/\/|\*|\/\*)/
// './x' is this directory — the tests themselves, which quote sinks as fixtures.
const app = Object.entries(sources).filter(
	([path]) => !path.startsWith('./') && !path.includes('/tests/')
)

describe('innerHTML writes go through the sanitizer', () => {
	const WRITE = /\.innerHTML\s*=\s*(.*)$/
	// A literal with no interpolation is markup this repo wrote, not data.
	const LITERAL = /^(['"`])[^$]*\1\s*(?:;)?\s*$/

	const EXEMPT = new Map<string, string>([
		[
			'../utils/code.ts',
			'hljs.highlight escapes the source it returns (see the call site)',
		],
		['../utils/inline/BaseInline.ts', 'module-constant icon markup'],
		[
			'../utils/inertHtml.ts',
			'the one deliberate write: an inert DOMParser document, pre-sanitizer',
		],
		['../utils/inline/TextAlign.ts', 'module-constant icon markup'],
	])

	it('finds sources to scan', () => {
		expect(app.length).toBeGreaterThan(200)
	})

	it('flags an interpolated write and passes a sanitized one', () => {
		const bad = 'el.innerHTML = `<a href="${url}">x</a>`'
		const good = "el.innerHTML = sanitizeAt('rich', text)"
		const empty = "el.innerHTML = ''"
		const rhs = (line: string) => line.match(WRITE)?.[1] ?? ''
		expect(LITERAL.test(rhs(bad)) || rhs(bad).includes('sanitizeAt(')).toBe(
			false
		)
		expect(rhs(good).includes('sanitizeAt(')).toBe(true)
		expect(LITERAL.test(rhs(empty))).toBe(true)
	})

	it('finds no unsanitized innerHTML write', () => {
		const offenders: string[] = []
		for (const [path, src] of app) {
			if (EXEMPT.has(path)) continue
			src.split('\n').forEach((line, i) => {
				if (LINE_COMMENT.test(line)) return
				const rhs = line.match(WRITE)?.[1]
				if (rhs === undefined) return
				if (rhs.includes('sanitizeAt(') || LITERAL.test(rhs)) return
				offenders.push(`${path}:${i + 1} ${line.trim()}`)
			})
		}
		expect(offenders, offenders.join('\n')).toEqual([])
	})
})
