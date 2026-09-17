/**
 * The design-token gate. One suite for every colour, radius and control that
 * has to come from espresso via frappe-ui rather than from a literal.
 *
 * frappe-ui's tailwind preset registers two things that read identically in
 * markup and behave nothing alike:
 *
 *   bg-surface-gray-3   ->  var(--surface-gray-3)   redefined under
 *                                                   [data-theme='dark']
 *   bg-gray-200         ->  oklch(0.946 0 0)        declared on :root only
 *   var(--gray-200)     ->  same, via the raw CSS variable
 *   var(--white)        ->  never declared; the fallback always wins
 *   #e5e7eb             ->  itself
 *
 * Only the first flips. Every other row paints a light-mode value into dark
 * mode, and light mode hides it for free — which is why this drift ships
 * looking fine. The quiz radio arrived by a third route: a native
 * `<input type="radio">` gets `background-color: #fff` from @tailwindcss/forms,
 * and frappe-ui patches only the checkbox for dark mode, never the radio.
 *
 * The legal vocabulary is read from the installed frappe-ui rather than
 * restated here, so a token frappe-ui renames or drops becomes a failure
 * without anyone editing this file. That only holds while the install matches
 * the pin, hence `frappe-ui install` below: beta.69 dropped 22 tokens that
 * beta.24 still has, so a stale node_modules would accept names CI rejects.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const FRAPPE_UI = resolve(process.cwd(), 'node_modules/frappe-ui')
const readJSON = (path: string) =>
	JSON.parse(readFileSync(resolve(FRAPPE_UI, path), 'utf8'))

const colors = readJSON('tailwind/generated/colors.json')

// surface-gray-3, ink-blue-4, outline-alpha-gray-1, ... every name that
// resolves to a themed CSS variable.
const SEMANTIC_TOKENS = new Set<string>(
	Object.entries(colors.themedVariables.light).flatMap(
		([category, tokens]) =>
			Object.keys(tokens as object).map((name) => `${category}-${name}`)
	)
)

// The primitive ramps. Registered as Tailwind colours, declared on :root only.
const RAW_FAMILIES = Object.keys(colors.lightMode).filter(
	(family) => !family.endsWith('-alpha')
)

// Utilities that take a colour.
const COLOR_UTILITIES = [
	'bg',
	'text',
	'border',
	'ring',
	'outline',
	'divide',
	'from',
	'via',
	'to',
	'fill',
	'stroke',
	'accent',
	'caret',
	'placeholder',
	'decoration',
	'shadow',
]

// Radius aliases removed in frappe-ui 1.0.0 (ADR-0006). The preset replaces
// Tailwind's own radius scale, so these emit no CSS at all.
const RADIUS_ALIAS_STEP: Record<string, string> = {
	sm: '1',
	md: '5',
	lg: '6',
	xl: '7',
	'2xl': '8',
}
const RADIUS_SIDES = [
	't',
	'r',
	'b',
	'l',
	'tl',
	'tr',
	'br',
	'bl',
	's',
	'e',
	'ss',
	'se',
	'es',
	'ee',
]

const DEAD_RADIUS: Record<string, string> = {}
for (const side of RADIUS_SIDES) {
	DEAD_RADIUS[`rounded-${side}`] = `rounded-${side}-4`
}
for (const side of ['', ...RADIUS_SIDES.map((s) => `-${s}`)]) {
	for (const [alias, step] of Object.entries(RADIUS_ALIAS_STEP)) {
		DEAD_RADIUS[`rounded${side}-${alias}`] = `rounded${side}-${step}`
	}
}

/**
 * Literal colours that are allowed to stay, each with the reason.
 *
 * A scrim over video or cover art is black in both themes by design, but it
 * goes through `black-overlay-*` so the opacity comes from the token set —
 * these entries are the ones that cannot.
 */
