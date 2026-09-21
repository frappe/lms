/**
 * Source scanning for the design-token gate. Mechanism only; the rules that
 * use it live in `designTokens.test.ts`.
 */

// Imported, not read off disk: this project ships no @types/node, so `node:fs`
// and `process` would each cost a type error.
import appPackage from '../../../package.json'
import frappeUiPackage from '../../../node_modules/frappe-ui/package.json'
import colors from '../../../node_modules/frappe-ui/tailwind/generated/colors.json'

export const PINNED_FRAPPE_UI = appPackage.dependencies['frappe-ui']
export const INSTALLED_FRAPPE_UI = frappeUiPackage.version

/** Every name that resolves to a themed CSS variable. */
export const SEMANTIC_TOKENS = new Set<string>(
	Object.entries(colors.themedVariables.light).flatMap(([category, tokens]) =>
		Object.keys(tokens as object).map((name) => `${category}-${name}`)
	)
)

/** The primitive ramps: registered as Tailwind colours, declared on `:root` only. */
export const RAW_FAMILIES = Object.keys(colors.lightMode).filter(
	(family) => !family.endsWith('-alpha')
)

export const COLOR_UTILITIES = [
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

export const DEAD_RADIUS: Record<string, string> = {}
for (const side of RADIUS_SIDES) {
	DEAD_RADIUS[`rounded-${side}`] = `rounded-${side}-4`
}
for (const side of ['', ...RADIUS_SIDES.map((s) => `-${s}`)]) {
	for (const [alias, step] of Object.entries(RADIUS_ALIAS_STEP)) {
		DEAD_RADIUS[`rounded${side}-${alias}`] = `rounded${side}-${step}`
	}
}

export const EXEMPT_LINE = /token-exempt:\s*\S/
export const EXEMPT_START = /token-exempt-start:\s*\S/
export const EXEMPT_END = /token-exempt-end\b/

const sources = import.meta.glob('../../**/*.{vue,ts,js,css}', {
	query: '?raw',
	import: 'default',
	eager: true,
}) as Record<string, string>

// Keys are relative to this file, so everything under `src/` arrives as
// `../../<path>` while `src/tests` — which holds offending strings as fixtures
// — arrives as `../<name>` or `./<name>` and is excluded by the same prefix.
export const FILES = Object.entries(sources)
	.filter(([path]) => path.startsWith('../../'))
	.map(([path, source]) => [path.slice('../../'.length), source] as const)

/**
 * Blank out comment regions, preserving line numbers, so a hex quoted in prose
 * ("EditorJS defaults to #fff") is not read as a live value.
 */
export const stripComments = (lines: string[]): string[] => {
	let inBlock = false
	let inHtml = false
	return lines.map((raw) => {
		let out = ''
		let i = 0
		while (i < raw.length) {
			if (inBlock || inHtml) {
				const close = inBlock ? '*/' : '-->'
				const end = raw.indexOf(close, i)
				const stop = end === -1 ? raw.length : end + close.length
				out += ' '.repeat(stop - i)
				i = stop
				if (end !== -1) {
					inBlock = false
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

export type ScannedLine = {
	file: string
	line: number
	/** The line with comments blanked. */
	code: string
	exempt: boolean
}

/**
 * Every line of every scanned file. A `token-exempt:` marker covers its own
 * line and the next, so a value that cannot carry a trailing comment — inside
 * an HTML tag, say — can still be annotated from above.
 */
export function* codeLines(): Generator<ScannedLine> {
	for (const [file, source] of FILES) {
		const raw = source.split('\n')
		const code = stripComments(raw)
		let inRegion = false
		let carried = false
		for (const [i, line] of code.entries()) {
			if (EXEMPT_START.test(raw[i])) inRegion = true
			const marked = EXEMPT_LINE.test(raw[i])
			const exempt = inRegion || marked || carried
			carried = marked
			if (EXEMPT_END.test(raw[i])) inRegion = false
			yield { file, line: i + 1, code: line, exempt }
		}
	}
}

export const at = (file: string, line: number, detail: string) =>
	`${file}:${line} — ${detail}`

/** Strip Tailwind variants (`hover:`, `focus-visible:`, `!`) off a class. */
export const baseClass = (cls: string) => {
	const variants: string[] = []
	let depth = 0
	let start = 0
	for (let i = 0; i < cls.length; i++) {
		const ch = cls[i]
		if (ch === '[') depth++
		else if (ch === ']') depth--
		else if (ch === ':' && depth === 0) {
			variants.push(cls.slice(start, i))
			start = i + 1
		}
	}
	const base = cls.slice(start).replace(/^!/, '').replace(/^-/, '')
	return { base, variants }
}

// Any run of variants may precede the utility, so a string that is only ever
// `dark:sm:hover:bg-...` is still recognised as a class list.
const CLASS_LIKE =
	/(^|\s)(?:[a-z0-9-]+:)*(bg|text|border|ring|rounded|outline|divide|fill|stroke|from|to|via|shadow|placeholder|accent|caret|decoration)-/

/** Class-ish tokens on a line: class attributes, `:class` bindings, class strings. */
export const classesOn = (line: string): string[] => {
	const lists: string[] = []
	for (const m of line.matchAll(
		/(?:class|className)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
	)) {
		lists.push(m[1] ?? m[2] ?? '')
	}
	for (const m of line.matchAll(/:class\s*=\s*"([^"]*)"/g)) lists.push(m[1])
	for (const m of line.matchAll(/(['"`])((?:(?!\1)[^\\]|\\.)*)\1/g)) {
		if (CLASS_LIKE.test(m[2])) lists.push(m[2])
	}
	return [...new Set(lists)].flatMap((list) =>
		list.split(/[\s'"`]+/).filter((c) => c && c.length <= 120)
	)
}
