/**
 * Loading stored HTML makes the editor rewrite it (collapsed spaces, no newline
 * between blocks). That rewrite is not an edit: emitting it marked course and
 * batch descriptions unsaved, so leaving the page asked to discard changes.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'

vi.stubGlobal('__', (text: string): string => text)
window.matchMedia ??= (() => ({
	matches: false,
	addEventListener: () => {},
	removeEventListener: () => {},
})) as unknown as typeof window.matchMedia
document.elementFromPoint ??= () => null

vi.mock('frappe-ui', async (orig) => ({
	...(await orig<typeof import('frappe-ui')>()),
	useFileUpload: () => ({ upload: vi.fn() }),
}))

const { default: RichTextEditor } = await import(
	'@/components/RichTextEditor.vue'
)
const { Editor } = await import('frappe-ui/editor')

const STORED = '<p>Sales  matters.</p>\n<p>Teams help.</p>'

let wrapper: VueWrapper | undefined
afterEach(() => wrapper?.unmount())

const mountEditor = async (content = STORED) => {
	wrapper = mount(RichTextEditor, {
		props: { content },
		attachTo: document.body,
	})
	await flushPromises()
	return wrapper
}

// The frappe-ui Editor that owns the v-model, standing in for what tiptap emits.
const editorModel = (w: VueWrapper) => w.findComponent(Editor)

describe('RichTextEditor load-time rewrite', () => {
	it('does not report the rewrite of stored HTML as a change', async () => {
		const w = await mountEditor()
		editorModel(w).vm.$emit(
			'update:modelValue',
			'<p>Sales matters.</p><p>Teams help.</p>'
		)
		await nextTick()
		expect(w.emitted('change')).toBeUndefined()
	})

	it('reports a change once the user has focused the editor', async () => {
		const w = await mountEditor()
		editorModel(w).vm.$emit('focus')
		editorModel(w).vm.$emit('update:modelValue', '<p>Sales matters a lot.</p>')
		await nextTick()
		expect(w.emitted('change')?.at(-1)).toEqual(['<p>Sales matters a lot.</p>'])
	})

	it('treats new content from the parent as stored again', async () => {
		const w = await mountEditor()
		editorModel(w).vm.$emit('focus')
		editorModel(w).vm.$emit('blur', new FocusEvent('blur'))
		await w.setProps({ content: '<p>Other  course.</p>' })
		editorModel(w).vm.$emit('update:modelValue', '<p>Other course.</p>')
		await nextTick()
		expect(w.emitted('change')).toBeUndefined()
	})

	it('reports an image dropped without focusing the editor first', async () => {
		const w = await mountEditor()
		await w.find('[data-testid="rich-text-editor"]').trigger('drop')
		editorModel(w).vm.$emit(
			'update:modelValue',
			'<p>Sales matters.</p><img src="/files/a.png">'
		)
		await nextTick()
		expect(w.emitted('change')).toHaveLength(1)
	})
})
