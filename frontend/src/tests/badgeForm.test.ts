/**
 * Tests for the "Assign For" field on the badge form.
 *
 * frappe-ui's Combobox models a plain value — `defineModel<string | null>` — so
 * `update:modelValue` carries the selected option's value, not the option
 * object. BadgeForm read `opt.value` off it, which is `undefined` on a string,
 * so picking a doctype silently cleared the field and every badge saved without
 * the one thing that decides what it is awarded for.
 *
 * LMS Badge marks reference_doctype reqd=1, so the control says so too.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

window.__ = (text: string): string => text

const { insertSubmit, setValueSubmit, reloadMock, toastMock, callMock } =
	vi.hoisted(() => ({
		insertSubmit: vi.fn(),
		setValueSubmit: vi.fn(),
		reloadMock: vi.fn(),
		toastMock: { success: vi.fn(), error: vi.fn() },
		callMock: vi.fn(() => Promise.resolve({})),
	}))

vi.mock('frappe-ui', () => ({
	call: callMock,
	toast: toastMock,
	Button: {
		emits: ['click'],
		template: `<button @click="$emit('click')"><slot /></button>`,
	},
	FormControl: {
		props: ['modelValue', 'label', 'type', 'required', 'placeholder'],
		emits: ['update:modelValue'],
		template: `<input
			:data-testid="'fc-' + label"
			:value="modelValue"
			@input="$emit('update:modelValue', $event.target.value)"
		/>`,
	},
	// Mirrors the real component's contract: the payload is the option's VALUE.
	Combobox: {
		props: ['modelValue', 'options', 'label', 'required'],
		emits: ['update:modelValue'],
		template: `<button
			data-testid="combobox"
			:data-required="required ? 'yes' : 'no'"
			@click="$emit('update:modelValue', options[0].value)"
		/>`,
	},
}))

vi.mock('@/components/Controls/BooleanSwitch.vue', () => ({
	default: {
		props: ['modelValue', 'label', 'size', 'description'],
		emits: ['update:modelValue'],
		template: `<div data-testid="switch" />`,
	},
}))
vi.mock('@/components/Controls/CodeEditor.vue', () => ({
	default: {
		props: ['modelValue', 'label', 'type', 'required', 'showBorder', 'height'],
		emits: ['update:modelValue'],
		template: `<div data-testid="code" />`,
	},
}))
vi.mock('@/components/Controls/Uploader.vue', () => ({
	default: {
		props: ['modelValue', 'label', 'description', 'required'],
		emits: ['update:modelValue'],
		template: `<div data-testid="uploader" />`,
	},
}))
vi.mock('@/components/Controls/Select.vue', () => ({
	default: {
		props: ['modelValue', 'label', 'options', 'required'],
		emits: ['update:modelValue'],
		template: `<div data-testid="select" />`,
	},
}))
vi.mock('@/components/Layouts/SettingsLayout.vue', () => ({
	default: {
		props: ['title', 'showBack', 'enabled'],
		template: `<div><slot name="header-actions" /><slot /></div>`,
	},
}))
vi.mock('@/utils', () => ({ cleanError: (e: unknown) => String(e) }))

import BadgeForm from '@/components/Settings/Badges/BadgeForm.vue'

const mountForm = (badgeName = 'new') =>
	mount(BadgeForm, {
		props: {
			badgeName,
			badges: {
				data: [],
				insert: { submit: insertSubmit },
				setValue: { submit: setValueSubmit },
				reload: reloadMock,
			} as any,
		},
		global: { config: { globalProperties: { __: (s: string) => s } as any } },
	})

describe('BadgeForm — Assign For', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('puts the picked doctype in the created badge', async () => {
		const wrapper = mountForm()

		await wrapper.find('[data-testid="combobox"]').trigger('click')
		await wrapper.find('button:not([data-testid])').trigger('click')
		await flushPromises()

		expect(insertSubmit).toHaveBeenCalled()
		expect(insertSubmit.mock.calls[0][0]).toMatchObject({
			reference_doctype: 'LMS Course',
		})
	})

	it('marks Assign For required, as LMS Badge does', () => {
		const wrapper = mountForm()

		expect(
			wrapper.find('[data-testid="combobox"]').attributes('data-required')
		).toBe('yes')
	})
})
