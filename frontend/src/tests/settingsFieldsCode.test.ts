/**
 * SettingsFields' `code` field glue. CodeMirror 5 `mode` loads the CodeMirror 6
 * language, `rows` caps the height, and autosave runs off the editor's emits
 * since CodeMirror edits a contenteditable, not a textarea.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { EditorView } from '@codemirror/view'
import type { SettingsField } from '@/types/settingsSchema'

vi.hoisted(() => {
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
})

vi.stubGlobal('__', (text: string) => text)

const { loadLanguage } = vi.hoisted(() => ({
	loadLanguage: vi.fn(async () => ({})),
}))

// Real module pulls in CodeMirror, which jsdom cannot lay out. The stub reports
// what the field hands the editor.
vi.mock('frappe-ui/code-editor', () => ({
	CodeEditor: {
		props: ['modelValue', 'extensions', 'editable'],
		emits: ['update:modelValue', 'change'],
		template: `<div data-testid="code" :data-editable="String(editable)"><slot /></div>`,
	},
	CodeEditorContent: { template: '<div data-testid="code-content" />' },
	CodeKit: { configure: () => ({}) },
	loadLanguage,
}))

const mountFields = async (
	fields: SettingsField[],
	data: Record<string, unknown> = {}
) => {
	const SettingsFields = (
		await import('@/components/Layouts/settings/desktop/SettingsFields.vue')
	).default
	return mount(SettingsFields, {
		props: { sections: [{ fields }], data },
		global: { mocks: { __: (s: string) => s } },
	})
}

const codeField = (over: Partial<SettingsField> = {}) =>
	({
		name: 'response_html',
		label: 'Content',
		type: 'code',
		mode: 'htmlmixed',
		rows: 8,
		...over,
	} as SettingsField)

describe('SettingsFields renders a code field with the library editor', () => {
	it('loads the CodeMirror language the schema mode names', async () => {
		loadLanguage.mockClear()
		await mountFields([codeField()])
		expect(loadLanguage).toHaveBeenCalledWith('html')
	})

	it('maps javascript, and falls back to html for anything else', async () => {
		loadLanguage.mockClear()
		await mountFields([codeField({ mode: 'javascript' })])
		expect(loadLanguage).toHaveBeenLastCalledWith('javascript')

		await mountFields([codeField({ mode: 'sql' } as Partial<SettingsField>)])
		expect(loadLanguage).toHaveBeenLastCalledWith('html')
	})

	it('caps the editor at 25px a row, the height Ace was drawn at', async () => {
		const w = await mountFields([codeField({ rows: 8 })])
		expect(w.get('.code-field').html()).toContain('--code-max-height: 200px')
	})

	it('falls back to ten rows when the schema names none', async () => {
		const w = await mountFields([codeField({ rows: undefined })])
		expect(w.get('.code-field').html()).toContain('--code-max-height: 250px')
	})

	it('reports typing live and a commit on change, not on DOM events', async () => {
		const w = await mountFields([codeField()])
		const editor = w.getComponent('[data-testid="code"]')

		await editor.vm.$emit('update:modelValue', '<p>hi</p>')
		expect(w.emitted('commit')?.at(-1)).toEqual(['typing'])

		await editor.vm.$emit('change', '<p>hi</p>')
		expect(w.emitted('commit')?.at(-1)).toEqual(['now'])
	})

	it('never reports for a field the document has disabled', async () => {
		const w = await mountFields([codeField({ disabled: true })])
		const editor = w.getComponent('[data-testid="code"]')
		expect(editor.attributes('data-editable')).toBe('false')

		await editor.vm.$emit('update:modelValue', 'x')
		await editor.vm.$emit('change', 'x')
		expect(w.emitted('commit')).toBeUndefined()
	})

	it('keeps the settings label and description, marker and all', async () => {
		const w = await mountFields([
			codeField({ reqd: true, description: 'Raw HTML or Jinja.' }),
		])

		expect(w.get('[data-testid="code-field-label"]').text()).toBe(
			'Content *(required)'
		)
		expect(w.get('[data-testid="code-field-description"]').text()).toBe(
			'Raw HTML or Jinja.'
		)
		expect(
			w.get('[data-testid="code-field-label"] [aria-hidden="true"]').text()
		).toBe('*')
	})

	it('names the editor by its label and marks it required', async () => {
		const of = vi.spyOn(EditorView.contentAttributes, 'of')
		try {
			const w = await mountFields([
				codeField({ reqd: true, description: 'Raw HTML or Jinja.' }),
			])
			const labelId = w.get('[data-testid="code-field-label"]').attributes('id')
			const descriptionId = w
				.get('[data-testid="code-field-description"]')
				.attributes('id')

			expect(labelId).toBeTruthy()
			expect(descriptionId).toBeTruthy()
			expect(of).toHaveBeenLastCalledWith({
				'aria-labelledby': labelId,
				'aria-describedby': descriptionId,
				'aria-required': 'true',
			})
		} finally {
			of.mockRestore()
		}
	})

	it('leaves an optional, undescribed field unrequired and undescribed', async () => {
		const of = vi.spyOn(EditorView.contentAttributes, 'of')
		try {
			const w = await mountFields([codeField()])
			expect(of).toHaveBeenLastCalledWith({
				'aria-labelledby': w
					.get('[data-testid="code-field-label"]')
					.attributes('id'),
				'aria-describedby': '',
				'aria-required': 'false',
			})
		} finally {
			of.mockRestore()
		}
	})
})

describe('SettingsFields draws the Content label the same either side of Use HTML', () => {
	const richField = {
		name: 'response',
		label: 'Content',
		type: 'richtext',
		rows: 8,
		reqd: true,
		description: 'The body of the email.',
	} as SettingsField

	const mountWithRichText = async (fields: SettingsField[]) => {
		const SettingsFields = (
			await import('@/components/Layouts/settings/desktop/SettingsFields.vue')
		).default
		return mount(SettingsFields, {
			props: { sections: [{ fields }], data: {} },
			global: {
				mocks: { __: (s: string) => s },
				stubs: { RichTextEditor: true },
			},
		})
	}

	it('gives the rich text and code fields identical label and description', async () => {
		const rich = await mountWithRichText([richField])
		const code = await mountFields([
			codeField({ reqd: true, description: 'The body of the email.' }),
		])

		const richLabel = rich.get('[data-slot="label"]')
		const codeLabel = code.get('[data-testid="code-field-label"]')
		expect(richLabel.classes()).toEqual(codeLabel.classes())
		expect(richLabel.text()).toBe(codeLabel.text())

		expect(rich.get('[data-slot="description"]').classes()).toEqual(
			code.get('[data-testid="code-field-description"]').classes()
		)
	})

	it('names the rich text editor by its label', async () => {
		const w = await mountWithRichText([richField])
		const labelId = w.get('[data-slot="label"]').attributes('id')
		const editor = w.getComponent({ name: 'RichTextEditor' })

		expect(labelId).toBeTruthy()
		expect(editor.props('ariaLabelledby')).toBe(labelId)
		expect(editor.props('ariaRequired')).toBe(true)
	})
})
