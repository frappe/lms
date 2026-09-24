import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { toValue } from 'vue'
import type { MentionSuggestionItem } from 'frappe-ui/editor'

vi.stubGlobal('__', (text: string): string => text)
window.matchMedia ??= (() => ({
	matches: false,
	addEventListener: () => {},
	removeEventListener: () => {},
})) as unknown as typeof window.matchMedia

const emptyRect = (): DOMRect => new DOMRect(0, 0, 0, 0)
const emptyRects = (): DOMRectList =>
	Object.assign([], { item: () => null }) as unknown as DOMRectList
document.elementFromPoint ??= () => null
Range.prototype.getBoundingClientRect ??= emptyRect
Range.prototype.getClientRects ??= emptyRects

vi.mock('frappe-ui', async (orig) => ({
	...(await orig<typeof import('frappe-ui')>()),
	useFileUpload: () => ({ upload: vi.fn() }),
}))

const { default: RichTextEditor } = await import(
	'@/components/RichTextEditor.vue'
)
const { Editor } = await import('frappe-ui/editor')

type RichTextEditorProps = InstanceType<typeof RichTextEditor>['$props']

let wrapper: VueWrapper | null = null

async function mountEditor(props: RichTextEditorProps = {}) {
	wrapper = mount(RichTextEditor, { props, attachTo: document.body })
	await flushPromises()
	return wrapper
}

function contentNode(w: VueWrapper): HTMLElement {
	const node = w.element.querySelector<HTMLElement>(
		'[data-slot="editor-content"]'
	)
	if (!node) throw new Error('editor content node not rendered')
	return node
}

function tiptap(w: VueWrapper) {
	const editor = w.findComponent(Editor).vm.editor
	if (!editor) throw new Error('editor not created')
	return editor
}

function mentionSuggestion(w: VueWrapper) {
	const editor = tiptap(w)
	const suggestion = editor.extensionManager.extensions.find(
		(ext) => ext.name === 'mentionSuggestion'
	)
	if (!suggestion) throw new Error('mention suggestion not registered')
	return { editor, suggestion }
}

afterEach(() => {
	wrapper?.unmount()
	wrapper = null
})

describe('RichTextEditor', () => {
	it('labels the contenteditable node through props', async () => {
		const w = await mountEditor({
			id: 'body',
			ariaLabelledby: 'body-label',
			ariaRequired: true,
			ariaInvalid: false,
		})
		const node = contentNode(w)
		expect(node.getAttribute('contenteditable')).toBe('true')
		expect(node.id).toBe('body')
		expect(node.getAttribute('aria-labelledby')).toBe('body-label')
		expect(node.getAttribute('aria-required')).toBe('true')
		expect(node.getAttribute('aria-invalid')).toBe('false')

		await w.setProps({ ariaInvalid: true })
		expect(node.getAttribute('aria-invalid')).toBe('true')
		expect(node.classList.contains('ProseMirror')).toBe(true)
	})

	it('omits the aria attributes when the props are unset', async () => {
		const node = contentNode(await mountEditor())
		expect(node.hasAttribute('id')).toBe(false)
		expect(node.hasAttribute('aria-labelledby')).toBe(false)
		expect(node.hasAttribute('aria-required')).toBe(false)
		expect(node.hasAttribute('aria-invalid')).toBe(false)
	})

	it('passes mention items through with value, never id', async () => {
		const w = await mountEditor({
			mentions: [{ value: 'a@x.com', label: 'A' }],
		})
		const { editor, suggestion } = mentionSuggestion(w)
		const items: MentionSuggestionItem[] = toValue(suggestion.options.mentions)
		expect(items).toEqual([{ value: 'a@x.com', label: 'A' }])
		expect(items[0]).not.toHaveProperty('id')

		editor.commands.insertContent({
			type: 'mention',
			attrs: { id: items[0].value, label: items[0].label },
		})
		expect(editor.getHTML()).toContain('data-id="a@x.com"')
	})

	it('offers a mention list that arrives after mount', async () => {
		const w = await mountEditor({ mentions: [] })
		const { editor, suggestion } = mentionSuggestion(w)
		const query = () =>
			suggestion.options.suggestion.items({ query: '', editor })
		expect(await query()).toEqual([])

		const later = [{ value: 'b@x.com', label: 'B' }]
		await w.setProps({ mentions: later })
		expect(await query()).toEqual(later)
	})

	it('registers no mention menu without a mentions prop', async () => {
		const editor = tiptap(await mountEditor())
		const names = editor.extensionManager.extensions.map((ext) => ext.name)
		expect(names).not.toContain('mentionSuggestion')
	})

	it('re-emits blur', async () => {
		const w = await mountEditor()
		const event = new FocusEvent('blur')
		w.findComponent(Editor).vm.$emit('blur', event)
		expect(w.emitted('blur')?.[0]).toEqual([event])
	})

	it('exposes focus()', async () => {
		const w = await mountEditor({ content: '<p>hello</p>' })
		const exposed = w.vm.$.exposed as { focus: () => unknown }
		exposed.focus()
		await vi.waitFor(() => expect(document.activeElement).toBe(contentNode(w)))
	})
})
