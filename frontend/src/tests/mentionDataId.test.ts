// Regression: rc.1 renamed the mention item key from id to value, so an {id, label} item inserts a mention with no data-id.
// Introduced by the frappe-ui 1.0.0-rc.1 upgrade; test added in that PR (chore/frappe-ui-v1-rc1)
// to pin RichTextEditor mentions carrying the user's name through the real @ command.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'

vi.stubGlobal('__', (text: string): string => text)
window.matchMedia ??= (() => ({
	matches: false,
	addEventListener: () => {},
	removeEventListener: () => {},
})) as unknown as typeof window.matchMedia
document.elementFromPoint ??= () => null
Range.prototype.getBoundingClientRect ??= () => new DOMRect(0, 0, 0, 0)
Range.prototype.getClientRects ??= () =>
	Object.assign([], { item: () => null }) as unknown as DOMRectList

vi.mock('frappe-ui', async (orig) => ({
	...(await orig<typeof import('frappe-ui')>()),
	useFileUpload: () => ({ upload: vi.fn() }),
}))

const { default: RichTextEditor } = await import(
	'@/components/RichTextEditor.vue'
)
const { Editor } = await import('frappe-ui/editor')

let wrapper: VueWrapper | null = null

afterEach(() => {
	wrapper?.unmount()
	wrapper = null
})

describe('RichTextEditor mentions', () => {
	it('stores the item value as data-id when a mention is picked', async () => {
		wrapper = mount(RichTextEditor, {
			props: { mentions: [{ value: 'a@example.com', label: 'A' }] },
			attachTo: document.body,
		})
		await flushPromises()

		const editor = wrapper.findComponent(Editor).vm.editor
		if (!editor) throw new Error('editor not created')
		const suggestion = editor.extensionManager.extensions.find(
			(ext) => ext.name === 'mentionSuggestion'
		)
		if (!suggestion) throw new Error('mention suggestion not registered')

		const { items, command } = suggestion.options.suggestion
		const [picked] = await items({ query: 'A', editor })
		editor.commands.insertContent('@A')
		const to = editor.state.selection.from
		command({ editor, range: { from: to - 2, to }, props: picked })

		const mention = await vi.waitFor(() => {
			const html = wrapper?.emitted<[string]>('change')?.at(-1)?.[0] ?? ''
			const span = new DOMParser()
				.parseFromString(html, 'text/html')
				.querySelector('span[data-type="mention"]')
			if (!span) throw new Error('no mention in the emitted html')
			return span
		})
		expect(mention.getAttribute('data-id')).toBe('a@example.com')
		expect(mention.textContent).toBe('@A')
	})
})
