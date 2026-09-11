/**
 * EmailAccountDefaults: the Communication > General pickers that set the
 * same two site-wide defaults the Email Accounts list's row menu already
 * offers. Both go through `set_default_email_account`; this file only
 * covers the picker, not the list (see emailAccountDefaults.test.ts for the
 * list's own badge logic, and emailAccountForm.test.ts-adjacent files for
 * the form).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const server = vi.hoisted(() => ({
	accounts: [] as Record<string, unknown>[],
	fail: false,
	calls: [] as { method: string; params: unknown }[],
}))

vi.mock('frappe-ui', () => ({
	call: (method: string, params: unknown) => {
		server.calls.push({ method, params })
		if (server.fail) return Promise.reject({ messages: ['Could not save'] })
		return Promise.resolve({})
	},
	toast: { error: vi.fn(), success: vi.fn() },
	Combobox: {
		name: 'ComboboxStub',
		props: ['modelValue', 'options', 'disabled', 'placeholder'],
		emits: ['update:modelValue'],
		template: `<div :data-testid="$attrs['aria-label']" :data-value="modelValue" :data-disabled="disabled">
			<button
				v-for="o in options"
				:key="o.value"
				:data-option="o.value"
				@click="$emit('update:modelValue', o.value)"
			/>
			<button data-clear @click="$emit('update:modelValue', null)" />
		</div>`,
	},
	Tooltip: {
		name: 'TooltipStub',
		props: ['text'],
		template: `<div :data-tooltip="text"><slot /></div>`,
	},
}))

vi.mock('@/utils', () => ({
	cleanError: (message: unknown) =>
		typeof message === 'string' ? message : String(message),
	validateEmail: (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e),
}))

vi.mock('@/utils/dialogs', () => ({ createDialog: vi.fn() }))

vi.mock('@/composables/useSettingsListResource', () => ({
	reloadSettingsLists: vi.fn(() => Promise.resolve()),
	useSettingsMethodResource: () => ({
		rows: server.accounts,
		loading: false,
		hasNextPage: false,
		loadMore: vi.fn(() => Promise.resolve()),
		reload: vi.fn(() => Promise.resolve()),
	}),
}))

vi.stubGlobal('__', (s: string) => s)

import EmailAccountDefaults from '@/components/Settings/EmailAccount/EmailAccountDefaults.vue'
import { EMAIL_ACCOUNT_METHODS } from '@/components/Settings/EmailAccount/emailAccounts'

const account = (over: Record<string, unknown> = {}) => ({
	name: 'EA-1',
	email_account_name: 'Support',
	email_id: 'support@example.com',
	enable_incoming: 1,
	enable_outgoing: 1,
	default_incoming: 0,
	default_outgoing: 0,
	...over,
})

const mountOptions = { global: { mocks: { __: (s: string) => s } } }

const panel = () => mount(EmailAccountDefaults, mountOptions)

const boxNamed = (w: ReturnType<typeof panel>, label: string) =>
	w.get(`[data-testid="${label}"]`)

beforeEach(() => {
	server.accounts = []
	server.fail = false
	server.calls = []
})

describe('the default pickers', () => {
	it('shows the account already holding each default', () => {
		server.accounts = [
			account({
				name: 'EA-1',
				email_account_name: 'Support',
				default_incoming: 1,
			}),
			account({
				name: 'EA-2',
				email_account_name: 'Sales',
				default_outgoing: 1,
			}),
		]

		const w = panel()

		expect(
			boxNamed(w, 'Default Incoming account').attributes('data-value')
		).toBe('EA-1')
		expect(
			boxNamed(w, 'Default Outgoing account').attributes('data-value')
		).toBe('EA-2')
	})

	it('shows no selection when nothing is set as default yet', () => {
		server.accounts = [account()]

		const w = panel()

		expect(
			boxNamed(w, 'Default Incoming account').attributes('data-value')
		).toBeFalsy()
		expect(
			boxNamed(w, 'Default Outgoing account').attributes('data-value')
		).toBeFalsy()
	})

	// frappe resolves a default inbox as enable_incoming AND default_incoming,
	// the same reading the list's own row menu and role badge take, so an
	// account switched off for a direction is not offered as that default.
	it('offers only accounts enabled for the matching direction', () => {
		server.accounts = [
			account({ name: 'EA-1', enable_outgoing: 0 }),
			account({ name: 'EA-2', enable_incoming: 0 }),
		]

		const w = panel()

		expect(
			boxNamed(w, 'Default Incoming account')
				.findAll('[data-option]')
				.map((b) => b.attributes('data-option'))
		).toEqual(['EA-1'])
		expect(
			boxNamed(w, 'Default Outgoing account')
				.findAll('[data-option]')
				.map((b) => b.attributes('data-option'))
		).toEqual(['EA-2'])
	})

	it('does not report a default the account cannot serve', () => {
		// Held onto from before the account's incoming side was switched off.
		server.accounts = [
			account({ default_incoming: 1, enable_incoming: 0, enable_outgoing: 1 }),
		]

		const w = panel()

		expect(
			boxNamed(w, 'Default Incoming account').attributes('data-value')
		).toBeFalsy()
	})

	it('writes the picked account through set_default_email_account', async () => {
		server.accounts = [
			account({ name: 'EA-1', email_account_name: 'Support' }),
			account({ name: 'EA-2', email_account_name: 'Sales' }),
		]
		const w = panel()

		await boxNamed(w, 'Default Incoming account')
			.get('[data-option="EA-2"]')
			.trigger('click')
		await flushPromises()

		expect(server.calls).toContainEqual({
			method: EMAIL_ACCOUNT_METHODS.setDefault,
			params: { email_account: 'EA-2', kind: 'incoming' },
		})
	})

	it('writes a picked outgoing account under its own kind', async () => {
		server.accounts = [account({ name: 'EA-1' })]
		const w = panel()

		await boxNamed(w, 'Default Outgoing account')
			.get('[data-option="EA-1"]')
			.trigger('click')
		await flushPromises()

		expect(server.calls).toContainEqual({
			method: EMAIL_ACCOUNT_METHODS.setDefault,
			params: { email_account: 'EA-1', kind: 'outgoing' },
		})
	})

	it('clears the default when the picker is cleared', async () => {
		server.accounts = [account({ name: 'EA-1', default_incoming: 1 })]
		const w = panel()

		await boxNamed(w, 'Default Incoming account')
			.get('[data-clear]')
			.trigger('click')
		await flushPromises()

		expect(server.calls).toContainEqual({
			method: EMAIL_ACCOUNT_METHODS.setDefault,
			params: { email_account: '', kind: 'incoming' },
		})
	})

	it('reports a refused write instead of leaving it silent', async () => {
		server.accounts = [account({ name: 'EA-1' })]
		server.fail = true
		const { toast } = await import('frappe-ui')
		const w = panel()

		await boxNamed(w, 'Default Incoming account')
			.get('[data-option="EA-1"]')
			.trigger('click')
		await flushPromises()

		expect(toast.error).toHaveBeenCalledWith('Could not save')
	})

	it('does not crash with no email accounts yet', async () => {
		server.accounts = []

		const w = panel()
		await flushPromises()

		const box = boxNamed(w, 'Default Incoming account')
		expect(box.attributes('data-disabled')).toBe('true')
		expect(box.element.parentElement?.getAttribute('data-tooltip')).toBe(
			'Add an email account to set one as your default.'
		)
	})
})
