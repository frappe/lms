/**
 * EmailAccountsEmptyState: `emailAccountsPage.emptyContent`'s component.
 * Rendered bare by SettingsList (no props, see FieldsPage.extra's same
 * contract), so it has to source `services` itself and report a pick as a
 * plain string -- the provider name -- for SettingsList to fold into `new`.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.hoisted(() => {
	// emailAccounts.ts reaches @/composables/useSettingsListResource, which
	// pulls in @/utils and, through it, plyr. Plyr touches matchMedia at
	// import time, and jsdom has none.
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
})

vi.mock('frappe-ui', () => ({ call: vi.fn(), toast: {} }))
vi.mock('@/utils/dialogs', () => ({ createDialog: vi.fn() }))
vi.mock('@/composables/useSettingsListResource', () => ({
	reloadSettingsLists: vi.fn(),
}))

vi.stubGlobal('__', (text: string) => text)
;(String.prototype as any).format ??= function (...args: string[]) {
	return args.reduce((out, arg, i) => out.replace(`{${i}}`, arg), String(this))
}

import EmailAccountsEmptyState from '@/components/Settings/EmailAccount/EmailAccountsEmptyState.vue'
import { services } from '@/components/Settings/EmailAccount/emailAccounts'

describe('EmailAccountsEmptyState', () => {
	it('shows every configured provider', () => {
		const wrapper = mount(EmailAccountsEmptyState, {
			global: { mocks: { __: (s: string) => s } },
		})

		for (const service of services) {
			expect(
				wrapper.find(`[data-testid="provider-${service.name}"]`).exists()
			).toBe(true)
		}
	})

	it("emits pick with the provider's name, not the whole service object", async () => {
		const wrapper = mount(EmailAccountsEmptyState, {
			global: { mocks: { __: (s: string) => s } },
		})

		await wrapper.get('[data-testid="provider-GMail"]').trigger('click')

		expect(wrapper.emitted('pick')?.[0]).toEqual(['GMail'])
	})
})
