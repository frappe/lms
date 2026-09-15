import { afterEach, describe, expect, it, vi } from 'vitest'
import { openExternal } from '../utils/openExternal'

// window.open hands the opened page a window.opener reference back to ours unless
// 'noopener' is passed, and a javascript: URL passed to it runs in a document
// that inherits this origin. openExternal is the one place both are handled — the
// v-external argument, in JavaScript — and the scanner below is what keeps it
// the only place. Neither is markup, so no template gate could see them.

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

describe('openExternal', () => {
	const open = vi.spyOn(window, 'open').mockReturnValue(null)
	afterEach(() => open.mockClear())

	it('passes noopener so the opened page cannot reach window.opener', () => {
		openExternal('https://x.test/a')
		expect(open).toHaveBeenCalledWith('https://x.test/a', '_blank', 'noopener')
	})

	// window.open('javascript:…') runs that script in a document that inherits
	// this origin, so the allowlist matters as much here as in an href.
	it('opens nothing for a URL the allowlist rejects', () => {
		openExternal('javascript:alert(1)')
		openExternal('/\\evil.test')
		openExternal(null)
		expect(open).not.toHaveBeenCalled()
	})
})

describe('window.open is confined to the helper', () => {
	const OPEN = /\bwindow\.open\s*\(/

	it('finds sources to scan, and flags a bare call', () => {
		expect(app.length).toBeGreaterThan(200)
		expect(OPEN.test("window.open(url, '_blank')")).toBe(true)
	})

	it('finds no window.open outside openExternal', () => {
		const offenders: string[] = []
		for (const [path, src] of app) {
			if (path === '../utils/openExternal.ts') continue
			src.split('\n').forEach((line, i) => {
				if (LINE_COMMENT.test(line)) return
				if (OPEN.test(line)) offenders.push(`${path}:${i + 1} ${line.trim()}`)
			})
		}
		expect(offenders, offenders.join('\n')).toEqual([])
	})
})
