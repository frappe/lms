import { describe, expect, it, vi } from 'vitest'

globalThis.__ = (text: string) => text
// Importing '@/utils' loads plyr, which needs window.matchMedia that jsdom lacks.
window.matchMedia ??= (() => ({
	matches: false,
	addEventListener: () => {},
	removeEventListener: () => {},
})) as unknown as typeof window.matchMedia

vi.mock('@/stores/settings', () => ({ useSettings: () => ({}) }))
vi.mock('@/stores/user', () => ({ usersStore: () => ({ userResource: {} }) }))

// @ts-expect-error @/utils is plain JS with no declarations.
const { getEditorTools } = await import('@/utils')

type PasteTag = string | Record<string, unknown>
type ToolClass = { pasteConfig?: false | { tags?: PasteTag[] } }

const tagNames = (tags: PasteTag[]): string[] =>
	tags.flatMap((tag) => (typeof tag === 'string' ? [tag] : Object.keys(tag)))

// EditorJS hands a pasted tag to the first tool that claims it and skips the
// rest with a console warning, so a second claim is dead code that hides which
// tool really gets the paste.
describe('lesson editor paste tags', () => {
	it('gives each pasted tag a single owning tool', () => {
		const owners: Record<string, string[]> = {}
		const tools = getEditorTools(true) as Record<string, unknown>
		for (const [name, tool] of Object.entries(tools)) {
			const toolClass = ((tool as { class?: unknown }).class ??
				tool) as ToolClass
			const config = toolClass.pasteConfig
			for (const tag of tagNames((config && config.tags) || [])) {
				const key = tag.toUpperCase()
				owners[key] = [...(owners[key] ?? []), name]
			}
		}
		const shared = Object.entries(owners).filter(
			([, names]) => names.length > 1
		)
		expect(shared).toEqual([])
	})
})
