/**
 * Tests for EmailTemplateAdd.vue — create / duplicate an email template.
 *
 * Focus: required-field validation, the duplicate flow (" - Copy" + isDuplicate
 * label), the use_html → response_html payload branch, and the double-submit
 * guard (spamming Create inserts once).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import EmailTemplateAdd from '@/components/Settings/EmailTemplate/EmailTemplateAdd.vue'

const { lastInsert } = vi.hoisted(() => ({
	lastInsert: { value: null as any },
}))

vi.mock('frappe-ui', () => ({
	createListResource: () => {
		const insert: any = { loading: false }
		insert.submit = vi.fn((payload: any, opts: any) => {
			insert.loading = true
			insert._payload = payload
			insert._opts = opts
		})
		lastInsert.value = insert
		return { insert }
	},
	toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
	Button: {
		props: ['label', 'loading'],
		emits: ['click'],
		template: `<button :data-testid="'btn-' + label" @click="$emit('click')">{{ label }}</button>`,
	},
	ErrorMessage: {
		props: ['message'],
		template: `<div data-testid="error">{{ message }}</div>`,
	},
	FormControl: {
		props: ['modelValue', 'label', 'type', 'placeholder', 'required', 'rows'],
		emits: ['update:modelValue'],
		template: `<input :data-testid="'field-' + label" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
	},
	Switch: {
		props: ['modelValue', 'label', 'description', 'size'],
		emits: ['update:modelValue'],
		template: `<button :data-testid="'switch-' + label" @click="$emit('update:modelValue', !modelValue)" />`,
	},
}))

vi.mock('@/components/RichTextEditor.vue', () => ({
	default: {
		props: ['content'],
		emits: ['change'],
		template: `<textarea data-testid="editor" :value="content" @input="$emit('change', $event.target.value)" />`,
	},
}))

vi.mock('@/components/Layouts/SettingsLayout.vue', () => ({
	default: { template: `<div><slot name="header-actions" /><slot /></div>` },
}))

vi.mock('@/utils', () => ({ cleanError: (e: unknown) => e }))

vi.stubGlobal('__', (s: string) => s)

const mountAdd = (props: Record<string, unknown> = {}) =>
	mount(EmailTemplateAdd, {
		props,
		global: { mocks: { __: (s: string) => s } },
	})

const setField = async (w: any, label: string, value: string) =>
	w.get(`[data-testid="field-${label}"]`).setValue(value)

const clickCreate = async (w: any, label = 'Create') => {
	await w.get(`[data-testid="btn-${label}"]`).trigger('click')
	await flushPromises()
}

beforeEach(() => {
	lastInsert.value = null
})

describe('EmailTemplateAdd — create (rich text)', () => {
	it('inserts with __newname and the rich-text response', async () => {
		const w = mountAdd()
		await setField(w, 'Name', 'Dispatch Notification')
		await setField(w, 'Subject', 'Your order is out for delivery!')
		await w
			.get('[data-testid="editor"]')
			.setValue('<p>Hi {{ member_name }}</p>')
		await clickCreate(w)

		expect(lastInsert.value.submit).toHaveBeenCalledTimes(1)
		expect(lastInsert.value._payload).toEqual({
			__newname: 'Dispatch Notification',
			name: 'Dispatch Notification',
			subject: 'Your order is out for delivery!',
			use_html: 0,
			response: '<p>Hi {{ member_name }}</p>',
			response_html: '',
		})
	})

	it('use_html routes content into response_html with use_html: 1', async () => {
		const w = mountAdd()
		await setField(w, 'Name', 'HTML Template')
		await setField(w, 'Subject', 'Subject')
		await w.get('[data-testid="switch-Use HTML"]').trigger('click')
		await setField(w, 'Content', '<h1>Hi</h1>')
		await clickCreate(w)
		expect(lastInsert.value._payload.use_html).toBe(1)
		expect(lastInsert.value._payload.response_html).toBe('<h1>Hi</h1>')
	})
})

describe('EmailTemplateAdd — validation', () => {
	it('blocks submit when name is empty', async () => {
		const w = mountAdd()
		await setField(w, 'Subject', 'Subject')
		await w.get('[data-testid="editor"]').setValue('body')
		await clickCreate(w)
		expect(lastInsert.value.submit).not.toHaveBeenCalled()
		expect(w.get('[data-testid="error"]').text()).toBe('Name is required')
	})

	it('blocks submit when content is empty', async () => {
		const w = mountAdd()
		await setField(w, 'Name', 'X')
		await setField(w, 'Subject', 'Y')
		await clickCreate(w)
		expect(lastInsert.value.submit).not.toHaveBeenCalled()
		expect(w.get('[data-testid="error"]').text()).toBe('Content is required')
	})
})

describe('EmailTemplateAdd — duplicate', () => {
	it('prefills " - Copy" and shows the Duplicate action', async () => {
		const w = mountAdd({
			templateData: {
				name: 'Welcome',
				subject: 'Hi',
				use_html: 1,
				response_html: '<p>x</p>',
			},
		})
		expect(w.find('[data-testid="btn-Duplicate"]').exists()).toBe(true)
		expect(
			(w.get('[data-testid="field-Name"]').element as HTMLInputElement).value
		).toBe('Welcome - Copy')
		await clickCreate(w, 'Duplicate')
		expect(lastInsert.value._payload.name).toBe('Welcome - Copy')
		expect(lastInsert.value._payload.use_html).toBe(1)
	})
})

describe('EmailTemplateAdd — double-submit', () => {
	it('spamming Create inserts exactly once', async () => {
		const w = mountAdd()
		await setField(w, 'Name', 'X')
		await setField(w, 'Subject', 'Y')
		await w.get('[data-testid="editor"]').setValue('body')
		const btn = w.get('[data-testid="btn-Create"]')
		btn.trigger('click')
		btn.trigger('click')
		btn.trigger('click')
		await flushPromises()
		expect(lastInsert.value.submit).toHaveBeenCalledTimes(1)
	})
})
