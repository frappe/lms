// @vitest-environment node
import { describe, expect, it } from 'vitest'

// A page has one primary (solid) button, and it lives in the page header. The
// buttons under an empty state repeat or support that action, so they are
// secondary: a solid one there is a second primary on the same page.

const sources = import.meta.glob('../**/*.vue', {
	query: '?raw',
	import: 'default',
	eager: true,
}) as Record<string, string>

const app = Object.entries(sources).filter(
	([path]) => !path.startsWith('./') && !path.includes('/tests/')
)

// The markup an empty state draws its buttons in: an EmptyStateLayout's
// children, a list page's #empty-actions slot, and the two components that
// are empty states themselves.
const EMPTY_BLOCKS = [
	/<EmptyStateLayout\b[\s\S]*?<\/EmptyStateLayout>/g,
	/<template #empty-actions>[\s\S]*?<\/template>/g,
]
const WHOLE_FILES = [
	'../components/EmptyStateActions.vue',
	'../components/CourseEditorEmptyState.vue',
]

describe('empty state buttons are never primary', () => {
	it('finds the empty states it guards', () => {
		const blocks = app.flatMap(([, code]) =>
			EMPTY_BLOCKS.flatMap((pattern) => code.match(pattern) ?? [])
		)
		expect(blocks.length).toBeGreaterThan(5)
		for (const path of WHOLE_FILES) expect(sources[path]).toBeTruthy()
	})

	it('uses no solid button under an empty state', () => {
		const offenders = app.flatMap(([path, code]) => {
			const blocks = WHOLE_FILES.includes(path)
				? [code]
				: EMPTY_BLOCKS.flatMap((pattern) => code.match(pattern) ?? [])
			return blocks.some((block) => /variant="solid"/.test(block))
				? [path]
				: []
		})
		expect(offenders).toEqual([])
	})
})
