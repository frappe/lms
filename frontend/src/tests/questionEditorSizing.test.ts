import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('frappe-ui', () => ({
	Button: { template: '<button><slot /></button>' },
	Badge: { template: '<span><slot /></span>' },
	Dropdown: { template: '<div><slot /></div>' },
	FormControl: { template: '<input />' },
	FormLabel: { template: '<label />' },
}))

vi.mock('@/components/RichTextEditor.vue', () => ({
	default: {
		name: 'RichTextEditorStub',
		props: [
			'fill',
			'minHeight',
			'content',
			'editable',
			'fixedMenu',
			'placeholder',
			'id',
			'ariaLabelledby',
			'ariaRequired',
			'ariaInvalid',
		],
		emits: ['change', 'blur'],
		template:
			'<div class="text-editor-stub" :id="id" :aria-invalid="String(ariaInvalid)" />',
	},
}))

vi.stubGlobal('__', (s: string) => s)

// translation.js installs String.prototype.format at app boot; the marks label
// reads it during setup, so a bare mount() would fail on the format call rather
// than on anything this file is about.
String.prototype.format = function (this: string, ...args: unknown[]): string {
	return args.reduce<string>(
		(out, arg, i) => out.replaceAll(`{${i}}`, String(arg)),
		this
	)
}

async function mountEditor(
	uiType: string,
	fillHeight: boolean,
	question: Record<string, string> = {
		question: 'Q?',
		option_1: 'a',
		option_2: 'b',
	}
) {
	const { default: QuestionEditor } = await import(
		'@/components/Quiz/QuestionEditor.vue'
	)
	return mount(QuestionEditor, {
		props: {
			question,
			uiType,
			fillHeight,
			idPrefix: 'test',
		},
		global: { config: { globalProperties: { __: (s: string) => s } as any } },
	})
}

describe('QuestionEditor field labelling', () => {
	const editorOf = (wrapper: ReturnType<typeof mount>) =>
		wrapper.findComponent({ name: 'RichTextEditorStub' })

	it('labels the field and marks it required', async () => {
		const wrapper = await mountEditor('single', false)
		const props = editorOf(wrapper).props()
		expect(props.id).toBe('question-editor-test')
		expect(props.ariaLabelledby).toBe('question-editor-label-test')
		expect(props.ariaRequired).toBe(true)
	})

	it('reports an empty question as invalid once the field is left', async () => {
		const wrapper = await mountEditor('single', false, { question: '' })
		expect(editorOf(wrapper).props('ariaInvalid')).toBe(false)
		await editorOf(wrapper).vm.$emit('blur', new FocusEvent('blur'))
		await wrapper.vm.$nextTick()
		expect(editorOf(wrapper).props('ariaInvalid')).toBe(true)
		expect(wrapper.find('.text-editor-stub').attributes('aria-invalid')).toBe(
			'true'
		)
	})
})
