/**
 * Tests for EmailEdit.vue — edit an existing email account.
 *
 * Focus: a no-op save (nothing changed) short-circuits to a toast with NO
 * network call, renaming routes through rename_doc, and spamming Update issues
 * the work exactly once.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import EmailEdit from '@/components/Settings/EmailAccount/EmailEdit.vue'

const { callMock, toastMock, listReload } = vi.hoisted(() => ({
	callMock: vi.fn(),
	toastMock: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
	listReload: vi.fn(),
}))

vi.mock('frappe-ui', () => ({
	call: callMock,
	toast: toastMock,
	createListResource: () => ({ reload: listReload }),
	Button: {
		props: ['label', 'loading'],
		emits: ['click'],
		template: `<button :data-testid="'btn-' + label" @click="$emit('click')">{{ label }}</button>`,
	},
	ErrorMessage: { props: ['message'], template: `<div>{{ message }}</div>` },
	FormControl: {
		props: ['modelValue', 'label', 'name', 'type', 'placeholder', 'required'],
		emits: ['update:modelValue'],
		template: `<input :data-testid="'field-' + name" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
	},
	Switch: {
		props: ['modelValue', 'label', 'description', 'size'],
		emits: ['update:modelValue'],
		template: `<button :data-testid="'switch-' + label" @click="$emit('update:modelValue', !modelValue)" />`,
	},
	Dialog: {
		props: ['open', 'title', 'message', 'actions'],
		template: `<div v-if="open" data-testid="dialog">
			<button v-for="a in actions" :key="a.label" :data-testid="'dlg-' + a.label" @click="a.onClick()">{{ a.label }}</button>
		</div>`,
	},
}))

vi.mock('@/components/Layouts/SettingsLayout.vue', () => ({
	default: { template: `<div><slot name="header-actions" /><slot /></div>` },
}))

// @/utils pulls in plyr, which touches window.matchMedia at import time.
vi.mock('@/utils', () => ({ cleanError: (e: unknown) => e }))

vi.mock('@/components/Settings/EmailAccount/emailConfig', () => {
	const fixed = [
		{
			label: 'Account name',
			name: 'email_account_name',
			type: 'text',
			required: true,
		},
		{ label: 'Email ID', name: 'email_id', type: 'email', required: true },
	]
	return {
		services: [
			{ name: 'GMail', icon: 'g', info: 'i', link: '#', custom: false },
		],
		popularProviderFields: [
			...fixed,
			{ label: 'Password', name: 'password', type: 'password', required: true },
		],
		frappeMailFields: fixed,
		incomingOutgoingFields: [
			{ label: 'Enable Incoming', name: 'enable_incoming', description: 'd' },
			{ label: 'Enable Outgoing', name: 'enable_outgoing', description: 'd' },
			{ label: 'Default Incoming', name: 'default_incoming', description: 'd' },
			{ label: 'Default Outgoing', name: 'default_outgoing', description: 'd' },
		],
		validateInputs: () => '',
	}
})

vi.stubGlobal('__', (s: string) => s)
// `String.prototype.format` is a frappe global used by the delete dialog title.
// @ts-expect-error augmenting String for the test runtime
String.prototype.format = function (...args: unknown[]) {
	return this.replace(/\{(\d+)\}/g, (_m: string, i: number) => String(args[i]))
}

// An account whose values exactly match EmailEdit's state initialisation, so a
// save with no edits is genuinely a no-op (isDirty === false).
const account = () => ({
	email_account_name: 'Support',
	service: 'GMail',
	email_id: 'support@example.com',
	api_key: null,
	api_secret: null,
	password: 'pw',
	frappe_mail_site: '',
	enable_incoming: false,
	enable_outgoing: true,
	default_incoming: false,
	default_outgoing: false,
})

const mountEdit = (accountData = account()) =>
	mount(EmailEdit, {
		props: { accountData },
		global: { mocks: { __: (s: string) => s } },
	})

const clickUpdate = async (w: any) => {
	await w.get('[data-testid="btn-Update Account"]').trigger('click')
	await flushPromises()
}

const calls = (method: string) =>
	callMock.mock.calls.filter((c) => c[0] === method)

beforeEach(() => {
	callMock.mockReset()
	callMock.mockResolvedValue({ name: 'Support' })
	toastMock.success.mockReset()
	toastMock.info.mockReset()
	listReload.mockReset()
})

describe('EmailEdit — no-op', () => {
	it('toasts "No changes made" and makes no call when nothing changed', async () => {
		const w = mountEdit()
		await clickUpdate(w)
		expect(toastMock.info).toHaveBeenCalledWith('No changes made')
		expect(callMock).not.toHaveBeenCalled()
		expect(w.emitted('update:step')).toBeFalsy()
	})
})

describe('EmailEdit — rename', () => {
	it('renames via rename_doc when only the name changed', async () => {
		const w = mountEdit()
		await w.get('[data-testid="field-email_account_name"]').setValue('Renamed')
		await clickUpdate(w)
		expect(calls('frappe.client.rename_doc')).toHaveLength(1)
		expect(calls('frappe.client.rename_doc')[0][1]).toMatchObject({
			doctype: 'Email Account',
			old_name: 'Support',
			new_name: 'Renamed',
		})
		// nothing else changed -> no set_value
		expect(calls('frappe.client.set_value')).toHaveLength(0)
		expect(w.emitted('update:step')?.[0]).toEqual(['email-list'])
		// the accounts list is reloaded so the new name shows on return
		expect(listReload).toHaveBeenCalled()
	})
})

describe('EmailEdit — double-submit', () => {
	it('spamming Update runs the save once', async () => {
		const w = mountEdit()
		// make it dirty so it actually saves
		await w.get('[data-testid="switch-Enable Incoming"]').trigger('click')
		const btn = w.get('[data-testid="btn-Update Account"]')
		btn.trigger('click')
		btn.trigger('click')
		btn.trigger('click')
		await flushPromises()
		expect(calls('frappe.client.set_value')).toHaveLength(1)
	})
})
