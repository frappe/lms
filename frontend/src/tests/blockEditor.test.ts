import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import Paragraph from '@editorjs/paragraph'
import BlockEditor from '@/components/BlockEditor.vue'

vi.mock('@/utils', () => ({
	// 'markdown' is the editor's defaultBlock and what the trailing-block
	// affordance inserts; alias it to Paragraph so the test editor can create it.
	getEditorTools: () => ({ paragraph: Paragraph, markdown: Paragraph }),
	// No tune tools are registered above, so return no tunes — EditorJS would
	// otherwise fail resolving the clipboard tune names against missing tools.
	getEditorTunes: () => [],
	enablePlyr: () => {},
}))

declare global {
	interface Window {
		__: (text: string) => string
	}
}
window.__ = (text: string) => text
window.matchMedia ??= (() => ({
	matches: false,
	addEventListener: () => {},
	removeEventListener: () => {},
})) as unknown as typeof window.matchMedia

type BlockEditorApi = {
	isReady: () => Promise<void>
	render: (data: object) => Promise<void>
	save: () => Promise<{ blocks: { data: { text: string } }[] } | null>
	focus: (atEnd?: boolean) => void
}

const TWO_BLOCKS = {
	blocks: [
		{ type: 'paragraph', data: { text: 'first' } },
		{ type: 'paragraph', data: { text: 'second' } },
	],
}

describe('BlockEditor', () => {
	let wrapper: VueWrapper
	let editorApi: BlockEditorApi

	beforeEach(async () => {
		wrapper = mount(BlockEditor, { attachTo: document.body })
		editorApi = wrapper.vm as unknown as BlockEditorApi
		await editorApi.isReady()
		await editorApi.render(TWO_BLOCKS)
		await new Promise((r) => setTimeout(r, 50))
	})

	afterEach(() => {
		try {
			wrapper.unmount()
		} catch {
			// a test may have unmounted already (teardown-guard case)
		}
		document.body.innerHTML = ''
	})

	it('renders the native EditorJS toolbar (+ add and the ⋮⋮ settings menu)', () => {
		expect(document.querySelector('.ce-toolbar__plus')).not.toBeNull()
		expect(
			document.querySelector('.ce-toolbar__settings-btn')
		).not.toBeNull()
	})

	it('does not inject the old custom Notion-style handle or menu', () => {
		expect(document.querySelector('.bn-drag-handle')).toBeNull()
		expect(document.querySelector('.bn-block-menu')).toBeNull()
	})

	it('makes the native settings button draggable (editorjs-drag-drop)', () => {
		const settings = document.querySelector('.ce-toolbar__settings-btn')
		expect(settings?.getAttribute('draggable')).toBe('true')
	})

	it('round-trips block content through render() and save()', async () => {
		const out = await editorApi.save()
		expect(out.blocks.map((b) => b.data.text)).toEqual(['first', 'second'])
	})

	it('exposes a focus() method that places the caret without throwing', () => {
		expect(() => editorApi.focus()).not.toThrow()
	})

	it('null-guards exposed methods after unmount (teardown autosave)', async () => {
		wrapper.unmount()
		// A debounced parent autosave (LessonForm.saveLesson) can call these
		// after onBeforeUnmount has nulled the editor instance. They must no-op
		// instead of throwing "Cannot read properties of null (reading 'save')".
		await expect(editorApi.save()).resolves.toBeNull()
		await expect(editorApi.render(TWO_BLOCKS)).resolves.toBeUndefined()
		await expect(editorApi.isReady()).resolves.toBeUndefined()
		expect(() => editorApi.focus()).not.toThrow()
	})
})
