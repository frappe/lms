/**
 * Only `surface-*`, `ink-*` and `outline-*` flip under `[data-theme='dark']`;
 * a primitive, `var(--gray-N)`, `theme('colors.*')` or a hex paints the light
 * value into both themes. Vocabulary comes from the installed frappe-ui.
 */
import { describe, expect, it } from 'vitest'
import {
	at,
	baseClass,
	classesOn,
	codeLines,
	COLOR_UTILITIES,
	DEAD_RADIUS,
	EXEMPT_END,
	EXEMPT_START,
	FILES,
	INSTALLED_FRAPPE_UI,
	PINNED_FRAPPE_UI,
	RAW_FAMILIES,
	SEMANTIC_TOKENS,
	stripComments,
} from './helpers/designTokens'

describe('design tokens', () => {
	it('scans the source tree', () => {
		expect(FILES.length).toBeGreaterThan(100)
	})

	// beta.69 dropped 22 tokens beta.24 still defines, so a stale node_modules
	// would quietly accept names CI rejects.
	it('runs against the frappe-ui version package.json pins', () => {
		expect(`frappe-ui@${INSTALLED_FRAPPE_UI}`).toBe(
			`frappe-ui@${PINNED_FRAPPE_UI}`
		)
	})

	it('uses no semantic token frappe-ui does not define', () => {
		const offenders: string[] = []
		const named = /^(?:[a-z]+)-((?:surface|ink|outline)(?:-alpha)?-[a-z0-9-]+)$/
		const asVar =
			/var\(\s*--((?:surface|ink|outline)(?:-alpha)?-[a-z0-9-]+)\s*[,)]/g
		for (const { file, line, code } of codeLines()) {
			for (const cls of classesOn(code)) {
				const m = baseClass(cls).base.match(named)
				if (m && !SEMANTIC_TOKENS.has(m[1])) {
					offenders.push(at(file, line, `${cls} — no such token`))
				}
			}
			for (const m of code.matchAll(asVar)) {
				if (!SEMANTIC_TOKENS.has(m[1])) {
					offenders.push(at(file, line, `var(--${m[1]}) — no such token`))
				}
			}
		}
		expect(offenders).toEqual([])
	})

	it('uses no raw palette colour', () => {
		const primitive = new RegExp(
			`^(?:${RAW_FAMILIES.join('|')})-\\d{1,3}(?:/\\d+)?$`
		)
		const offenders: string[] = []
		for (const { file, line, code } of codeLines()) {
			for (const cls of classesOn(code)) {
				const { base } = baseClass(cls)
				for (const util of COLOR_UTILITIES) {
					if (!base.startsWith(`${util}-`)) continue
					const rest = base.slice(util.length + 1)
					if (primitive.test(rest)) {
						offenders.push(at(file, line, `${cls} — never flips`))
					} else if (rest.startsWith('dark-')) {
						offenders.push(at(file, line, `${cls} — dark-* primitive`))
					}
				}
			}
		}
		expect(offenders).toEqual([])
	})

	// `--white` is never declared, so its fallback always wins; the ramps are
	// declared on `:root` and never redefined for dark.
	it('uses no raw primitive CSS variable', () => {
		const pattern = new RegExp(
			`var\\(\\s*--((?:${RAW_FAMILIES.join('|')})-\\d{1,3}|white|black)\\s*[,)]`,
			'g'
		)
		const offenders: string[] = []
		for (const { file, line, code } of codeLines()) {
			for (const m of code.matchAll(pattern)) {
				offenders.push(at(file, line, `var(--${m[1]}) — not themed`))
			}
		}
		expect(offenders).toEqual([])
	})

	// `theme()` resolves at build time, so this bakes in the light-mode
	// primitive just as surely as the hex would, while reading like a token.
	it('resolves no raw palette through theme()', () => {
		const pattern = new RegExp(
			`theme\\(\\s*['"\`]colors\\.((?:${RAW_FAMILIES.join('|')})\\.\\d{1,3}|white|black)`,
			'g'
		)
		const offenders: string[] = []
		for (const { file, line, code, exempt } of codeLines()) {
			if (exempt) continue
			for (const m of code.matchAll(pattern)) {
				offenders.push(at(file, line, `theme('colors.${m[1]}')`))
			}
		}
		expect(offenders).toEqual([])
	})

	it('uses no literal colour value', () => {
		const hex =
			/#(?:[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?|[0-9a-fA-F]{3})(?![0-9a-zA-Z-])/g
		const fn = /\b(?:rgba?|hsla?)\(\s*[\d.]/g
		const offenders: string[] = []
		for (const { file, line, code, exempt } of codeLines()) {
			if (exempt) continue
			for (const m of code.matchAll(hex)) {
				offenders.push(at(file, line, `${m[0]} — literal colour`))
			}
			for (const m of code.matchAll(fn)) {
				offenders.push(at(file, line, `${m[0].trim()}…) — literal colour`))
			}
		}
		expect(offenders).toEqual([])
	})

	// `text-white` is absent on purpose: frappe-ui's own Badge pairs it with
	// `bg-surface-<colour>-7`, and that solid step stays dark enough in both
	// themes. A surface, border or ring is where the literal should have flipped.
	it('paints no surface, border or ring with literal black or white', () => {
		const banned = /^(bg|border|ring|divide|outline)-(white|black)(\/\d+)?$/
		const offenders: string[] = []
		for (const { file, line, code } of codeLines()) {
			for (const cls of classesOn(code)) {
				if (banned.test(baseClass(cls).base)) {
					offenders.push(at(file, line, `${cls} — theme-blind`))
				}
			}
		}
		expect(offenders).toEqual([])
	})

	it('uses no radius alias removed in 1.0.0', () => {
		const offenders: string[] = []
		for (const { file, line, code } of codeLines()) {
			for (const cls of classesOn(code)) {
				const { base } = baseClass(cls)
				if (base in DEAD_RADIUS) {
					offenders.push(at(file, line, `${cls} — use ${DEAD_RADIUS[base]}`))
				}
			}
		}
		expect(offenders).toEqual([])
	})

	// A Vue template cannot carry a `token-exempt:` comment — one inside a tag
	// is invalid, one between elements renders into the DOM in dev — so the
	// remaining native control is named here, where adding to it shows in a diff.
	it('styles no native radio or checkbox', () => {
		const allowed: Record<string, string> = {
			'components/Quiz/QuestionAnswers.vue':
				'question editor; its dark-mode dot comes from the ' +
				"[data-theme='dark'] [type='radio']:checked rule in index.css",
		}
		const offenders: string[] = []
		for (const [file, source] of FILES) {
			if (file in allowed) continue
			const lines = stripComments(source.split('\n'))
			for (const [i, line] of lines.entries()) {
				if (!/type\s*=\s*["']?(?:radio|checkbox)["']?/.test(line)) continue
				const opened = lines
					.slice(Math.max(0, i - 4), i + 1)
					.join(' ')
					.includes('<input')
				if (opened) {
					offenders.push(at(file, i + 1, 'native control — use Radio/Checkbox'))
				}
			}
		}
		expect(offenders).toEqual([])
	})

	// Overlay ramps are alpha over whatever is behind them, so they hold no
	// theme and the right step genuinely differs — frappe-ui's own Dialog
	// backdrop is `bg-black-overlay-200 dark:bg-black-overlay-700`.
	it('needs no dark: variant on a themed token', () => {
		const offenders: string[] = []
		for (const { file, line, code, exempt } of codeLines()) {
			if (exempt) continue
			for (const cls of classesOn(code)) {
				const { base, variants } = baseClass(cls)
				if (!variants.includes('dark')) continue
				if (/-(?:black|white)-overlay-\d+$/.test(base)) continue
				offenders.push(at(file, line, `${cls} — the token already flips`))
			}
		}
		expect(offenders).toEqual([])
	})

	// `--ink-base` is the ink for inverted surfaces: in light mode it is the
	// exact value of `--surface-base`, so white ink on a `-1`..`-4` tint lands
	// around 1.1:1, and dark mode inverts the ink but not far enough.
	it('never puts ink-base on a tinted surface', () => {
		const tint = /bg-surface-(?!gray-(?:9|10))[a-z]+-[1-4]\b/
		const offenders: string[] = []
		for (const { file, line, code } of codeLines()) {
			if (code.includes('text-ink-base') && tint.test(code)) {
				offenders.push(at(file, line, 'ink-base on a tint step'))
			}
		}
		expect(offenders).toEqual([])
	})

	it('grants no exemption without a reason', () => {
		const offenders: string[] = []
		for (const [file, source] of FILES) {
			for (const [i, raw] of source.split('\n').entries()) {
				if (/token-exempt(-start)?:?\s*$/.test(raw)) {
					offenders.push(at(file, i + 1, 'token-exempt with no reason'))
				}
			}
		}
		expect(offenders).toEqual([])
	})

	it('closes every exempt region it opens', () => {
		const offenders: string[] = []
		for (const [file, source] of FILES) {
			let open: number | null = null
			for (const [i, raw] of source.split('\n').entries()) {
				if (EXEMPT_START.test(raw)) {
					if (open !== null) {
						offenders.push(at(file, i + 1, `region already open at ${open}`))
					}
					open = i + 1
				} else if (EXEMPT_END.test(raw)) {
					if (open === null) offenders.push(at(file, i + 1, 'end with no start'))
					open = null
				}
			}
			if (open !== null) offenders.push(at(file, open, 'region never closed'))
		}
		expect(offenders).toEqual([])
	})
})
