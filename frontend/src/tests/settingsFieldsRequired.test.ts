/**
 * SettingsFields' required marker. `reqd` already reached the underlying
 * control (FormControl's `required` prop enforces it and, where FormControl
 * draws its own `label`, shows a `*`), but SettingsFields draws every field's
 * label itself, outside of that prop, so a required field looked identical
 * to an optional one until you focused it. This is the fix, and it reaches
 * every settings page that renders through SettingsFields, not just Email
 * Accounts.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
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

const mountFields = async (fields: SettingsField[]) => {
	const SettingsFields = (
		await import('@/components/Layouts/settings/desktop/SettingsFields.vue')
	).default
	return mount(SettingsFields, {
		props: { sections: [{ fields }], data: {} },
		global: { mocks: { __: (s: string) => s } },
	})
}

describe('SettingsFields marks a required field', () => {
	it('adds * beside a required field in the default row layout', async () => {
		const w = await mountFields([
			{ name: 'account_name', label: 'Account name', type: 'text', reqd: true },
			{ name: 'nickname', label: 'Nickname', type: 'text' },
		])

		expect(w.findAll('.text-ink-red-6')).toHaveLength(1)
		expect(w.text()).toContain('Account name')
		expect(w.text()).toContain('Nickname')
	})

	it('adds no * for a field that does not declare reqd', async () => {
		const w = await mountFields([
			{ name: 'nickname', label: 'Nickname', type: 'text' },
		])

		expect(w.find('.text-ink-red-6').exists()).toBe(false)
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

		expect(w.findAll('.text-ink-red-6')).toHaveLength(1)
	})

	it('marks a required textarea field', async () => {
		const w = await mountFields([
			{ name: 'notes', label: 'Notes', type: 'textarea', reqd: true },
		])

		expect(w.findAll('.text-ink-red-6')).toHaveLength(1)
	})

	it('does not mark an optional checkbox, and still renders it', async () => {
		const w = await mountFields([
			{ name: 'enabled', label: 'Enabled', type: 'checkbox' },
		])

		expect(w.find('.text-ink-red-6').exists()).toBe(false)
		expect(w.text()).toContain('Enabled')
	})
})
