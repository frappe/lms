/**
 * EmailProviderPicker: the bordered-card grid both the New Email Account
 * form's picker step and the Email Accounts list's empty state draw from.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { EmailService } from '@/types'

vi.stubGlobal('__', (text: string) => text)
;(String.prototype as any).format ??= function (...args: string[]) {
	return args.reduce((out, arg, i) => out.replace(`{${i}}`, arg), String(this))
}

import EmailProviderPicker from '@/components/Settings/EmailAccount/EmailProviderPicker.vue'

const GMAIL: EmailService = {
	name: 'GMail',
	icon: '/gmail.png',
	description: 'Send and receive through your Gmail account',
	info: 'info',
	link: 'https://example.com',
	custom: false,
}

const CUSTOM: EmailService = {
	name: 'Custom',
	icon: '',
	description: 'Connect any IMAP/POP3 and SMTP server',
	info: 'info',
	link: 'https://example.com',
	custom: true,
}

const build = (services: EmailService[] = [GMAIL, CUSTOM]) =>
	mount(EmailProviderPicker, {
		props: { services },
		global: { mocks: { __: (s: string) => s } },
	})

describe('EmailProviderPicker', () => {
	it('renders one card per service, named for the test hooks the form relies on', () => {
		const wrapper = build()

		expect(wrapper.find('[data-testid="provider-GMail"]').exists()).toBe(true)
		expect(wrapper.find('[data-testid="provider-Custom"]').exists()).toBe(true)
	})

	it('shows every service name as visible text', () => {
		const wrapper = build()

		expect(wrapper.text()).toContain('GMail')
		expect(wrapper.text()).toContain('Custom')
	})

	it('emits pick with the full service on click', async () => {
		const wrapper = build()

		await wrapper.get('[data-testid="provider-GMail"]').trigger('click')

		expect(wrapper.emitted('pick')?.[0]).toEqual([GMAIL])
	})

	it('draws a logo image for a service that has one', () => {
		const wrapper = build()
		const card = wrapper.get('[data-testid="provider-GMail"]')

		expect(card.find('img').attributes('src')).toBe('/gmail.png')
		expect(card.find('.lucide-mail').exists()).toBe(false)
	})

	it('falls back to a mail icon for Custom Server, whose icon is blank', () => {
		const wrapper = build()
		const card = wrapper.get('[data-testid="provider-Custom"]')

		expect(card.find('img').exists()).toBe(false)
		expect(card.find('.lucide-mail').exists()).toBe(true)
	})

	it('renders nothing when handed no services', () => {
		const wrapper = build([])

		expect(wrapper.findAll('button')).toHaveLength(0)
	})
})
