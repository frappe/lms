import { describe, it, expect, vi } from 'vitest'

declare global {
	interface Window {
		__: (text: string) => string
	}
}
window.__ = (text: string): string => text
window.matchMedia ??= (() => ({
	matches: false,
	addEventListener: () => {},
	removeEventListener: () => {},
})) as unknown as typeof window.matchMedia

// '@/utils' pulls frappe-ui's resource plugin, which doesn't resolve under
// vitest. Only the tool-config shape matters here, so stub the pieces the
// barrel reaches for on import.
vi.mock('frappe-ui', () => ({ call: () => {}, toast: {} }))
vi.mock('@/stores/settings', () => ({ useSettings: () => ({}) }))
vi.mock('@/stores/user', () => ({ usersStore: () => ({ userResource: {} }) }))

const { getEditorTools } = await import('@/utils')

// EditorJS only fills `tool.inlineTools` when a block tool declares
// `inlineToolbar`. A block that omits it gets an empty collection, so
// InlineToolbar.allowedToShow() bails on `inlineTools.size !== 0` and the
// toolbar never opens; Ctrl+B then falls through to the browser's execCommand,
// which writes a `font-weight` span that the sanitizer strips on save. Headings
// shipped without the key, so headings could not be bolded at all.
const TEXT_BLOCKS = ['header', 'paragraph', 'markdown', 'list', 'table']

// Code and embeds deliberately opt out: rich formatting inside a code block or
// an embed caption is not wanted.
const NO_TOOLBAR_BLOCKS = ['codeBox', 'embed']

type ToolEntry = { inlineToolbar?: boolean | string[] }

describe('editor inline toolbar wiring', () => {
	const tools = getEditorTools() as Record<string, ToolEntry>

	it.each(TEXT_BLOCKS)('lets you bold inside a %s block', (block) => {
		const inlineToolbar = tools[block]?.inlineToolbar
		expect(Array.isArray(inlineToolbar) || inlineToolbar === true).toBe(true)
		if (Array.isArray(inlineToolbar)) {
			expect(inlineToolbar).toContain('bold')
			expect(inlineToolbar).toContain('italic')
		}
	})

	it.each(TEXT_BLOCKS)('gives the %s block the shared tool order', (block) => {
		expect(tools[block]?.inlineToolbar).toEqual(tools.paragraph?.inlineToolbar)
	})

	it.each(NO_TOOLBAR_BLOCKS)('keeps the toolbar off %s blocks', (block) => {
		expect(tools[block]?.inlineToolbar).toBeFalsy()
	})
})
