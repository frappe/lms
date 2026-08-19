import { describe, expect, it } from 'vitest'
import { globSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postcss from 'postcss'

// The frame used to be a TypeScript constant, so a stale or misspelled
// reference failed the build. As a class name nothing checks it: one typo in
// one of the four call sites yields an unstyled header, and in SkeletonLoader
// that is how the skeleton came to stand 56px tall against a 48px header,
// jumping every detail page 8px when its data landed.

const ROOT = resolve(__dirname, '../..')

const WEARERS = [
	'src/components/Layouts/PageHeader.vue',
	'src/components/Layouts/MobilePageLayout.vue',
	'src/components/FormShell.vue',
	'src/components/SkeletonLoader.vue',
]

const frameRule = (): postcss.Rule | undefined => {
	const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf8')
	let found: postcss.Rule | undefined
	postcss.parse(css).walkRules((rule) => {
		if (rule.selectors.some((s) => s.trim() === '.header-frame')) found = rule
	})
	return found
}

describe('the shared header frame', () => {
	it('is defined once, in the stylesheet', () => {
		expect(frameRule()).toBeDefined()
	})

	it('sets the 48px floor the skeleton is measured against', () => {
		const applied = frameRule()?.nodes.find(
			(node): node is postcss.AtRule =>
				node.type === 'atrule' && node.name === 'apply'
		)
		const minHeight = frameRule()?.nodes.find(
			(node): node is postcss.Declaration =>
				node.type === 'decl' && node.prop === 'min-height'
		)

		// The number left @apply so the scroll containers can clear the same
		// value; a Tailwind class cannot be read from CSS.
		expect(minHeight?.value).toBe('var(--header-frame-h)')
		expect(applied?.params).not.toContain('min-h-12')
	})

	// The sticky header hid whatever Shift+Tab landed on, because the browser
	// top-aligns a focused element into the scrollport. WCAG 2.4.11. The height
	// has to come from one place or the two can drift apart again — which is the
	// bug SkeletonLoader's docblock already records once.
	describe('the scroll padding that clears it', () => {
		const declaredOnce = (): number => {
			const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf8')
			let count = 0
			postcss.parse(css).walkDecls('--header-frame-h', () => count++)
			return count
		}

		const paddingRule = (): postcss.Rule | undefined => {
			const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf8')
			let found: postcss.Rule | undefined
			postcss.parse(css).walkRules((rule) => {
				if (
					rule.nodes.some(
						(node) =>
							node.type === 'decl' && node.prop === 'scroll-padding-block-start'
					)
				)
					found = rule
			})
			return found
		}

		it('takes its value from the single source', () => {
			expect(declaredOnce()).toBe(1)
			const decl = paddingRule()?.nodes.find(
				(node): node is postcss.Declaration =>
					node.type === 'decl' && node.prop === 'scroll-padding-block-start'
			)
			expect(decl?.value).toBe('var(--header-frame-h)')
		})

		it('covers every scroll container the layouts declare', () => {
			const selectors = paddingRule()?.selectors ?? []
			const layouts = globSync('src/components/Layouts/*.vue', { cwd: ROOT })
			expect(layouts.length).toBeGreaterThan(0)

			const ids = new Set<string>()
			for (const path of layouts) {
				const source = readFileSync(resolve(ROOT, path), 'utf8')
				for (const [, id] of source.matchAll(/\bid="(scrollContainer)"/g))
					ids.add(id)
				for (const [, id] of source.matchAll(/\bid="(main-content)"/g))
					ids.add(id)
			}
			expect(ids.size).toBeGreaterThan(0)

			for (const id of ids)
				expect(
					selectors.some((s) => s.includes(`#${id}`)),
					`#${id} has no scroll padding`
				).toBe(true)
		})

		// Re-hardcoding the number in a component is the drift this exists to
		// stop; the whole point is that 48px lives in exactly one place.
		it('is not restated as a utility class in any component', () => {
			const files = globSync('src/**/*.vue', { cwd: ROOT })
			expect(files.length).toBeGreaterThan(0)

			for (const path of files) {
				const source = readFileSync(resolve(ROOT, path), 'utf8')
				expect(source, `${path} hardcodes scroll padding`).not.toMatch(
					/\bscroll-pt-/
				)
			}
		})
	})

	it('is worn by every header that draws it', () => {
		for (const path of WEARERS) {
			const source = readFileSync(resolve(ROOT, path), 'utf8')
			expect(source, `${path} does not wear .header-frame`).toMatch(
				/class="header-frame\b/
			)
		}
	})

	// A header that restates the frame inline has stopped sharing it, which is
	// the drift this file exists to catch.
	it('is not hand-copied by any of them', () => {
		for (const path of WEARERS) {
			const source = readFileSync(resolve(ROOT, path), 'utf8')
			const restated = /min-h-12[^"]*border-b|border-b[^"]*min-h-12/.test(
				source
			)

			expect(restated, `${path} restates the frame inline`).toBe(false)
		}
	})
})
