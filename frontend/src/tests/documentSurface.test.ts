import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postcss from 'postcss'
// frappe-ui's own token export, so the expected colours come from the same
// source the stylesheet is generated from rather than being restated here.
import colors from '../../node_modules/frappe-ui/tailwind/generated/colors.json'

// The bug this guards: nothing painted the document. frappe-ui declares the
// theme variables but sets no background on html or body, and every app layout
// except MobileLayout happened to carry `bg-surface-base` on its own <main>. So
// with `data-theme="dark"` the canvas stayed the user agent's white, and on a
// phone that white filled the whole content area under near-white text.
//
// A class-name test would have passed against that bug happily — the classes in
// the markup were all real and all compiled. So this suite resolves the actual
// colour: it parses the shipped index.css for the declaration that paints the
// document, then substitutes the theme variable with the hex frappe-ui's token
// data gives it under each theme, and asserts on the result.
//
// It deliberately asserts on the *document* rather than on any component. A
// background on one more <main> would repaint that one screen and leave the
// overscroll gutter, short pages, and the next unpainted layout white.

const ROOT = resolve(__dirname, '../..')

const themeVariables = (theme: 'light' | 'dark'): Record<string, string> => {
	const themed = (colors as any).themedVariables[theme]
	const out: Record<string, string> = {}
	for (const [group, tokens] of Object.entries(
		themed as Record<string, Record<string, string>>
	)) {
		for (const [name, reference] of Object.entries(tokens)) {
			// References look like "darkMode/gray/950" or "neutral/white".
			const resolved = reference
				.split('/')
				.reduce<any>((node, key) => (node == null ? node : node[key]), colors)
			if (typeof resolved === 'string') out[`--${group}-${name}`] = resolved
		}
	}
	return out
}

// Walks index.css for a rule that paints the document element, and returns its
// background-color value. `html`, `:root` and `body` all paint the canvas.
const documentBackground = (): string | undefined => {
	const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf8')
	let value: string | undefined
	postcss.parse(css).walkRules((rule) => {
		const paintsDocument = rule.selectors.some((selector) =>
			['html', ':root', 'body'].includes(selector.trim())
		)
		if (!paintsDocument) return
		rule.walkDecls('background-color', (decl) => {
			value = decl.value
		})
	})
	return value
}

const documentColorScheme = (selector: string): string | undefined => {
	const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf8')
	let value: string | undefined
	postcss.parse(css).walkRules((rule) => {
		if (!rule.selectors.some((s) => s.trim() === selector)) return
		rule.walkDecls('color-scheme', (decl) => {
			value = decl.value
		})
	})
	return value
}

const resolveColour = (
	value: string,
	variables: Record<string, string>
): string => value.replace(/var\((--[\w-]+)\)/g, (_, name) => variables[name])

const luma = (hex: string): number => {
	const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
	return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

describe('the document surface follows the chosen theme', () => {
	it('paints the document from a theme variable, not a fixed colour', () => {
		const background = documentBackground()

		expect(background).toBeDefined()
		expect(background).toMatch(/^var\(--[\w-]+\)$/)
	})

	it('resolves to white in light mode and near-black in dark mode', () => {
		const background = documentBackground() as string

		const light = resolveColour(background, themeVariables('light'))
		const dark = resolveColour(background, themeVariables('dark'))

		expect(light).toBe('#ffffff')
		expect(dark).toBe('#171717')
		expect(luma(dark)).toBeLessThan(60)
	})

	// The ink the app writes on that surface is near-white in dark mode, so a
	// white canvas put it at roughly 1.03:1 — the measured symptom.
	it('clears WCAG AA against the ink the app writes on it', () => {
		const dark = themeVariables('dark')
		const background = resolveColour(documentBackground() as string, dark)

		const relative = (hex: string): number => {
			const channels = [1, 3, 5]
				.map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
				.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
			return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
		}
		const ink = dark['--ink-gray-9']
		const contrast = (relative(ink) + 0.05) / (relative(background) + 0.05)

		expect(contrast).toBeGreaterThan(4.5)
	})

	// Without this the browser keeps drawing scrollbars, form controls and the
	// overscroll gutter from the OS preference, which the tri-state colour mode
	// lets the user disagree with.
	it('declares a colour-scheme on both themes', () => {
		expect(documentColorScheme('html')).toBe('light')
		expect(documentColorScheme("[data-theme='dark']")).toBe('dark')
	})
})
