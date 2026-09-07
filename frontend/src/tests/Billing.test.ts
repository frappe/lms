/** Billing.vue: India state validation and checkout error surfacing. */
// A case-sensitive state whitelist that also omitted every union territory
// rejected "GUJARAT", and the rejection reached the user as an empty toast
// (toast.error was handed the raw Error), so the button looked dead.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import Billing from '@/pages/Billing.vue'

type BillingAddress = Record<string, unknown>
type SubmittedCall = { url: string; params: { address: BillingAddress } }

const { toastMock, submitted, unhandled } = vi.hoisted(() => ({
	toastMock: { success: vi.fn(), error: vi.fn() },
	submitted: [] as SubmittedCall[],
	unhandled: [] as unknown[],
}))

const ACCESS_URL = 'lms.lms.api.validate_billing_access'
const SUMMARY_URL = 'lms.lms.utils.get_order_summary'
const PAYMENT_URL = 'lms.lms.payments.get_payment_link'

let addressFixture: Record<string, unknown> | null = null

const FIELD_META = {
	billing_name: { reqd: 1 },
	address_line1: { reqd: 1 },
	city: { reqd: 1 },
	state: { reqd: 0 },
	country: { reqd: 1, default: 'India' },
	pincode: { reqd: 0 },
	phone: { reqd: 0 },
	source: { reqd: 0 },
	gstin: { reqd: 0 },
	pan: { reqd: 0 },
}

const SUMMARY = {
	title: 'Batch',
	original_amount_formatted: '₹ 2,000',
	gst_amount_formatted: '₹ 360',
	total_amount_formatted: '₹ 2,360',
	total_amount: 2360,
	gst_applied: 360,
}

type ResourceParams = { address: BillingAddress } & Record<string, unknown>
type ResourceHandlers = {
	validate?: (
		params: ResourceParams
	) => string | undefined | Promise<string | undefined>
	onSuccess?: (data: unknown) => void
	onError?: (error: Error) => void
}
type ResourceOptions = ResourceHandlers & {
	url: string
	params?: ResourceParams
	makeParams?: (values?: unknown) => ResourceParams
}

// Mirrors frappe-ui's resource contract closely enough for this page: makeParams
// builds the params, validate() runs after and aborts the fetch with a string
// message, and an absent onError leaves that rejection unhandled.
const createResourceMock = (opts: ResourceOptions) => {
	// reactive: the page renders off `resource.data`, so a plain object would
	// leave the template stuck on the loading branch.
	const res = reactive({
		data: null as unknown,
		loading: false,
		error: null as Error | null,
		reload: vi.fn(),
		submit: vi.fn(async (values?: unknown, handlers: ResourceHandlers = {}) => {
			const params = opts.makeParams ? opts.makeParams(values) : opts.params
			const validate = handlers.validate || opts.validate
			if (validate && params) {
				const message = await validate(params)
				if (message && typeof message === 'string') {
					const error = new Error(message)
					const handlerFns = [opts.onError, handlers.onError].filter(Boolean)
					if (!handlerFns.length) unhandled.push(error)
					handlerFns.forEach((fn) => fn?.(error))
					return
				}
			}
			submitted.push({
				url: opts.url,
				params: JSON.parse(JSON.stringify(params)),
			})
			if (opts.url === ACCESS_URL) {
				const data = {
					access: true,
					message: '',
					address: addressFixture,
					billing_field_meta: FIELD_META,
				}
				res.data = data
				opts.onSuccess?.(data)
			} else if (opts.url === SUMMARY_URL) {
				res.data = SUMMARY
			}
		}),
	})
	return res
}

vi.mock('frappe-ui', () => ({
	toast: toastMock,
	call: vi.fn(),
	usePageMeta: vi.fn(),
	createResource: (opts: ResourceOptions) => createResourceMock(opts),
	Breadcrumbs: { template: '<div />' },
	Button: {
		emits: ['click'],
		template: `<button @click="$emit('click')"><slot /></button>`,
	},
	FormControl: {
		props: [
			'modelValue',
			'label',
			'type',
			'required',
			'disabled',
			'placeholder',
		],
		emits: ['update:modelValue', 'input'],
		template: `<input
			:data-testid="'fc-' + label"
			:type="type || 'text'"
			:value="modelValue"
			@change="$emit('update:modelValue', type === 'checkbox' ? $event.target.checked : $event.target.value)"
		/>`,
	},
	Combobox: {
		props: ['modelValue', 'options', 'label', 'required', 'placeholder'],
		emits: ['update:modelValue'],
		template: `<select
			:data-testid="'combobox-' + label"
			:value="modelValue"
			@change="$emit('update:modelValue', $event.target.value)"
		>
			<option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
		</select>`,
	},
}))

vi.mock('frappe-ui/frappe', () => ({
	useTelemetry: () => ({ capture: vi.fn() }),
}))
vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ brand: { favicon: '' } }),
}))
vi.mock('@/components/NotPermitted.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/Controls/Link.vue', () => ({
	default: {
		props: ['value', 'doctype', 'label', 'required'],
		emits: ['change'],
		template: `<select
			:data-testid="'link-' + label"
			:value="value"
			@change="$emit('change', $event.target.value)"
		/>`,
	},
}))
vi.mock('@/utils/basePath', () => ({ getLmsRoute: (r: string) => `/lms/${r}` }))

