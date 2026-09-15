/**
 * SettingsFields renders every `password` field through frappe-ui's Password,
 * so a secret gets a masked box with a reveal toggle instead of a bare
 * `type="password"` input. Covers both paths: a plain password field, which
 * lives in `data` like any other value, and a `secret` one, which is kept out
 * of `data` and reported via `@secret`.
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
		expect(input.attributes('placeholder')).toBe('Saved, leave blank to keep it')
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
