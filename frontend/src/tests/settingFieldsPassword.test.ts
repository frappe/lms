/**
 * SettingFields renders every `password` field through frappe-ui's Password,
 * so a secret gets a masked box with a reveal toggle instead of a bare
 * `type="password"` input.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.hoisted(() => {
	// SettingFields reaches @/utils, which pulls in plyr. Plyr touches
	// matchMedia at import time, and jsdom has none.
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
})

vi.stubGlobal('__', (text: string) => text)

const mountFields = async (
	fields: Record<string, unknown>[],
	data: Record<string, unknown> = {}
) => {
	const SettingFields = (
		await import('@/components/Settings/SettingFields.vue')
	).default
	return mount(SettingFields, {
		props: { sections: [{ columns: [{ fields }] }], data },
		global: { mocks: { __: (s: string) => s } },
	})
}

describe('SettingFields renders a password field as Password', () => {
	it('masks a password field and offers a reveal toggle', async () => {
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
})