vi.stubGlobal('__', (s: string) => s)

const address = (over: Record<string, unknown> = {}) => ({
	billing_name: 'Channeltech Systems Pvt Ltd',
	address_line1: 'Best Paper Mill Compound',
	address_line2: '',
	city: 'Vapi',
	state: 'Gujarat',
	country: 'India',
	pincode: '396195',
	phone: '9974447180',
	...over,
})

const mountBilling = async (over: Record<string, unknown> = {}) => {
	addressFixture = address(over)
	const wrapper = mount(Billing, {
		props: { type: 'batch', name: 'BATCH-01' },
		global: {
			provide: { $user: { data: { name: 'a@b.c' } } },
			mocks: { __: (s: string) => s },
			stubs: { RouterLink: true },
		},
	})
	await flushPromises()
	return wrapper
}

const consent = async (wrapper: VueWrapper) => {
	const box = wrapper
		.findAll('input[type="checkbox"]')
		.find((i) => i.attributes('data-testid')?.includes('consent'))
	if (!box) throw new Error('consent checkbox not rendered')
	await box.setValue(true)
}

const proceed = async (wrapper: VueWrapper) => {
	const button = wrapper
		.findAll('button')
		.find((b) => b.text().includes('Proceed to Payment'))
	if (!button) throw new Error('checkout button not rendered')
	await button.trigger('click')
	await flushPromises()
}

const checkout = () => submitted.find((s) => s.url === PAYMENT_URL)

const checkoutAddress = () => {
	const call = checkout()
	if (!call) throw new Error('checkout was never submitted')
	return call.params.address
}

describe('Billing: India state field', () => {
	beforeEach(() => {
		submitted.length = 0
		unhandled.length = 0
		vi.clearAllMocks()
	})

	it('offers the canonical states as options instead of free text', async () => {
		const wrapper = await mountBilling()
		const select = wrapper.find('[data-testid="combobox-State/Province"]')
		expect(select.exists()).toBe(true)
		expect(wrapper.find('[data-testid="fc-State/Province"]').exists()).toBe(
			false
		)

		const options = select.findAll('option').map((o) => o.text())
		expect(options).toContain('Gujarat')
		// Union territories were missing from the original list, so anyone in one
		// of them could not check out at all.
		expect(options).toEqual(
			expect.arrayContaining([
				'Chandigarh',
				'Puducherry',
				'Ladakh',
				'Lakshadweep',
				'Andaman and Nicobar Islands',
				'Dadra and Nagar Haveli and Daman and Diu',
			])
		)
	})

	it('canonicalises an all-caps saved state so checkout proceeds', async () => {
		const wrapper = await mountBilling({ state: 'GUJARAT' })
		await consent(wrapper)
		await proceed(wrapper)

		expect(toastMock.error).not.toHaveBeenCalled()
		expect(checkout()).toBeTruthy()
		expect(checkoutAddress().state).toBe('Gujarat')
	})

	it('canonicalises stray case and whitespace typed elsewhere', async () => {
		const wrapper = await mountBilling({ state: '  tamil nadu ' })
		await consent(wrapper)
		await proceed(wrapper)

		expect(checkout()).toBeTruthy()
		expect(checkoutAddress().state).toBe('Tamil Nadu')
	})

	it('accepts a union territory', async () => {
		const wrapper = await mountBilling({ state: 'Chandigarh' })
		await consent(wrapper)
		await proceed(wrapper)

		expect(checkout()).toBeTruthy()
		expect(checkoutAddress().state).toBe('Chandigarh')
	})

	it('still blocks a state that is not a real one', async () => {
		const wrapper = await mountBilling({ state: 'Gujrat' })
		await consent(wrapper)
		await proceed(wrapper)

		expect(checkout()).toBeFalsy()
		expect(toastMock.error).toHaveBeenCalled()
	})

	it('keeps the state as free text outside India', async () => {
		const wrapper = await mountBilling({ country: 'Germany', state: 'Bayern' })
		await consent(wrapper)
		await proceed(wrapper)

		expect(wrapper.find('[data-testid="fc-State/Province"]').exists()).toBe(
			true
		)
		expect(checkout()).toBeTruthy()
		expect(checkoutAddress().state).toBe('Bayern')
	})
})

describe('Billing: checkout validation errors reach the user', () => {
	beforeEach(() => {
		submitted.length = 0
		unhandled.length = 0
		vi.clearAllMocks()
	})

	it('toasts readable text for the missing-consent error', async () => {
		const wrapper = await mountBilling()
		await proceed(wrapper)

		expect(checkout()).toBeFalsy()
		// An unhandled validation rejection would mean no feedback at all.
		expect(unhandled).toHaveLength(0)
		// Passing the Error object straight to toast.error renders an empty toast.
		expect(toastMock.error).toHaveBeenCalledWith(
			'Please provide your consent to proceed with the payment.'
		)
	})

	it('toasts readable text for an invalid state', async () => {
		const wrapper = await mountBilling({ state: 'Gujrat' })
		await consent(wrapper)
		await proceed(wrapper)

		expect(toastMock.error).toHaveBeenCalledWith(
			expect.stringContaining('state')
		)
	})
})
