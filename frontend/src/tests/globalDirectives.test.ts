/**
 * A directive registered on the app is a name every template may use and a
 * module every bundle carries. One that no template uses is neither: it ships
 * as dead weight, and worse, it reads as the codebase's convention, so a
 * comment or a review can point at it as the way something is done while the
 * markup goes on doing that thing by hand.
 *
 * The scan is over the whole of `src`, not the directory a change happens to
 * touch, because a global directive is usable from anywhere.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const SRC = resolve(process.cwd(), 'src')
const MAIN = join(SRC, 'main.js')

const templateFiles = (dir: string): string[] => {
	const found: string[] = []
	for (const entry of readdirSync(dir)) {
		if (entry === 'node_modules' || entry === 'tests') continue
		const path = join(dir, entry)
		if (statSync(path).isDirectory()) found.push(...templateFiles(path))
		else if (entry.endsWith('.vue')) found.push(path)
	}
	return found
}

/** The names in `app.directive('x', …)`, which a template writes as `v-x`. */
const registeredDirectives = (source: string): string[] =>
	[...source.matchAll(/app\.directive\(\s*['"]([^'"]+)['"]/g)].map(
		(match) => match[1] ?? ''
	)

// `v-name`, allowing an argument (`v-name:arg`) or modifiers (`v-name.mod`) but
// not a longer name (`v-new-tab` must not match `v-new-tabs`).
const usageRegex = (name: string): RegExp =>
	new RegExp(`v-${name}(?![a-zA-Z0-9-])`)

describe('globally registered directives', () => {
	const main = readFileSync(MAIN, 'utf8')
	const files = templateFiles(SRC)

	it('reads main.js and the component tree it registers them for', () => {
		expect(main).toContain('createApp')
		expect(files.length).toBeGreaterThan(100)
	})

	it('registers none that no template uses', () => {
		const sources = files.map((file) => readFileSync(file, 'utf8'))
		const unused = registeredDirectives(main).filter(
			(name) => !sources.some((source) => usageRegex(name).test(source))
		)

		expect(unused).toEqual([])
	})
})
