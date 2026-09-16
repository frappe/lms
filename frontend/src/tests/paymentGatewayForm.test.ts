/**
 * Tests for PaymentGatewayForm.vue.
 *
 * Two bugs, both user-reported:
 *
 * 1. Creating a gateway left the draft holding what was typed. `isDirty` reads
 *    the draft while creating, so the dirty guard stopped the form on its way
 *    out and offered to discard changes that were already saved.
 * 2. Credentials rendered in clear text. The form routed on the Frappe
 *    fieldtype, and GoCardless declares `access_token` / `webhooks_secret` as
 *    plain Data, so neither reached Password.
 */
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

const { calls, dirtyChecks } = vi.hoisted(() => ({
	calls: { value: [] as { method: string; args: any }[] },
	dirtyChecks: { value: [] as (() => boolean)[] },
}))

// GoCardless as the site actually ships it: two secrets typed as Data.
const GOCARDLESS_FIELDS = [
	{ name: 'gateway_name', label: 'Payment Gateway Name', type: 'Data', reqd: 1 },
	{ name: 'access_token', label: 'Access Token', type: 'Data', reqd: 1 },
	{ name: 'webhooks_secret', label: 'Webhooks Secret', type: 'Data' },
	{ name: 'use_sandbox', label: 'Use Sandbox', type: 'checkbox', default: '0' },
]

// Stripe as the site ships it. `publishable_key` is Data and is meant to be:
// it is published to the browser by design.
const STRIPE_FIELDS = [
	{ name: 'gateway_name', label: 'Payment Gateway Name', type: 'Data', reqd: 1 },
	{ name: 'publishable_key', label: 'Publishable Key', type: 'Data', reqd: 1 },
	{ name: 'secret_key', label: 'Secret Key', type: 'Password', reqd: 1 },
]

vi.mock('frappe-ui', () => {
	const control = (name: string) => ({
		name,
		props: ['modelValue', 'label', 'type', 'options', 'placeholder', 'required'],
		emits: ['update:modelValue'],
		template: `<div :data-control="'${name}'" :data-field="label">
			<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />
		</div>`,
	})
	return {
		call: (method: string, args: any) => {
			calls.value.push({ method, args })
			if (method === 'frappe.client.get_list' && args.doctype === 'DocType')
				return Promise.resolve([
					{ name: 'GoCardless Settings', issingle: 0 },
					{ name: 'Stripe Settings', issingle: 0 },
				])
			if (method === 'frappe.client.get_list') return Promise.resolve([])
			if (method === 'lms.lms.api.get_new_gateway_fields')
				return Promise.resolve(
					args.doctype === 'Stripe Settings'
						? STRIPE_FIELDS
						: GOCARDLESS_FIELDS
				)
			return Promise.resolve(null)
		},
		createDocumentResource: () => ({ doc: {}, isDirty: false }),
		toast: { success: vi.fn(), error: vi.fn() },
		FormControl: control('FormControl'),
		Password: control('Password'),
		Combobox: {
			name: 'Combobox',
			props: ['modelValue', 'options'],
			emits: ['update:modelValue'],
			template: '<div data-testid="provider" />',
		},
		LoadingIndicator: { template: '<div />' },
		Switch: {
			name: 'Switch',
			props: ['modelValue'],
			emits: ['update:modelValue'],
			template: '<button data-testid="switch" />',
		},
	}
})

vi.mock('@/components/Layouts/settings/desktop/SettingsLayout.vue', () => ({
	default: {
		props: ['title', 'unsaved', 'canSave', 'saving', 'saveLabel', 'showBack'],
		emits: ['save', 'back'],
		template: `<div>
			<button data-testid="save" @click="$emit('save')" />
			<slot />
		</div>`,
	},
}))

vi.mock('@/components/Controls/ImageUploadField.vue', () => ({
	default: { template: '<div />' },
}))

// The guard registers a checker; that checker is exactly what the router reads
// in beforeEach, so asserting on it is asserting on the modal.
vi.mock('@/composables/useDirtyGuard', () => ({
	useDirtyGuard: (isDirty: () => boolean) => dirtyChecks.value.push(isDirty),
}))

vi.mock('@/composables/useSettingsListResource', () => ({
	reloadSettingsLists: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/composables/useSettingsSave', () => ({
	useSaveState: () => ({ saving: ref(false) }),
	runSave: async (_state: unknown, opts: any) => {
		await opts.run()
		await opts.after?.()
	},
}))

vi.mock('@/utils', () => ({ cleanError: (e: any) => String(e) }))

vi.stubGlobal('__', (text: string) => text)

async function mountNewGateway(providerDoctype = 'GoCardless Settings') {
	calls.value = []
	dirtyChecks.value = []
	const { NEW_GATEWAY } = await import(
		'@/components/Settings/PaymentGateways/paymentGateways'
	)
	const { default: PaymentGatewayForm } = await import(
		'@/components/Settings/PaymentGateways/PaymentGatewayForm.vue'
	)
	const wrapper = mount(PaymentGatewayForm, {
		props: { name: NEW_GATEWAY },
		global: { mocks: { __: (text: string) => text } },
	})
	await flushPromises()

	// Pick GoCardless, which loads its fields and seeds the draft.
	wrapper.findComponent({ name: 'Combobox' }).vm.$emit(
		'update:modelValue',
		providerDoctype
	)
	await flushPromises()
	await nextTick()
	return wrapper
}

const controlFor = (wrapper: any, label: string) =>
	wrapper.find(`[data-field="${label}"]`).attributes('data-control')

const isDirty = () => dirtyChecks.value.some((check) => check())

describe('PaymentGatewayForm credentials', () => {
	it('masks a secret the provider declares as plain Data', async () => {
		const wrapper = await mountNewGateway()

		// Both are `Data` in GoCardless Settings; the fieldtype alone would
		// have left them readable.
		expect(controlFor(wrapper, 'Access Token')).toBe('Password')
		expect(controlFor(wrapper, 'Webhooks Secret')).toBe('Password')
	})

	it('leaves an ordinary field alone', async () => {
		const wrapper = await mountNewGateway()
		expect(controlFor(wrapper, 'Payment Gateway Name')).toBe('FormControl')
	})

	it('does not mask a key that is meant to be read', async () => {
		// Stripe publishes this one to the browser by design, as Razorpay does
		// its api_key and Braintree its public_key. Masking them would be the
		// regression, so a bare `key` must not match.
		const wrapper = await mountNewGateway('Stripe Settings')

		expect(controlFor(wrapper, 'Publishable Key')).toBe('FormControl')
		expect(controlFor(wrapper, 'Secret Key')).toBe('Password')
	})
})

describe('PaymentGatewayForm after creating', () => {
	it('is dirty once a credential is typed', async () => {
		const wrapper = await mountNewGateway()
		expect(isDirty()).toBe(false)

		await wrapper
			.find('[data-field="Payment Gateway Name"] input')
			.setValue('my-gateway')
		expect(isDirty()).toBe(true)
	})

	it('is clean again once the gateway is saved', async () => {
		const wrapper = await mountNewGateway()
		await wrapper
			.find('[data-field="Payment Gateway Name"] input')
			.setValue('my-gateway')
		expect(isDirty()).toBe(true)

		await wrapper.find('[data-testid="save"]').trigger('click')
		await flushPromises()

		// The insert happened...
		expect(
			calls.value.some((c) => c.method === 'frappe.client.insert')
		).toBe(true)
		// ...and nothing is left for the guard to stop the form over.
		expect(isDirty()).toBe(false)
	})
})
