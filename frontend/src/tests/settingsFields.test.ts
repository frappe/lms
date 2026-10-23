/**
 * SettingsFields, one file so the component and its editor toolchain load once.
 *
 * Code fields: CodeMirror 5 `mode` loads the CodeMirror 6 language, `rows` caps
 * the height, and autosave runs off the editor's emits since CodeMirror edits a
 * contenteditable, not a textarea.
 *
 * Password fields render through frappe-ui's Password, so a secret gets a
 * masked box with a reveal toggle instead of a bare `type="password"` input.
 * Covers both paths: a plain password field, which lives in `data` like any
 * other value, and a `secret` one, which is kept out of `data` and reported via
 * `@secret`.
 *
 * Required marker: `reqd` already reached the underlying control (FormControl's
 * `required` prop enforces it and, where FormControl draws its own `label`,
 * shows a `*`), but SettingsFields draws every field's label itself, outside of
 * that prop, so a required field looked identical to an optional one until you
 * focused it. This is the fix, and it reaches every settings page that renders
 * through SettingsFields, not just Email Accounts.
 */
import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { EditorView } from '@codemirror/view'
import type { SettingsField } from '@/types/settingsSchema'

vi.hoisted(() => {
	// SettingsFields reaches @/utils, which pulls in plyr. Plyr touches
	// matchMedia at import time, and jsdom has none.
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
// what the field hands the editor. No password or required case below renders
// a code field.
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

describe('SettingsFields renders a password field as Password', () => {
	it('masks a plain password field and offers a reveal toggle', async () => {
		const w = await mountFields([
			{ name: 'client_secret', label: 'Client Secret', type: 'password' },
		])

		const input = w.get('input')
		expect(input.attributes('type')).toBe('password')

		await w.get('.lucide-eye').trigger('click')
		expect(w.get('input').attributes('type')).toBe('text')
	})

	it('hides the reveal toggle when the value is a stored mask', async () => {
		const w = await mountFields(
			[{ name: 'client_secret', label: 'Client Secret', type: 'password' }],
			{ client_secret: '*****' }
		)

		expect(w.get('.lucide-eye').isVisible()).toBe(false)
	})

	it('keeps a secret field out of data, reporting it via @secret', async () => {
		const data: Record<string, unknown> = { api_secret: '*****' }
		const w = await mountFields(
			[
				{
					name: 'api_secret',
					label: 'API Secret',
					type: 'password',
					secret: true,
				},
			],
			data
		)

		const input = w.get('input')
		expect(input.attributes('type')).toBe('password')
		// A stored secret says so rather than showing itself.
		expect(input.attributes('placeholder')).toBe(
			'Saved, leave blank to keep it'
		)
		expect(w.text()).not.toContain('*****')

		await input.setValue('typed-secret')

		// TextInput reports on both `input` and `change`, so the count is the
		// library's business; what matters is the payload and that `data` is
		// left holding the stored mask.
		expect(w.emitted('secret')?.at(-1)).toEqual(['api_secret', 'typed-secret'])
		expect(data.api_secret).toBe('*****')
	})

	it('prompts with the field label when no secret is stored yet', async () => {
		const w = await mountFields([
			{
				name: 'api_secret',
				label: 'API Secret',
				type: 'password',
				secret: true,
			},
		])

		expect(w.get('input').attributes('placeholder')).toBe('API Secret')
	})
})

describe('SettingsFields marks a required field', () => {
	it('adds * beside a required field in the default row layout', async () => {
		const w = await mountFields([
			{ name: 'account_name', label: 'Account name', type: 'text', reqd: true },
			{ name: 'nickname', label: 'Nickname', type: 'text' },
		])

		expect(w.findAll('.text-ink-red-5')).toHaveLength(1)
		expect(w.text()).toContain('Account name')
		expect(w.text()).toContain('Nickname')
	})

	it('adds no * for a field that does not declare reqd', async () => {
		const w = await mountFields([
			{ name: 'nickname', label: 'Nickname', type: 'text' },
		])

		expect(w.find('.text-ink-red-5').exists()).toBe(false)
	})

	it('marks a required fullWidth field', async () => {
		const w = await mountFields([
			{
				name: 'bio',
				label: 'Bio',
				type: 'text',
				fullWidth: true,
				reqd: true,
			},
		])

		expect(w.findAll('.text-ink-red-5')).toHaveLength(1)
	})

	it('marks a required textarea field', async () => {
		const w = await mountFields([
			{ name: 'notes', label: 'Notes', type: 'textarea', reqd: true },
		])

		expect(w.findAll('.text-ink-red-5')).toHaveLength(1)
	})

	it('does not mark an optional checkbox, and still renders it', async () => {
		const w = await mountFields([
			{ name: 'enabled', label: 'Enabled', type: 'checkbox' },
		])

		expect(w.find('.text-ink-red-5').exists()).toBe(false)
		expect(w.text()).toContain('Enabled')
	})
})

describe('SettingsFields focuses the field it is asked for', () => {
	it('scrolls to the row and highlights it for a second', async () => {
		vi.useFakeTimers()
		const scrollIntoView = vi.fn()
		Element.prototype.scrollIntoView = scrollIntoView
		const SettingsFields = (
			await import('@/components/Layouts/settings/desktop/SettingsFields.vue')
		).default
		const w = mount(SettingsFields, {
			props: {
				sections: [
					{
						fields: [
							{ name: 'allow_guest_access', label: 'Guests', type: 'checkbox' },
							{ name: 'send_invites', label: 'Invites', type: 'checkbox' },
						],
					},
				],
				data: {},
				focus: 'send_invites',
			},
			global: { mocks: { __: (s: string) => s } },
		})
		await vi.dynamicImportSettled()
		await w.vm.$nextTick()
		const tint = (name: string) =>
			w.find(`[data-setting-field="${name}"] [data-testid="setting-highlight"]`)

		expect(scrollIntoView).toHaveBeenCalledTimes(1)
		expect(tint('send_invites').classes()).toContain('opacity-100')
		expect(tint('allow_guest_access').classes()).toContain('opacity-0')

		vi.advanceTimersByTime(1000)
		await w.vm.$nextTick()
		expect(tint('send_invites').classes()).toContain('opacity-0')
		vi.useRealTimers()
	})

	// Regression on this branch only, no upstream PR: a selector built from the name
	// threw on a quote. Added on feat/evaluator-availability-redesign (no PR yet).
	it('treats a name that is not a valid selector as no match', async () => {
		const scrollIntoView = vi.fn()
		Element.prototype.scrollIntoView = scrollIntoView
		const SettingsFields = (
			await import('@/components/Layouts/settings/desktop/SettingsFields.vue')
		).default
		const w = mount(SettingsFields, {
			props: {
				sections: [
					{
						fields: [
							{ name: 'send_invites', label: 'Invites', type: 'checkbox' },
						],
					},
				],
				data: {},
				focus: 'send"]invites',
			},
			global: { mocks: { __: (s: string) => s } },
		})
		await vi.dynamicImportSettled()
		await flushPromises()

		expect(scrollIntoView).not.toHaveBeenCalled()
		expect(w.find('[data-setting-field="send_invites"]').exists()).toBe(true)
	})
})
