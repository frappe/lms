import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// index.css overrides frappe-ui's near-invisible --ink-gray-2 bullets. Assert
// the resolved bullet color clears a contrast floor, using the committed tokens.

const cwd = process.cwd()
const css = readFileSync(resolve(cwd, 'src/index.css'), 'utf8')
const tokens = JSON.parse(
	readFileSync(resolve(cwd, 'src/utils/frappe-ui-colors.json'), 'utf8')
)

// Resolve a token ref like "lightMode/gray/300" to its hex.
function resolveRef(ref: string): string {
	return ref.split('/').reduce((node, part) => node[part], tokens)
}

// --ink-gray-N -> hex for a theme, via the themed-variable indirection.
function inkHex(grayKey: string, theme: 'light' | 'dark'): string {
	return resolveRef(tokens.themedVariables[theme].ink[grayKey])
}

function surfaceHex(theme: 'light' | 'dark'): string {
	return resolveRef(tokens.themedVariables[theme].surface.base)
}

function relativeLuminance(hex: string): number {
	const channels = hex
		.replace('#', '')
		.match(/.{2}/g)!
		.map((pair) => {
			const c = parseInt(pair, 16) / 255
			return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
		})
	const [r, g, b] = channels
	return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(a: string, b: string): number {
	const la = relativeLuminance(a)
	const lb = relativeLuminance(b)
	const [hi, lo] = la > lb ? [la, lb] : [lb, la]
	return (hi + 0.05) / (lo + 0.05)
}

// Pull the --ink-gray-N token the .prose override pins bullets to.
function overriddenBulletGrayKey(): string | null {
	const block = css.match(/\.prose\s*\{[^}]*\}/)
	if (!block) return null
	const decl = block[0].match(/--tw-prose-bullets:\s*var\(--ink-(gray-\d+)\)/)
	return decl ? decl[1] : null
}

describe('prose unordered-list bullet visibility', () => {
	it('overrides the faint frappe-ui --tw-prose-bullets token in .prose', () => {
		const grayKey = overriddenBulletGrayKey()
		expect(
			grayKey,
			'expected a .prose rule pinning --tw-prose-bullets to an --ink-gray-* token'
		).not.toBeNull()
		// must not stay on the invisible default
		expect(grayKey).not.toBe('gray-2')
	})

	it.each(['light', 'dark'] as const)(
		'renders bullets with legible contrast against the %s surface',
		(theme) => {
			const grayKey = overriddenBulletGrayKey()
			if (grayKey === null) {
				expect(
					grayKey,
					'no .prose --tw-prose-bullets override found'
				).not.toBeNull()
				return
			}
			const bulletContrast = contrastRatio(
				inkHex(grayKey, theme),
				surfaceHex(theme)
			)
			const brokenContrast = contrastRatio(
				inkHex('gray-2', theme),
				surfaceHex(theme)
			)

			// well above the broken ~1.3:1 baseline
			expect(bulletContrast).toBeGreaterThanOrEqual(2.5)
			expect(bulletContrast).toBeGreaterThan(brokenContrast * 2)
		}
	)
})
