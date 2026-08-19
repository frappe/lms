import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postcss from 'postcss'
import colors from '../../node_modules/frappe-ui/tailwind/generated/colors.json'

// The bug this guards: the document is painted from --surface-base, and that
// only resolves dark once <html data-theme="dark"> exists. Until this branch
// the attribute was set by src/utils/theme.ts, which cannot run before the app
// bundle executes. Measured on a production build at 390px with the bundle
// blocked — that is exactly the state the browser paints once the stylesheet
// arrives — the document came back srgb(255,255,255), and the bundle landed
// roughly 300ms after first paint (1.1s at 6x CPU throttle). Every cold load in
// dark mode therefore opened on a full-screen white flash.
//
// A test asserting that index.html contains a theme script would pass against a
// script that resolves the wrong value, or one placed after the stylesheet. So
// this suite runs the real bootstrap and then resolves the colour the document
// would actually be painted: it reads the background declaration out of
// index.css and substitutes the theme variable with the hex frappe-ui's own
// token data gives it under whichever theme the bootstrap chose.

const ROOT = resolve(__dirname, '../..')

const themeVariables = (theme: 'light' | 'dark'): Record<string, string> => {
	const themed = (colors as any).themedVariables[theme]
	const out: Record<string, string> = {}
	for (const [group, tokens] of Object.entries(
		themed as Record<string, Record<string, string>>
	)) {
		for (const [name, reference] of Object.entries(tokens)) {
			const resolved = reference
				.split('/')
				.reduce<any>((node, key) => (node == null ? node : node[key]), colors)
			if (typeof resolved === 'string') out[`--${group}-${name}`] = resolved
		}
	}
	return out
}

const documentBackground = (): string => {
	const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf8')
	let value: string | undefined
	postcss.parse(css).walkRules((rule) => {
		if (
			!rule.selectors.some((s) => ['html', ':root', 'body'].includes(s.trim()))
		)
			return
		rule.walkDecls('background-color', (decl) => {
			value = decl.value
		})
	})
	if (!value) throw new Error('index.css paints no document background')
	return value
}

// The colour the browser would paint the canvas under a given data-theme. An
// absent attribute is `null` — the untreated first-paint state.
const paintedDocument = (theme: string | null): string =>
	documentBackground().replace(
		/var\((--[\w-]+)\)/g,
		(_, name) => themeVariables(theme === 'dark' ? 'dark' : 'light')[name]
	)

const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8')

const bootstrapSource = (): string => {
	const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
		(match) => match[1]
	)
	const source = scripts.find((body) => body.includes('data-theme'))
	if (!source) throw new Error('index.html has no data-theme bootstrap')
	return source
}

type Scenario = {
	stored: Record<string, string>
	systemDark: boolean
}

const mediaQueryList = (query: string, systemDark: boolean) => ({
	matches: query.includes('dark') && systemDark,
	addEventListener: () => {},
	removeEventListener: () => {},
})

// Runs the real inline script against a stand-in document, and reports the
// data-theme it set — or null when it set none.
const runBootstrap = ({ stored, systemDark }: Scenario): string | null => {
	let attribute: string | null = null
	const documentStub = {
		documentElement: {
			setAttribute: (name: string, value: string) => {
				if (name === 'data-theme') attribute = value
			},
		},
	}
	const windowStub = {
		matchMedia: (query: string) => mediaQueryList(query, systemDark),
	}
	const storageStub = { getItem: (key: string) => stored[key] ?? null }
	new Function('window', 'document', 'localStorage', bootstrapSource())(
		windowStub,
		documentStub,
		storageStub
	)
	return attribute
}

// What src/utils/theme.ts resolves for the same inputs, imported fresh so its
// module-scope resolution re-runs.
const runComposable = async ({
	stored,
	systemDark,
}: Scenario): Promise<string> => {
	localStorage.clear()
	for (const [key, value] of Object.entries(stored))
		localStorage.setItem(key, value)
	vi.stubGlobal('matchMedia', (query: string) =>
		mediaQueryList(query, systemDark)
	)
	vi.resetModules()
	const module = await import('../utils/theme')
	return module.theme.value
}

afterEach(() => {
	vi.unstubAllGlobals()
	localStorage.clear()
	document.documentElement.removeAttribute('data-theme')
})

describe('the theme applied before first paint', () => {
	it('leaves the document white when nothing sets data-theme', () => {
		expect(paintedDocument(null)).toBe('#ffffff')
	})

	it('paints the canvas dark for a dark visitor with no stored preference', () => {
		const theme = runBootstrap({ stored: {}, systemDark: true })

		expect(theme).toBe('dark')
		expect(paintedDocument(theme)).toBe('#171717')
	})

	it('honours an explicit dark choice made on a light system', () => {
		const theme = runBootstrap({
			stored: { themePreference: 'dark' },
			systemDark: false,
		})

		expect(theme).toBe('dark')
		expect(paintedDocument(theme)).toBe('#171717')
	})

	it('honours an explicit light choice made on a dark system', () => {
		const theme = runBootstrap({
			stored: { themePreference: 'light' },
			systemDark: true,
		})

		expect(theme).toBe('light')
		expect(paintedDocument(theme)).toBe('#ffffff')
	})

	it('carries over the legacy single-key choice of an existing user', () => {
		const theme = runBootstrap({ stored: { theme: 'dark' }, systemDark: false })

		expect(theme).toBe('dark')
		expect(paintedDocument(theme)).toBe('#171717')
	})

	// The rules are stated twice — once inline, once in the composable — because
	// nothing that imports can run before the stylesheet paints. This is what
	// keeps the two copies from drifting.
	it('resolves exactly what src/utils/theme.ts resolves', async () => {
		const scenarios: Scenario[] = [
			{ stored: {}, systemDark: true },
			{ stored: {}, systemDark: false },
			{ stored: { themePreference: 'dark' }, systemDark: false },
			{ stored: { themePreference: 'light' }, systemDark: true },
			{ stored: { themePreference: 'system' }, systemDark: true },
			{ stored: { theme: 'dark' }, systemDark: false },
			{ stored: { theme: 'light' }, systemDark: true },
			{ stored: { themePreference: 'nonsense' }, systemDark: true },
		]

		for (const scenario of scenarios) {
			expect(runBootstrap(scenario)).toBe(await runComposable(scenario))
		}
	})

	// Placed in <head>, ahead of the stylesheet vite injects at the end of it, so
	// the attribute is already there when the first paint is unblocked.
	it('runs in the head, before anything that can paint', () => {
		const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'))

		expect(head).toContain(bootstrapSource())
	})
})