const LITERAL_ALLOWLIST: Record<string, string> = {
	'components/Icons/LMSLogo.vue': 'brand mark; fixed by definition',
	'utils/code.ts': 'vendored highlight.js theme (atom-one), own light/dark pair',
	'styles/blockEditor.css':
		'vendored highlight.js theme + EditorJS shadow values',
	'pages/Lesson.vue': 'vendored highlight.js theme (night-owl)',
}

// Vite's own loader, so the type check needs no @types/node for the tree scan
// and it resolves what the app builds from.
const sources = import.meta.glob('../**/*.{vue,ts,js,css}', {
	query: '?raw',
	import: 'default',
	eager: true,
}) as Record<string, string>

// `src/tests` deliberately contains offending strings as fixtures. The glob is
// relative to this file, so a sibling in the same directory comes back as
// `./foo.test.ts` — excluding `../tests/` alone would let every one of them in.
const FILES = Object.entries(sources)
	.filter(([path]) => path.startsWith('../') && !path.startsWith('../tests/'))
	.map(([path, source]) => [path.slice('../'.length), source] as const)

/**
 * Blank out comment regions, preserving line numbers, so a hex quoted in prose
 * ("EditorJS defaults to a hardcoded #fff") is not read as a live value. Block
 * state carries across lines.
 */
const stripComments = (lines: string[]): string[] => {
	let inBlock = false
	let inHtml = false
	return lines.map((raw) => {
		let out = ''
		let i = 0
		while (i < raw.length) {
			if (inBlock) {
				const end = raw.indexOf('*/', i)
				if (end === -1) {
					out += ' '.repeat(raw.length - i)
					i = raw.length
				} else {
					out += ' '.repeat(end + 2 - i)
					i = end + 2
					inBlock = false
				}
				continue
			}
			if (inHtml) {
				const end = raw.indexOf('-->', i)
				if (end === -1) {
					out += ' '.repeat(raw.length - i)
					i = raw.length
				} else {
					out += ' '.repeat(end + 3 - i)
					i = end + 3
					inHtml = false
				}
				continue
			}
			if (raw.startsWith('/*', i)) {
				inBlock = true
				continue
			}
			if (raw.startsWith('<!--', i)) {
				inHtml = true
				continue
			}
			// `//` to end of line, but not the one inside `https://`.
			if (raw.startsWith('//', i) && raw[i - 1] !== ':') {
				out += ' '.repeat(raw.length - i)
				i = raw.length
				continue
			}
			out += raw[i]
			i++
		}
		return out
	})
}

type Offender = string
const at = (file: string, line: number, detail: string): Offender =>
	`${file}:${line} — ${detail}`

/** Every code line of every scanned file, comments blanked. */
const codeLines = function* (): Generator<[string, number, string]> {
	for (const [file, source] of FILES) {
		const lines = stripComments(source.split('\n'))
		for (const [i, line] of lines.entries()) yield [file, i + 1, line]
	}
}

/** Strip Tailwind variants (`hover:`, `focus-visible:`, `!`) off a class. */
const baseClass = (cls: string): { base: string; variants: string[] } => {
	const parts: string[] = []
	let depth = 0
	let start = 0
	for (let i = 0; i < cls.length; i++) {
		const ch = cls[i]
		if (ch === '[') depth++
		else if (ch === ']') depth--
		else if (ch === ':' && depth === 0) {
			parts.push(cls.slice(start, i))
			start = i + 1
		}
	}
	const base = cls.slice(start).replace(/^!/, '')
	return { base: base.replace(/^-/, ''), variants: parts }
}

