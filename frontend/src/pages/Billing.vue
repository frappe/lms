<template>
	<PageHeader :breadcrumbs="breadcrumbs" />
	<PageBody :title="__('Billing Details')">
		<div v-if="access.data?.access && orderSummary.data" class="px-5 pb-10">
			<div class="flex flex-col lg:flex-row justify-between">
				<div class="flex flex-col lg:order-last mb-10 lg:mt-10 lg:w-1/4">
					<div class="h-fit bg-surface-gray-2 rounded-md p-5 space-y-4">
						<div class="space-y-1">
							<div class="text-ink-gray-5 uppercase text-xs">
								{{ __('Payment for ') }} {{ type }}:
							</div>
							<div class="leading-5 text-ink-gray-9">
								{{ orderSummary.data.title }}
							</div>
						</div>
						<div
							v-if="
								orderSummary.data.gst_applied ||
								orderSummary.data.discount_amount
							"
							class="space-y-1"
						>
							<div class="text-ink-gray-5 uppercase text-xs">
								{{ __('Original Amount') }}:
							</div>
							<div class="text-ink-gray-9">
								{{ orderSummary.data.original_amount_formatted }}
							</div>
						</div>
						<div v-if="orderSummary.data.discount_amount" class="space-y-1">
							<div class="text-ink-gray-5">{{ __('Discount') }}:</div>
							<div>- {{ orderSummary.data.discount_amount_formatted }}</div>
						</div>
						<div v-if="orderSummary.data.gst_applied" class="space-y-1">
							<div class="text-ink-gray-5 uppercase text-xs">
								{{ __('GST Amount') }}:
							</div>
							<div class="text-ink-gray-9">
								{{ orderSummary.data.gst_amount_formatted }}
							</div>
						</div>
						<div class="space-y-1 border-t border-outline-gray-3 pt-4 mt-2">
							<div class="uppercase text-ink-gray-5 text-xs">
								{{ __('Total') }}:
							</div>
							<div class="font-bold text-ink-gray-9">
								{{ orderSummary.data.total_amount_formatted }}
							</div>
						</div>
					</div>

					<div class="bg-surface-gray-2 rounded-md p-4 space-y-2 my-5">
						<span class="text-ink-gray-5 uppercase text-xs">
							{{ __('Enter a Coupon Code') }}:
						</span>
						<div class="flex items-center gap-x-2">
							<FormControl
								v-model="appliedCoupon"
								:disabled="orderSummary.data.discount_amount > 0"
								:aria-label="__('Coupon Code')"
								@input="appliedCoupon = $event.target.value.toUpperCase()"
								@keydown.enter="applyCouponCode"
								placeholder="COUPON2025"
								autocomplete="off"
								class="flex-1 [&_input]:bg-surface-base"
							/>
							<Button
								v-if="!orderSummary.data.discount_amount"
								@click="applyCouponCode"
								variant="outline"
							>
								{{ __('Apply') }}
							</Button>
							<Button
								v-if="orderSummary.data.discount_amount"
								:label="__('Remove coupon')"
								@click="removeCoupon"
								variant="outline"
							>
								<template #icon>
									<span class="lucide-x size-4" />
								</template>
							</Button>
						</div>
					</div>

					<p
						class="bg-surface-amber-2 text-ink-amber-5 text-sm leading-5 p-2 rounded-md"
					>
						{{
							__(
								'Please ensure that the billing name you enter is correct, as it will be used on your invoice.'
							)
						}}
					</p>
				</div>

				<div class="flex-1 lg:me-10">
					<div class="mb-5">
						<h2 class="text-lg-semibold text-ink-gray-9">
							{{ __('Address') }}
						</h2>
					</div>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
						<div class="space-y-4">
							<FormControl
								:label="__('Billing Name')"
								v-model="billingDetails.billing_name"
								:required="!!fieldMeta.billing_name?.reqd"
							/>
							<FormControl
								:label="__('Address Line 1')"
								v-model="billingDetails.address_line1"
								:required="!!fieldMeta.address_line1?.reqd"
							/>
							<FormControl
								:label="__('Address Line 2')"
								v-model="billingDetails.address_line2"
								:required="!!fieldMeta.address_line2?.reqd"
							/>
							<FormControl
								:label="__('City')"
								v-model="billingDetails.city"
								:required="!!fieldMeta.city?.reqd"
							/>
							<Combobox
								v-if="billingDetails.country == 'India'"
								:label="__('State/Province')"
								v-model="billingDetails.state"
								:options="INDIAN_STATE_OPTIONS"
								:placeholder="__('Select a state')"
								:required="!!fieldMeta.state?.reqd"
							/>
							<FormControl
								v-else
								:label="__('State/Province')"
								v-model="billingDetails.state"
								:required="!!fieldMeta.state?.reqd"
							/>
						</div>
						<div class="space-y-4">
							<Combobox
								:modelValue="billingDetails.country"
								@update:modelValue="changeCurrency"
								:options="CIS_COUNTRY_OPTIONS"
								:label="__('Country')"
								:placeholder="__('Select a country')"
								:required="!!fieldMeta.country?.reqd"
							/>
							<FormControl
								:label="__('Postal Code')"
								v-model="billingDetails.pincode"
								:required="!!fieldMeta.pincode?.reqd"
							/>
							<FormControl
								:label="__('Phone Number')"
								v-model="billingDetails.phone"
								:required="!!fieldMeta.phone?.reqd"
							/>
							<Link
								doctype="LMS Source"
								:value="billingDetails.source"
								@change="(option) => (billingDetails.source = option)"
								:label="__('Where did you hear about us?')"
								:required="!!fieldMeta.source?.reqd"
							/>
							<FormControl
								v-if="billingDetails.country == 'India'"
								:label="__('GST Number')"
								v-model="billingDetails.gstin"
								:required="!!fieldMeta.gstin?.reqd"
							/>
							<FormControl
								v-if="billingDetails.country == 'India'"
								:label="__('PAN Number')"
								v-model="billingDetails.pan"
								:required="!!fieldMeta.pan?.reqd"
							/>
						</div>
					</div>
					<fieldset v-if="!isZeroAmount" class="mt-8">
						<legend class="text-lg-semibold text-ink-gray-9">
							{{ __('Payment method') }}
						</legend>
						<p v-if="checkoutAvailability.data?.test_mode" class="mt-1 text-sm text-ink-amber-7">
							{{ __('Test mode — no real money will be charged.') }}
						</p>
						<div class="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
							<label
								v-for="method in paymentMethods"
								:key="method.value"
								:class="[
									'flex min-h-16 items-center gap-3 rounded-lg border p-3 transition-colors',
									method.enabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-50',
									selectedPaymentMethod === method.value
										? 'border-outline-gray-6 bg-surface-gray-2'
										: 'border-outline-gray-2',
								]"
							>
								<input
									type="radio"
									name="payment-method"
									:value="method.value"
									:disabled="!method.enabled"
									v-model="selectedPaymentMethod"
								/>
								<span>
									<span class="block text-sm font-medium text-ink-gray-9">{{ method.label }}</span>
									<span class="block text-xs text-ink-gray-5">{{ method.description }}</span>
								</span>
							</label>
						</div>
					</fieldset>
					<div
						class="flex flex-col lg:flex-row items-start lg:items-center justify-between border-t pt-4 mt-8 space-y-4 lg:space-y-0"
					>
						<div>
							<FormControl
								:label="
									__(
										'I consent to my personal information being stored for invoicing'
									)
								"
								type="checkbox"
								class="leading-6"
								v-model="billingDetails.member_consent"
							/>
							<div
								v-if="showConsentWarning"
								class="mt-1 text-xs text-ink-red-6"
							>
								{{
									__('Please provide your consent to proceed with the payment')
								}}
							</div>
						</div>
						<div class="ms-auto flex flex-col items-end gap-2">
							<p
								v-if="!isZeroAmount && !checkoutAvailability.data?.enabled"
								class="max-w-sm text-end text-sm text-ink-amber-7"
								role="status"
							>
								{{ __('Online payment is temporarily unavailable.') }}
							</p>
							<Button
								variant="solid"
								size="md"
								class="text-p-base-medium"
								:disabled="!isZeroAmount && !checkoutAvailability.data?.enabled"
								:loading="paymentLink.loading"
								@click="generatePaymentLink()"
							>
							{{
								isZeroAmount ? __('Enroll for Free') : __('Pay with Halyk ePay')
							}}
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div v-else-if="access.data?.message">
			<NotPermitted
				:text="access.data.message"
				:buttonLabel="type == 'course' ? 'Checkout Course' : 'Checkout Batch'"
				:buttonLink="
					type == 'course'
						? getLmsRoute(`courses/${name}`)
						: getLmsRoute(`batches/${name}`)
				"
			/>
		</div>
		<div v-else-if="!user.data?.name">
			<NotPermitted
				text="Please login to access this page."
				:buttonLink="`/login?redirect-to=${getLmsRoute(
					`billing/${type}/${name}`
				)}`"
			/>
		</div>
	</PageBody>
</template>
<script setup>
import {
	Button,
	Combobox,
	createResource,
	FormControl,
	usePageMeta,
	toast,
	call,
} from 'frappe-ui'
import { reactive, inject, onMounted, computed, ref, watch } from 'vue'
import PageHeader from '@/components/Layouts/PageHeader.vue'
import PageBody from '@/components/Layouts/PageBody.vue'
import { sessionStore } from '../stores/session'
import Link from '@/components/Controls/Link.vue'
import NotPermitted from '@/components/NotPermitted.vue'
import { useTelemetry } from 'frappe-ui/frappe'
import { getLmsRoute } from '@/utils/basePath'
import {
	INDIAN_STATE_OPTIONS,
	canonicalIndianState,
} from '@/utils/indianStates'
import { CIS_COUNTRY_OPTIONS } from '@/utils/cisCountries'

const breadcrumbs = [
	{ label: __('Billing Details'), route: { name: 'Billing' } },
]

const user = inject('$user')
const { brand } = sessionStore()
const showConsentWarning = ref(false)
const { capture } = useTelemetry()

onMounted(() => {
	if (user.data?.name) {
		access.submit()
		checkoutAvailability.submit()
	}
})

const props = defineProps({
	type: {
		type: String,
		required: true,
	},
	name: {
		type: String,
		required: true,
	},
})

const access = createResource({
	url: 'lms.lms.api.validate_billing_access',
	params: {
		billing_type: props.type,
		name: props.name,
	},
	onSuccess(data) {
		Object.assign(fieldMeta, data.billing_field_meta || {})
		setBillingDetails(data.address)
		orderSummary.submit()
	},
})

const orderSummary = createResource({
	url: 'lms.lms.utils.get_order_summary',
	makeParams(values) {
		return {
			doctype: props.type == 'batch' ? 'LMS Batch' : 'LMS Course',
			docname: props.name,
			country: billingDetails.country,
			coupon: appliedCoupon.value,
		}
	},
	onError(err) {
		showError(err)
	},
})

const checkoutAvailability = createResource({
	url: 'lms.lms.halyk.get_checkout_availability',
})

const selectedPaymentMethod = ref('card')
const paymentMethods = computed(() => [
	{
		value: 'card',
		label: __('Bank card'),
		description: __('Visa or Mastercard'),
		enabled: checkoutAvailability.data?.methods?.includes('card') ?? false,
	},
	{
		value: 'halyk_qr',
		label: __('Halyk QR'),
		description: checkoutAvailability.data?.test_mode
			? __('Available after production activation')
			: __('Pay in the Halyk app'),
		enabled: checkoutAvailability.data?.methods?.includes('halyk_qr') ?? false,
	},
	{
		value: 'google_pay',
		label: __('Google Pay'),
		description: checkoutAvailability.data?.test_mode
			? __('Production only')
			: __('Use a saved card'),
		enabled: checkoutAvailability.data?.methods?.includes('google_pay') ?? false,
	},
])

const appliedCoupon = ref(null)
const billingDetails = reactive({})
const fieldMeta = reactive({})

const getDefault = (fieldname) => fieldMeta[fieldname]?.default || ''

const setBillingDetails = (data) => {
	billingDetails.billing_name = data?.billing_name || getDefault('billing_name')
	billingDetails.address_line1 =
		data?.address_line1 || getDefault('address_line1')
	billingDetails.address_line2 =
		data?.address_line2 || getDefault('address_line2')
	billingDetails.city = data?.city || getDefault('city')
	billingDetails.state = data?.state || getDefault('state')
	billingDetails.country = data?.country || getDefault('country') || 'Kazakhstan'
	billingDetails.pincode = data?.pincode || getDefault('pincode')
	billingDetails.phone = data?.phone || getDefault('phone')
	billingDetails.source = data?.source || getDefault('source')
	billingDetails.gstin = data?.gstin || getDefault('gstin')
	billingDetails.pan = data?.pan || getDefault('pan')
	normalizeState()
}

// Addresses saved before the dropdown existed hold free text ("GUJARAT"), which
// matches no option and would look unselected. Anything unrecognised is left
// alone so validation can report it.
const normalizeState = () => {
	if (billingDetails.country != 'India') return
	const canonical = canonicalIndianState(billingDetails.state)
	if (canonical) billingDetails.state = canonical
}

const paymentLink = createResource({
	url: 'lms.lms.payments.get_payment_link',
	makeParams(values) {
		let data = {
			doctype: props.type == 'batch' ? 'LMS Batch' : 'LMS Course',
			docname: props.name,
			address: billingDetails,
			payment_for_certificate: props.type == 'certificate',
			coupon_code: appliedCoupon.value,
			country: billingDetails.country,
			payment_method: selectedPaymentMethod.value,
		}
		return data
	},
})

const generatePaymentLink = () => {
	paymentLink.submit(
		{},
		{
			validate() {
				if (!billingDetails.source && fieldMeta.source?.reqd) {
					return __('Please let us know where you heard about us from.')
				}
				if (!billingDetails.member_consent) {
					showConsentWarning.value = true
					return __('Please provide your consent to proceed with the payment.')
				}
				return validateAddress()
			},
			async onSuccess(data) {
				if (data?.provider === 'halyk_epay') {
					capture('checkout_initiated', { type: props.type, provider: 'halyk_epay' })
					try {
						await openHalykCheckout(data)
					} catch (error) {
						showError(error)
					}
					return
				}
				if (typeof data !== 'string' || !data) {
					toast.error(
						__('Could not start the payment. Please contact the administrator.')
					)
					return
				}
				capture('checkout_initiated', { type: props.type })
				window.location.href = data
			},
			onError(err) {
				showError(err)
			},
		}
	)
}

const loadExternalScript = (src) =>
	new Promise((resolve, reject) => {
		const existing = document.querySelector(`script[src="${src}"]`)
		if (existing) {
			if (window.halyk?.pay) return resolve()
			existing.addEventListener('load', resolve, { once: true })
			existing.addEventListener('error', reject, { once: true })
			return
		}
		const script = document.createElement('script')
		script.src = src
		script.async = true
		script.onload = resolve
		script.onerror = () => reject(new Error(__('Could not load Halyk ePay. Please try again.')))
		document.head.appendChild(script)
	})

const openHalykCheckout = async (checkout) => {
	if (!checkout?.script_url || !checkout?.payment) {
		throw new Error(__('Invalid response from Halyk ePay.'))
	}
	await loadExternalScript(checkout.script_url)
	if (!window.halyk?.pay) throw new Error(__('Halyk ePay is unavailable. Please try again.'))
	window.halyk.pay(checkout.payment)
}

function applyCouponCode() {
	if (!appliedCoupon.value) {
		toast.error(__('Please enter a coupon code'))
		return
	}
	orderSummary.reload()
}

function removeCoupon() {
	appliedCoupon.value = null
	orderSummary.reload()
}

const validateAddress = () => {
	let billingFields = [
		'billing_name',
		'address_line1',
		'address_line2',
		'city',
		'state',
		'pincode',
		'country',
		'phone',
		'gstin',
		'pan',
	]
	let mandatoryFields = billingFields.filter((f) => fieldMeta[f]?.reqd)
	for (let field of mandatoryFields) {
		if (!billingDetails[field])
			return (
				'Please enter a valid ' +
				field
					.replaceAll('_', ' ')
					.toLowerCase()
					.replace(/\b\w/g, (s) => s.toUpperCase())
			)
	}

	if (billingDetails.gstin && !billingDetails.pan)
		return 'Please enter a valid pan number.'

	if (billingDetails.country != 'India') return

	if (!billingDetails.state) return __('Please select your state.')

	// The dropdown only ever yields canonical names; this catches an older
	// free-text address that no spelling of ours can resolve.
	const canonical = canonicalIndianState(billingDetails.state)
	if (!canonical) return __('Please select your state from the list.')
	billingDetails.state = canonical
}

// A validation failure arrives as an Error; handing that to toast.error renders
// an empty toast, which is why a rejected checkout looked like a dead button.
const showError = (err) => {
	toast.error(err.messages?.[0] || err.message || err)
}

const changeCurrency = (country) => {
	billingDetails.country = country
	normalizeState()
	orderSummary.reload()
}

const isZeroAmount = computed(() => {
	return orderSummary.data && parseFloat(orderSummary.data.total_amount) <= 0
})

watch(billingDetails, () => {
	if (billingDetails.member_consent) {
		showConsentWarning.value = false
	}
})

usePageMeta(() => {
	return {
		title: __('Billing Details'),
		icon: brand.favicon,
	}
})
</script>
