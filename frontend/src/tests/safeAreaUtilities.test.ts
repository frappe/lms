import { describe, expect, it } from 'vitest'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import { safeAreaPlugin } from '../../tailwind/safeArea.js'

// The bug these utilities replace was `standalone:pb-4` — a class that read
// correctly in the markup and compiled to nothing, because `standalone:` is not
// a registered variant here or in the frappe-ui preset. A test asserting on
// markup would have passed against that bug just as happily, so this suite
// compiles the plugin and asserts on emitted CSS instead.
//
// The plugin is exercised on its own rather than through tailwind.config.js:
// the frappe-ui preset imports `tailwindcss/plugin` without a file extension,
// which vitest's ESM resolver rejects. That the preset registers no
// `standalone:` variant was verified separately by compiling the real config
// through the tailwind CLI.
const compile = async (markup: string): Promise<string> => {
	const result = await postcss([
		tailwindcss({
			content: [{ raw: markup, extension: 'html' }],
			plugins: [safeAreaPlugin],
		}),
	]).process('@tailwind utilities;', { from: undefined })
	return result.css
}

describe('safe-area padding utilities', () => {
	it('emits the larger of the designed padding and the device inset', async () => {
		const css = await compile('<div class="pb-safe-3"></div>')

		expect(css).toContain(
			'padding-bottom: max(0.75rem, env(safe-area-inset-bottom))'
		)
	})

	it('scales off the spacing scale rather than a fixed value', async () => {
		const css = await compile('<div class="pb-safe-4 pt-safe-2"></div>')

		expect(css).toContain(
			'padding-bottom: max(1rem, env(safe-area-inset-bottom))'
		)
		expect(css).toContain('padding-top: max(0.5rem, env(safe-area-inset-top))')
	})

	it('emits a bare inset at spacing 0, for a bar with no designed padding', async () => {
		const css = await compile('<div class="pb-safe-0"></div>')

		expect(css).toContain(
			'padding-bottom: max(0px, env(safe-area-inset-bottom))'
		)
	})

	// start/end are deliberately absent — `safe-area-inset-left` is physical, so
	// a logical `ps-safe` would be wrong under RTL and a physical one would trip
	// the RTL semgrep rule.
	it('generates no inline-axis variants', async () => {
		const css = await compile(
			'<div class="ps-safe-3 pe-safe-3 pl-safe-3"></div>'
		)

		expect(css).not.toContain('safe-area-inset-left')
		expect(css).not.toContain('safe-area-inset-right')
	})
})
