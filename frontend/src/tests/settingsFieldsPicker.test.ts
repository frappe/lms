/**
 * PickerShell's wrapper div swallows aria-label, so SettingsFields names a
 * date field with a `<label for>`. Uses the real FormControl/DatePicker so the
 * id forwarding is exercised.
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

const mountFields = async (fields: SettingsField[]) => {
	const SettingsFields = (
		await import('@/components/Layouts/settings/desktop/SettingsFields.vue')
	).default
	return mount(SettingsFields, {
		props: { sections: [{ fields }], data: {} },
		global: { mocks: { __: (s: string) => s } },
		attachTo: document.body,
	})
}

describe('SettingsFields names a picker field through <label for>', () => {
	it('points the label at the date input and drops the dead aria-label', async () => {
		const w = await mountFields([
			{ name: 'start_date', label: 'Start date', type: 'date' },
		])

		const label = w.get('label[for]')
		const input = w.get('input')
		expect(label.text()).toBe('Start date')
		expect(input.attributes('id')).toBeTruthy()
		expect(input.attributes('id')).toBe(label.attributes('for'))
		expect(input.attributes('aria-label')).toBeUndefined()
		w.unmount()
	})
})

describe('SettingsFields points each stacked label at its input', () => {
	it.each([
		{ name: 'notes', label: 'Notes', type: 'textarea' },
		{ name: 'bio', label: 'Bio', type: 'text', fullWidth: true },
		{ name: 'api_secret', label: 'API secret', type: 'password', secret: true },
	] as SettingsField[])('$type', async (field) => {
		const w = await mountFields([{ ...field, description: 'Help.' }])

		const input = w.get('textarea, input')
		const description = w.get('[data-slot="description"]')
		expect(input.attributes('id')).toBeTruthy()
		expect(w.get('label').attributes('for')).toBe(input.attributes('id'))
		expect(input.attributes('aria-describedby')).toBe(
			description.attributes('id')
		)
		w.unmount()
	})
})
