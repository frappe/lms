import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

// frappe-ui's token migration v2 renamed a set of colour tokens away. The old
// names still read as plausible Tailwind classes, so `bg-surface-white` looks
// right in markup and compiles to nothing — the element simply has no
// background. This is the same failure mode as the `standalone:pb-4` variant
// that safeAreaUtilities.test.ts guards, and it reached main four times.
//
// Only the *pure* renames are detectable by name. The migration also shifted
// numeric ramps (`surface-gray-5` → `surface-gray-8`), but there both the old
// and the new name are valid v2 classes, so a shifted token silently renders
// the wrong shade rather than nothing, and no name-based check can see it.
//
// Source of truth: node_modules/frappe-ui/tailwind/migrate-tokens-v2.js —
// SURFACE_RENAMES / INK_RENAMES / OUTLINE_RENAMES and the PRE_MIGRATION_TOKENS
// sentinel list. That module exports COLOR_TOKEN_RENAMES but not the sentinel
// list, and its map mixes pure renames with the undetectable numeric shifts, so
// the pure set is restated here.
const REMOVED_TOKENS: Record<string, string> = {
	'surface-white': 'surface-base',
	'ink-white': 'ink-base',
	'outline-white': 'outline-base',
	'surface-menu-bar': 'surface-sidebar',
	'surface-card': 'surface-elevation-1',
	'surface-cards': 'surface-elevation-1',
	'surface-modal': 'surface-elevation-2',
	'surface-selected': 'surface-elevation-3',
	'surface-gray-2-contrast': 'surface-elevation-3',
	'outline-gray-modal': 'outline-elevation-2',
	'outline-gray-modals': 'outline-elevation-2',
}

const SRC = resolve(process.cwd(), 'src')
const EXTENSIONS = ['.vue', '.ts', '.js']

const sourceFiles = (dir: string): string[] => {
	const found: string[] = []
	for (const entry of readdirSync(dir)) {
		if (entry === 'node_modules' || entry === 'tests') continue
		const path = join(dir, entry)
		if (statSync(path).isDirectory()) {
			found.push(...sourceFiles(path))
		} else if (EXTENSIONS.some((extension) => entry.endsWith(extension))) {
			found.push(path)
		}
	}
	return found
}

// Matches the token only where it is used as a colour class — preceded by a
// utility prefix and a dash, and not followed by another name character, so
// `surface-gray-2` does not match inside `surface-gray-2-contrast`.
const usageRegex = (token: string): RegExp =>
	new RegExp(
		`(?:bg|text|border|ring|divide|fill|stroke)-${token}(?![a-zA-Z0-9-])`
	)

describe('design tokens removed by frappe-ui migration v2', () => {
	const files = sourceFiles(SRC)

	it('finds source files to scan', () => {
		expect(files.length).toBeGreaterThan(100)
	})

	for (const [removed, replacement] of Object.entries(REMOVED_TOKENS)) {
		it(`does not use \`${removed}\` (renamed to \`${replacement}\`)`, () => {
			const offenders = files
				.filter((file) => usageRegex(removed).test(readFileSync(file, 'utf8')))
				.map((file) => relative(SRC, file))

			expect(offenders).toEqual([])
		})
	}
})

// Radius aliases were removed in 1.0.0 (ADR-0006): the preset replaces
// Tailwind's own radius scale, so `rounded-md` etc. now emit no CSS at all —
// the same silent-failure shape as the colour renames above.
//
// Source of truth: node_modules/frappe-ui/tailwind/migrate-tokens-v2.js —
// RADIUS_STEP_BY_ALIAS / RADIUS_BARE_STEP / RADIUS_SIDES.
//
// The bare, side-less `rounded` is plain English (it shows up in prose and
// comments), so it is deliberately left out of this name-based check — a
// false positive there would make the suite unreliable. It is covered by a
// manual grep during the radius migration instead.
const RADIUS_STEP_BY_ALIAS: Record<string, string> = {
	sm: '1',
	md: '5',
	lg: '6',
	xl: '7',
	'2xl': '8',
}
const RADIUS_SIDES = ['t', 'r', 'b', 'l', 'tl', 'tr', 'br', 'bl', 's', 'e', 'ss', 'se', 'es', 'ee']

const REMOVED_RADIUS_ALIASES: Record<string, string> = {}
for (const side of RADIUS_SIDES) {
	REMOVED_RADIUS_ALIASES[`rounded-${side}`] = `rounded-${side}-4`
}
for (const side of ['', ...RADIUS_SIDES.map((s) => `-${s}`)]) {
	for (const [alias, step] of Object.entries(RADIUS_STEP_BY_ALIAS)) {
		REMOVED_RADIUS_ALIASES[`rounded${side}-${alias}`] = `rounded${side}-${step}`
	}
}

// Radius alias tokens are whole class names (no colour-style prefix), so the
// match only needs word-like boundaries on both sides.
const radiusUsageRegex = (token: string): RegExp =>
	new RegExp(`(?<![a-zA-Z0-9-])${token}(?![a-zA-Z0-9-])`)

describe('radius aliases removed by frappe-ui migration v2', () => {
	const files = sourceFiles(SRC)

	for (const [removed, replacement] of Object.entries(REMOVED_RADIUS_ALIASES)) {
		it(`does not use \`${removed}\` (renamed to \`${replacement}\`)`, () => {
			const offenders = files
				.filter((file) => radiusUsageRegex(removed).test(readFileSync(file, 'utf8')))
				.map((file) => relative(SRC, file))

			expect(offenders).toEqual([])
		})
	}
})
