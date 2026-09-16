/**
 * SettingsFields' `code` field, now drawn by frappe-ui's CodeMirror editor
 * instead of the Ace wrapper. What matters here is the glue: the schema's
 * CodeMirror-5 `mode` has to become a CodeMirror-6 language key, `rows` has to
 * reach the editor as its height cap, and autosave has to be driven off the
 * component's emits rather than DOM `input`/`focusout` — CodeMirror edits a
 * contenteditable, not a textarea.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { SettingsField } from '@/types/settingsSchema'

vi.hoisted(() => {
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
})

vi.stubGlobal('__', (text: string) => text)

vi.mock('frappe-ui/experimental', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	// The real editor lazy-loads CodeMirror in onMounted; jsdom has no layout to
	// give it. This stub reports what SettingsFields hands it.
	CodeEditor: {
		props: ['modelValue', 'language', 'required', 'disabled', 'size'],
		emits: ['update:modelValue', 'change'],
		template: `<div
			data-testid="code"
			:data-language="language"
			:data-required="String(!!required)"
			:data-disabled="String(!!disabled)"
			:data-size="size"
		><slot name="label" /><slot name="description" /></div>`,
	},
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
	it('translates the schema mode into a CodeMirror language key', async () => {
		const w = await mountFields([codeField()])
		expect(w.get('[data-testid="code"]').attributes('data-language')).toBe(
			'html'
		)
	})

	it('maps javascript, and falls back to html for anything else', async () => {
		const js = await mountFields([codeField({ mode: 'javascript' })])
		expect(js.get('[data-testid="code"]').attributes('data-language')).toBe(
			'javascript'
		)

		const unknown = await mountFields([
			codeField({ mode: 'sql' } as Partial<SettingsField>),
		])
		expect(unknown.get('[data-testid="code"]').attributes('data-language')).toBe(
			'html'
		)
	})

	it('caps the editor at 25px a row, the height Ace was drawn at', async () => {
		const w = await mountFields([codeField({ rows: 8 })])
		expect(w.get('.code-field').html()).toContain('--cm-max-height: 200px')
	})

	it('falls back to ten rows when the schema names none', async () => {
		const w = await mountFields([codeField({ rows: undefined })])
		expect(w.get('.code-field').html()).toContain('--cm-max-height: 250px')
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
		expect(editor.attributes('data-disabled')).toBe('true')

		await editor.vm.$emit('update:modelValue', 'x')
		await editor.vm.$emit('change', 'x')
		expect(w.emitted('commit')).toBeUndefined()
	})

	it('keeps the settings label and description, marker and all', async () => {
		const w = await mountFields([
			codeField({ reqd: true, description: 'Raw HTML or Jinja.' }),
		])

		expect(w.get('[data-testid="code-field-label"]').text()).toBe('Content *')
		expect(w.get('[data-testid="code-field-description"]').text()).toBe(
			'Raw HTML or Jinja.'
		)
		expect(w.get('[data-testid="code"]').attributes('data-required')).toBe(
			'true'
		)
	})
})
