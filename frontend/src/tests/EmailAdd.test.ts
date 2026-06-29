/**
 * Tests for EmailAdd.vue — the "create an email account" form.
 *
 * Focus: the payload sent to `create_email_account` is correct (canonical
 * service name + incoming/outgoing booleans, password vs Frappe-Mail api keys),
 * validation blocks the request, and — the important one — spamming the Create
 * button fires exactly ONE submit (no double insertion).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import EmailAdd from '@/components/Settings/EmailAccount/EmailAdd.vue'

// Last createResource instance + a settable validateInputs return, shared with
// the mock factories below.
const { lastResource, validateReturn, listReload } = vi.hoisted(() => ({
	lastResource: { value: null as any },
	validateReturn: { value: '' as string },
	listReload: vi.fn(),
}))

vi.mock('frappe-ui', () => ({
	createResource: (config: any) => {
		const res: any = { loading: false, config }
		res.submit = vi.fn(() => {
			res.loading = true // mimic createResource flipping loading on submit
		})
		lastResource.value = res
		return res
	},
	createListResource: () => ({ reload: listReload }),
	toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
	Button: {
		props: ['label', 'loading'],
		emits: ['click'],
		template: `<button :data-testid="'btn-' + label" @click="$emit('click')">{{ label }}</button>`,
	},
	ErrorMessage: {
		props: ['message'],
		template: `<div data-testid="error">{{ message }}</div>`,
	},
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
}))

vi.mock('frappe-ui/frappe', () => ({
	useTelemetry: () => ({ capture: vi.fn() }),
}))

vi.mock('@/components/Layouts/SettingsLayout.vue', () => ({
	default: {
		template: `<div><slot name="header-actions" /><slot /></div>`,
	},
}))

vi.mock('@/components/Settings/EmailAccount/EmailProviderIcon.vue', () => ({
	default: {
		props: ['serviceName', 'logo', 'selected'],
		template: `<div :data-testid="'provider-' + serviceName" />`,
	},
}))

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
			{ name: 'GMail', icon: 'gmail.png', info: 'i', link: '#', custom: false },
			{
				name: 'Frappe Mail',
				icon: 'fm.svg',
				info: 'i',
				link: '#',
				custom: false,
			},
		],
		popularProviderFields: [
			...fixed,
			{ label: 'Password', name: 'password', type: 'password', required: true },
		],
		frappeMailFields: [
			...fixed,
			{
				label: 'Frappe Mail site',
				name: 'frappe_mail_site',
				type: 'text',
				required: true,
			},
			{ label: 'API Key', name: 'api_key', type: 'text', required: true },
			{
				label: 'API Secret',
				name: 'api_secret',
				type: 'password',
				required: true,
			},
		],
		incomingOutgoingFields: [
			{ label: 'Enable Incoming', name: 'enable_incoming', description: 'd' },
			{ label: 'Enable Outgoing', name: 'enable_outgoing', description: 'd' },
			{ label: 'Default Incoming', name: 'default_incoming', description: 'd' },
			{ label: 'Default Outgoing', name: 'default_outgoing', description: 'd' },
		],
		emailIcon: { GMail: 'gmail.png', 'Frappe Mail': 'fm.svg' },
		validateInputs: () => validateReturn.value,
	}
})

vi.stubGlobal('__', (s: string) => s)
// EmailAdd's createResource onSuccess uses window.__
;(globalThis as any).window.__ = (s: string) => s

const mountAdd = () =>
	mount(EmailAdd, { global: { mocks: { __: (s: string) => s } } })

const selectProvider = async (w: any, name: string) =>
	w.get(`[data-testid="provider-${name}"]`).trigger('click')

const setField = async (w: any, name: string, value: string) =>
	w.get(`[data-testid="field-${name}"]`).setValue(value)

const clickCreate = async (w: any) => {
	await w.get('[data-testid="btn-Create"]').trigger('click')
	await flushPromises()
}

beforeEach(() => {
	lastResource.value = null
	validateReturn.value = ''
	listReload.mockReset()
})

describe('EmailAdd — payload', () => {
	it('sends canonical service name, password, and incoming/outgoing defaults', async () => {
		const w = mountAdd()
		await selectProvider(w, 'GMail')
		await setField(w, 'email_account_name', 'Support')
		await setField(w, 'email_id', 'support@example.com')
		await setField(w, 'password', 'app-pass')
		await clickCreate(w)

		expect(lastResource.value.submit).toHaveBeenCalledTimes(1)
		expect(lastResource.value.submit.mock.calls[0][0]).toEqual({
			data: {
				email_account_name: 'Support',
				email_id: 'support@example.com',
				service: 'GMail',
				enable_incoming: false,
				enable_outgoing: true,
				default_incoming: false,
				default_outgoing: false,
				password: 'app-pass',
			},
		})
	})

	it('reloads the accounts list after a successful create', async () => {
		const w = mountAdd()
		await selectProvider(w, 'GMail')
		await setField(w, 'email_account_name', 'Support')
		await setField(w, 'email_id', 'support@example.com')
		await setField(w, 'password', 'app-pass')
		await clickCreate(w)
		// simulate the server responding successfully
		lastResource.value.config.onSuccess()
		expect(listReload).toHaveBeenCalled()
		expect(w.emitted('update:step')?.[0]).toEqual(['email-list'])
	})

	it('reflects an enabled incoming toggle in the payload', async () => {
		const w = mountAdd()
		await selectProvider(w, 'GMail')
		await setField(w, 'email_account_name', 'Support')
		await setField(w, 'email_id', 'support@example.com')
		await setField(w, 'password', 'app-pass')
		await w.get('[data-testid="switch-Enable Incoming"]').trigger('click')
		await clickCreate(w)
		expect(
			lastResource.value.submit.mock.calls[0][0].data.enable_incoming,
		).toBe(true)
	})

	it('Frappe Mail sends api credentials and no password', async () => {
		const w = mountAdd()
		await selectProvider(w, 'Frappe Mail')
		await setField(w, 'email_account_name', 'Frappe')
		await setField(w, 'email_id', 'support@example.com')
		await setField(w, 'frappe_mail_site', 'https://frappemail.com')
		await setField(w, 'api_key', 'key-123')
		await setField(w, 'api_secret', 'secret-456')
		await clickCreate(w)

		const payload = lastResource.value.submit.mock.calls[0][0].data
		expect(payload.service).toBe('Frappe Mail')
		expect(payload.api_key).toBe('key-123')
		expect(payload.api_secret).toBe('secret-456')
		expect(payload.frappe_mail_site).toBe('https://frappemail.com')
		expect(payload.password).toBeUndefined()
	})
})

describe('EmailAdd — validation and double-submit', () => {
	it('does not submit when validateInputs returns an error', async () => {
		validateReturn.value = 'Account name is required'
		const w = mountAdd()
		await selectProvider(w, 'GMail')
		await clickCreate(w)
		expect(lastResource.value.submit).not.toHaveBeenCalled()
		expect(w.get('[data-testid="error"]').text()).toBe(
			'Account name is required',
		)
	})

	it('spamming Create submits exactly once (no double insertion)', async () => {
		const w = mountAdd()
		await selectProvider(w, 'GMail')
		await setField(w, 'email_account_name', 'Support')
		await setField(w, 'email_id', 'support@example.com')
		await setField(w, 'password', 'app-pass')
		// fire both clicks before the first submit's loading state clears
		const btn = w.get('[data-testid="btn-Create"]')
		btn.trigger('click')
		btn.trigger('click')
		btn.trigger('click')
		await flushPromises()
		expect(lastResource.value.submit).toHaveBeenCalledTimes(1)
	})
})
