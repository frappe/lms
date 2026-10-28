// Guards template tags that were never imported, which Vue renders as nothing.
// Broke in #1593 (a `<Code>` tag with no editor under it on the submission).
// Added on feat/assessment-visual-redesign when nine such components were fixed.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const SRC = resolve(__dirname, '..')

const vueFiles = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name)
		if (entry.isDirectory()) return vueFiles(path)
		return entry.name.endsWith('.vue') ? [path] : []
	})

// Stricter than the frappe-ui vite plugin, which also auto-resolves
// src/components: every tag must be imported or listed here.
const BUILT_IN = new Set([
	'Transition',
	'TransitionGroup',
	'KeepAlive',
	'Teleport',
	'Suspense',
	'Component',
	'RouterView',
	'RouterLink',
])

const templateOf = (source: string): string => {
	const start = source.indexOf('<template>')
	if (start === -1) return ''
	const end = source.lastIndexOf('</template>')
	return end > start ? source.slice(start, end) : source.slice(start)
}

const scriptOf = (source: string): string => {
	const start = source.indexOf('<script')
	return start === -1 ? '' : source.slice(start)
}

const unresolvedIn = (file: string): string[] => {
	const source = readFileSync(file, 'utf8')
	const script = scriptOf(source)
	const tags = new Set(
		[...templateOf(source).matchAll(/<([A-Z][A-Za-z0-9]*)/g)].map((m) => m[1])
	)
	return [...tags].filter(
		(tag) =>
			!BUILT_IN.has(tag) &&
			!tag.startsWith('Lucide') &&
			// Imported by name, or as part of a braced import list.
			!new RegExp(`\\b${tag}\\b`).test(script)
	)
}

describe('every component a template uses can be resolved', () => {
	it('finds no tag that would silently render nothing', () => {
		const offenders: Record<string, string[]> = {}
		for (const file of vueFiles(SRC)) {
			const missing = unresolvedIn(file)
			if (missing.length) offenders[relative(SRC, file)] = missing
		}
		expect(offenders).toEqual({})
	})
})