/** Class-ish tokens on a line: class attributes, :class bindings, class strings. */
const classesOn = (line: string): string[] => {
	const lists: string[] = []
	for (const m of line.matchAll(
		/(?:class|className)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
	)) {
		lists.push(m[1] ?? m[2] ?? '')
	}
	for (const m of line.matchAll(/:class\s*=\s*"([^"]*)"/g)) lists.push(m[1])
	for (const m of line.matchAll(/(['"`])((?:(?!\1)[^\\]|\\.)*)\1/g)) {
		if (
			/(^|\s)(bg|text|border|ring|rounded|outline|divide|fill|stroke|from|to|via|shadow|placeholder|accent|caret|decoration)-/.test(
				m[2]
			)
		) {
			lists.push(m[2])
		}
	}
	return [...new Set(lists)].flatMap((list) =>
		list.split(/[\s'"`]+/).filter((c) => c && c.length <= 120)
	)
}

describe('design tokens', () => {
	it('scans the source tree', () => {
		expect(FILES.length).toBeGreaterThan(100)
	})

	it('runs against the frappe-ui version package.json pins', () => {
		const pinned = readJSON(
			resolve(process.cwd(), 'package.json')
		).dependencies['frappe-ui']
		const installed = readJSON('package.json').version
		expect(`frappe-ui@${installed}`).toBe(`frappe-ui@${pinned}`)
	})

	it('uses no semantic token frappe-ui does not define', () => {
		const offenders: Offender[] = []
		for (const [file, line, text] of codeLines()) {
			for (const cls of classesOn(text)) {
				const { base } = baseClass(cls)
				const m = base.match(
					/^(?:[a-z]+)-((?:surface|ink|outline)(?:-alpha)?-[a-z0-9-]+)$/
				)
				if (m && !SEMANTIC_TOKENS.has(m[1])) {
					offenders.push(at(file, line, `${cls} — no such token`))
				}
			}
			for (const m of text.matchAll(
				/var\(\s*--((?:surface|ink|outline)(?:-alpha)?-[a-z0-9-]+)\s*[,)]/g
			)) {
				if (!SEMANTIC_TOKENS.has(m[1])) {
					offenders.push(at(file, line, `var(--${m[1]}) — no such token`))
				}
			}
		}
		expect(offenders).toEqual([])
	})

	it('uses no raw palette colour', () => {
		const families = RAW_FAMILIES.join('|')
		const offenders: Offender[] = []
		for (const [file, line, text] of codeLines()) {
			for (const cls of classesOn(text)) {
				const { base } = baseClass(cls)
				for (const util of COLOR_UTILITIES) {
					if (!base.startsWith(`${util}-`)) continue
					const rest = base.slice(util.length + 1)
					if (new RegExp(`^(?:${families})-\\d{1,3}(?:/\\d+)?$`).test(rest)) {
						offenders.push(
							at(file, line, `${cls} — light-mode primitive, never flips`)
						)
					}
					if (/^dark-/.test(rest)) {
						offenders.push(at(file, line, `${cls} — dark-* primitive`))
					}
				}
			}
		}
		expect(offenders).toEqual([])
	})

	/**
	 * `text-white` is deliberately not here: frappe-ui's own Badge pairs it with
	 * `bg-surface-<colour>-7`, and that solid step stays dark enough in both
	 * themes for white ink. A surface, border or ring is different — there the
	 * literal is the thing that should have flipped. Scrims over video and cover
	 * art go through `black-overlay-*`, which carries the opacity as a token.
	 */
	it('paints no surface, border or ring with literal black or white', () => {
		const banned = /^(bg|border|ring|divide|outline)-(white|black)(\/\d+)?$/
		const offenders: Offender[] = []
		for (const [file, line, text] of codeLines()) {
			for (const cls of classesOn(text)) {
				if (banned.test(baseClass(cls).base)) {
					offenders.push(at(file, line, `${cls} — theme-blind`))
				}
			}
		}
		expect(offenders).toEqual([])
	})

	it('uses no raw primitive CSS variable', () => {
		const families = RAW_FAMILIES.join('|')
		const pattern = new RegExp(
			`var\\(\\s*--((?:${families})-\\d{1,3}|white|black)\\s*[,)]`,
			'g'
		)
		const offenders: Offender[] = []
		for (const [file, line, text] of codeLines()) {
			for (const m of text.matchAll(pattern)) {
				const undeclared = m[1] === 'white' || m[1] === 'black'
				offenders.push(
					at(
						file,
						line,
						`var(--${m[1]}) — ${
							undeclared
								? 'frappe-ui never declares it; the fallback always wins'
								: 'declared on :root only, not for dark'
						}`
					)
				)
			}
		}
		expect(offenders).toEqual([])
	})

	it('uses no literal colour value', () => {
		const hex = /#(?:[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?|[0-9a-fA-F]{3})(?![0-9a-zA-Z-])/g
		const fn = /\b(?:rgba?|hsla?)\(\s*[\d.]/g
		const offenders: Offender[] = []
		for (const [file, line, text] of codeLines()) {
			if (file in LITERAL_ALLOWLIST) continue
			for (const m of text.matchAll(hex)) {
				offenders.push(at(file, line, `${m[0]} — literal colour`))
			}
			for (const m of text.matchAll(fn)) {
				offenders.push(at(file, line, `${m[0].trim()}…) — literal colour`))
			}
		}
		expect(offenders).toEqual([])
	})

	it('allowlists only files that still exist', () => {
		const scanned = new Set(FILES.map(([file]) => file))
		const stale = Object.keys(LITERAL_ALLOWLIST).filter(
			(file) => !scanned.has(file)
		)
		expect(stale).toEqual([])
	})

	it('uses no radius alias removed in 1.0.0', () => {
		const offenders: Offender[] = []
		for (const [file, line, text] of codeLines()) {
			for (const cls of classesOn(text)) {
				const { base } = baseClass(cls)
				if (base in DEAD_RADIUS) {
					offenders.push(
						at(file, line, `${cls} — use ${DEAD_RADIUS[base]}`)
					)
				}
			}
		}
		expect(offenders).toEqual([])
	})

	it('styles no native radio or checkbox', () => {
		const offenders: Offender[] = []
		for (const [file, source] of FILES) {
			const lines = stripComments(source.split('\n'))
			for (const [i, line] of lines.entries()) {
				if (!/type\s*=\s*["']?(?:radio|checkbox)["']?/.test(line)) continue
				const opened = lines
					.slice(Math.max(0, i - 4), i + 1)
					.join(' ')
					.includes('<input')
				if (opened) {
					offenders.push(
						at(
							file,
							i + 1,
							'native control — @tailwindcss/forms hardcodes #fff and ' +
								'frappe-ui ships no dark rule for radio; use Radio/Checkbox'
						)
					)
				}
			}
		}
		expect(offenders).toEqual([])
	})

	it('needs no dark: variant', () => {
		const offenders: Offender[] = []
		for (const [file, line, text] of codeLines()) {
			for (const cls of classesOn(text)) {
				if (baseClass(cls).variants.includes('dark')) {
					offenders.push(
						at(file, line, `${cls} — espresso tokens already flip`)
					)
				}
			}
		}
		expect(offenders).toEqual([])
	})

	/**
	 * `--ink-base` is the ink for inverted surfaces: in light mode it is
	 * oklch(1 0 0), the exact value of `--surface-base`. The -1..-4 steps of a
	 * colour surface are pale tints, so white ink on one lands around 1.1:1.
	 * Dark mode inverts the ink to oklch(.205) but those surfaces only reach
	 * oklch(.33), so it stays bad. frappe-ui's own pairings are the reference
	 * (Badge.vue): solid is `text-white` on `bg-surface-<colour>-7`, subtle is
	 * `text-ink-<colour>-7` on `bg-surface-<colour>-2`.
	 */
	it('never puts ink-base on a tinted surface', () => {
		const tint = /bg-surface-(?!gray-(?:9|10))[a-z]+-[1-4]\b/
		const offenders: Offender[] = []
		for (const [file, line, text] of codeLines()) {
			if (text.includes('text-ink-base') && tint.test(text)) {
				offenders.push(at(file, line, 'ink-base on a tint step'))
			}
		}
		expect(offenders).toEqual([])
	})
})
