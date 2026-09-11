/**
 * EmailAccountForm's provider picker on the isNew screen: pick a provider
 * from the grid, and its logo, name and one-line description take over the
 * spot the grid held, with a Change control back to it. SettingsFields is
 * stubbed -- its own rendering is covered by settingsFieldsRequired.test.ts
 * and by emailAccountFormSections.test.ts's assertions on the section shape
 * this form hands it.
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

vi.mock('frappe-ui', () => ({
	call: vi.fn(() => Promise.resolve(null)),
	toast: { success: vi.fn(), error: vi.fn() },
	Button: {
		props: ['label', 'variant'],
		emits: ['click'],
		template: `<button :data-testid="$attrs['data-testid']" @click="$emit('click')">{{ label }}</button>`,
	},
	ErrorMessage: {
		props: ['message'],
		template: `<div data-testid="error">{{ message }}</div>`,
	},
}))
vi.mock('frappe-ui/frappe', () => ({
	useTelemetry: () => ({ capture: vi.fn() }),
}))
vi.mock('@/components/Layouts/settings/desktop/SettingsLayout.vue', () => ({
	default: {
		props: ['title', 'showBack', 'unsaved', 'saveLabel', 'saving', 'canSave'],
		emits: ['back', 'save'],
		template: `<div :data-title="title"><slot /></div>`,
	},
}))
vi.mock('@/components/Layouts/settings/desktop/SettingsFields.vue', () => ({
	default: {
		props: ['sections', 'data', 'flush'],
		template: `<div data-testid="settings-fields" />`,
	},
}))
vi.mock('@/utils/safeUrl', () => ({ safeUrl: (url: string) => url }))

vi.stubGlobal('__', (text: string) => text)
;(String.prototype as any).format ??= function (...args: string[]) {
	return args.reduce(
		(out: string, arg: string, i: number) => out.replace(`{${i}}`, arg),
		String(this)
	)
}

import EmailAccountForm from '@/components/Settings/EmailAccount/EmailAccountForm.vue'

const mountForm = () =>
	mount(EmailAccountForm, {
		props: { name: 'new' },
		global: { mocks: { __: (s: string) => s } },
	})

describe('the isNew provider picker', () => {
	it('shows every provider and no fields before one is picked', () => {
		const w = mountForm()

		expect(w.find('[data-testid="provider-GMail"]').exists()).toBe(true)
		expect(w.find('[data-testid="provider-Custom"]').exists()).toBe(true)
		expect(w.find('[data-testid="settings-fields"]').exists()).toBe(false)
	})

	it('shows the picked provider prominently and steps the grid aside', async () => {
		const w = mountForm()

		await w.get('[data-testid="provider-SparkPost"]').trigger('click')

		expect(w.find('[data-testid="provider-GMail"]').exists()).toBe(false)
		expect(w.text()).toContain('SparkPost')
		expect(w.text()).toContain('Send through your SparkPost account')
		expect(w.find('[data-testid="settings-fields"]').exists()).toBe(true)
	})

	it('Change returns to the picker grid', async () => {
		const w = mountForm()

		await w.get('[data-testid="provider-GMail"]').trigger('click')
		await w.get('[data-testid="change-provider"]').trigger('click')

		expect(w.find('[data-testid="provider-GMail"]').exists()).toBe(true)
		expect(w.find('[data-testid="settings-fields"]').exists()).toBe(false)
	})

	it('every listed provider has a one-line description for the header', async () => {
		const { services } = await import(
			'@/components/Settings/EmailAccount/emailAccounts'
		)
		for (const service of services) {
			expect(service.description).toBeTruthy()
		}
	})
})
