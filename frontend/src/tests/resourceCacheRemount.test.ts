/**
 * Cached resources whose callbacks write to component-local state.
 *
 * frappe-ui's createResource / createListResource return the *previously
 * created* instance on a cache hit and, at most, call reload() on it — the new
 * component's `transform` / `onSuccess` closures are never attached
 * (node_modules/frappe-ui/src/resources/resources.js:9-20, listResource.js:15-22).
 *
 * That breaks whenever a callback writes to a ref that belongs to the
 * component: after a remount the reload runs the *dead* instance's closure, and
 * the live component's ref is never filled (issue #2559).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// tsconfig sets `types: []`, so node's globals aren't ambient here.
declare const process: { cwd(): string }
const SRC = join(process.cwd(), 'src')

/**
 * Pinned at the source level: the resources whose onSuccess writes to a
 * component ref must not declare `cache`.
 *
 * It proves less than a mount — it cannot catch a NEW resource growing the same
 * shape — but it does stop the specific regression of someone restoring these
 * four cache keys (a merge resolution, or "re-enable the offline cache") and
 * still seeing green.
 */
describe('resources that write component state declare no cache', () => {
	// [file, the option that identifies the resource inside that file]
	const GUARDED: ReadonlyArray<readonly [string, string]> = [
		[
			'components/Modals/VideoStatistics.vue',
			"doctype: 'LMS Video Watch Duration'",
		],
		['pages/Lesson.vue', "doctype: 'LMS Lesson Note'"],
		['pages/Forms/ProgramForm.vue', "doctype: 'LMS Program Course'"],
	]

	/** The createResource/createListResource call enclosing `marker`. */
	const resourceBlock = (source: string, marker: string): string => {
		const at = source.indexOf(marker)
		expect(at, `${marker} not found`).toBeGreaterThan(-1)
		// The NEAREST preceding call of either kind. Preferring createListResource
		// outright would walk past a closer createResource — in a file holding
		// both, the block returned would be a different resource's, and the
		// assertion below would pass without ever looking at the guarded one.
		const start = Math.max(
			source.lastIndexOf('createListResource(', at),
			source.lastIndexOf('createResource(', at)
		)
		expect(start, `no createResource call before ${marker}`).toBeGreaterThan(-1)
		let depth = 0
		for (let i = source.indexOf('(', start); i < source.length; i++) {
			if (source[i] === '(') depth++
			else if (source[i] === ')' && --depth === 0)
				return source.slice(start, i + 1)
		}
		throw new Error(`unbalanced parentheses after ${marker}`)
	}

	it.each(GUARDED)('%s / %s', (file, marker) => {
		const source = readFileSync(join(SRC, file), 'utf8')
		expect(resourceBlock(source, marker)).not.toMatch(/\bcache\s*:/)
	})
})
