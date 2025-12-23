<template>
	<div class="">
		<header
			class="sticky top-0 z-10 flex items-center justify-between border-b bg-surface-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs
				class="h-7"
				:items="[{ label: __('Billing Details'), route: { name: 'Billing' } }]"
			/>
		</header>
		<div
			v-if="access.data?.access && orderSummary.data"
			class="pt-5 pb-10 mx-5"
		>
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
						<div class="flex items-center space-x-2">
							<FormControl
								v-model="appliedCoupon"
								:disabled="orderSummary.data.discount_amount > 0"
								@input="appliedCoupon = $event.target.value.toUpperCase()"
								@keydown.enter="applyCouponCode"
								placeholder="COUPON2025"
								autocomplete="off"
								class="flex-1 [&_input]:bg-white"
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
								@click="removeCoupon"
								variant="outline"
							>
								<template #icon>
									<X class="size-4 stroke-1.5" />
								</template>
							</Button>
						</div>
					</div>

					<p
						class="bg-surface-amber-2 text-ink-amber-2 text-sm leading-5 p-2 rounded-md"
					>
						{{
							__(
								'Please ensure that the billing name you enter is correct, as it will be used on your invoice.'
							)
						}}
					</p>
				</div>

				<div class="flex-1 lg:mr-10">
					<div class="mb-5">
						<div class="text-lg font-semibold text-ink-gray-9">
							{{ __('Address') }}
						</div>
					</div>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
						<div class="space-y-4">
							<FormControl
								:label="__('Billing Name')"
								v-model="billingDetails.billing_name"
								:required="true"
							/>
							<FormControl
								:label="__('Address Line 1')"
								v-model="billingDetails.address_line1"
								:required="true"
							/>
							<FormControl
								:label="__('Address Line 2')"
								v-model="billingDetails.address_line2"
							/>
							<FormControl
								:label="__('City')"
								v-model="billingDetails.city"
								:required="true"
							/>
							<FormControl
								:label="__('State/Province')"
								v-model="billingDetails.state"
							/>
						</div>
						<div class="space-y-4">
							<Link
								doctype="Country"
								:value="billingDetails.country"
								@change="(option) => changeCurrency(option)"
								:label="__('Country')"
								:required="true"
							/>
							<FormControl
								:label="__('Postal Code')"
								v-model="billingDetails.pincode"
								:required="true"
							/>
							<FormControl
								:label="__('Phone Number')"
								v-model="billingDetails.phone"
								:required="true"
							/>
							<Link
								doctype="LMS Source"
								:value="billingDetails.source"
								@change="(option) => (billingDetails.source = option)"
								:label="__('Where did you hear about us?')"
								:required="true"
							/>
							<FormControl
								v-if="billingDetails.country == 'India'"
								:label="__('GST Number')"
								v-model="billingDetails.gstin"
							/>
							<FormControl
								v-if="billingDetails.country == 'India'"
								:label="__('PAN Number')"
								v-model="billingDetails.pan"
							/>
						</div>
					</div>
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
								class="mt-1 text-xs text-ink-red-3"
							>
								{{
									__('Please provide your consent to proceed with the payment')
								}}
							</div>
						</div>
						<Button variant="solid" size="md" @click="generatePaymentLink()">
							{{ __('Proceed to Payment') }}
						</Button>
					</div>
				</div>
			</div>
		</div>
		<div v-else-if="access.data?.message">
			<NotPermitted
				:text="access.data.message"
				:buttonLabel="type == 'course' ? 'Checkout Course' : 'Checkout Batch'"
				:buttonLink="
					type == 'course' ? `/lms/courses/${name}` : `/lms/batches/${name}`
				"
			/>
		</div>
		<div v-else-if="!user.data?.name">
			<NotPermitted
				text="Please login to access this page."
				:buttonLink="`/login?redirect-to=/lms/billing/${type}/${name}`"
			/>
		</div>
	</div>
</template>
<script setup>
import {
	Button,
	createResource,
	FormControl,
	Breadcrumbs,
	usePageMeta,
	toast,
	call,
} from 'frappe-ui'
import { reactive, inject, onMounted, computed, ref, watch } from 'vue'
import { sessionStore } from '../stores/session'
import Link from '@/components/Controls/Link.vue'
import NotPermitted from '@/components/NotPermitted.vue'
import { X } from 'lucide-vue-next'

const user = inject('$user')
const { brand } = sessionStore()
const showConsentWarning = ref(false)

onMounted(() => {
	const script = document.createElement('script')
	script.src = `https://checkout.razorpay.com/v1/checkout.js`
	document.body.appendChild(script)
	if (user.data?.name) {
		access.submit()
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

const appliedCoupon = ref(null)
const billingDetails = reactive({})

const setBillingDetails = (data) => {
	billingDetails.billing_name = data?.billing_name || ''
	billingDetails.address_line1 = data?.address_line1 || ''
	billingDetails.address_line2 = data?.address_line2 || ''
	billingDetails.city = data?.city || ''
	billingDetails.state = data?.state || ''
	billingDetails.country = data?.country || ''
	billingDetails.pincode = data?.pincode || ''
	billingDetails.phone = data?.phone || ''
	billingDetails.source = data?.source || ''
	billingDetails.gstin = data?.gstin || ''
	billingDetails.pan = data?.pan || ''
}

const paymentLink = createResource({
	url: 'lms.lms.payments.get_payment_link',
	makeParams(values) {
		let data = {
			doctype: props.type == 'batch' ? 'LMS Batch' : 'LMS Course',
			docname: props.name,
			title: orderSummary.data.title,
			amount: orderSummary.data.original_amount,
			discount_amount: orderSummary.data.discount_amount || 0,
			gst_amount: orderSummary.data.gst_applied || 0,
			currency: orderSummary.data.currency,
			address: billingDetails,
			redirect_to: redirectTo.value,
			payment_for_certificate: props.type == 'certificate',
			coupon_code: appliedCoupon.value,
			coupon: orderSummary.data.coupon,
		}
		return data
	},
})

const generatePaymentLink = () => {
	paymentLink.submit(
		{},
		{
			validate() {
				if (!billingDetails.source) {
					return __('Please let us know where you heard about us from.')
				}
				if (!billingDetails.member_consent) {
					showConsentWarning.value = true
					return __('Please provide your consent to proceed with the payment.')
				}
				return validateAddress()
			},
			onSuccess(data) {
				window.location.href = data
			},
			onError(err) {
				toast.error(err.messages?.[0] || err)
			},
		}
	)
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
	let mandatoryFields = [
		'billing_name',
		'address_line1',
		'city',
		'pincode',
		'country',
		'phone',
		'source',
	]
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

	if (billingDetails.country == 'India' && !billingDetails.state)
		return 'Please enter a valid state with correct spelling and the first letter capitalized.'

	const states = [
		'Andhra Pradesh',
		'Arunachal Pradesh',
		'Assam',
		'Bihar',
		'Chhattisgarh',
		'Delhi',
		'Goa',
		'Gujarat',
		'Haryana',
		'Himachal Pradesh',
		'Jammu and Kashmir',
		'Jharkhand',
		'Karnataka',
		'Kerala',
		'Madhya Pradesh',
		'Maharashtra',
		'Manipur',
		'Meghalaya',
		'Mizoram',
		'Nagaland',
		'Odisha',
		'Punjab',
		'Rajasthan',
		'Sikkim',
		'Tamil Nadu',
		'Telangana',
		'Tripura',
		'Uttar Pradesh',
		'Uttarakhand',
		'West Bengal',
	]
	if (
		billingDetails.country == 'India' &&
		!states.includes(billingDetails.state)
	)
		return 'Please enter a valid state with correct spelling and the first letter capitalized.'
}

const showError = (err) => {
	toast.error(err.messages?.[0] || err)
}

const changeCurrency = (country) => {
	billingDetails.country = country
	orderSummary.reload()
}

const redirectTo = computed(() => {
	if (props.type == 'course') {
		return `/lms/courses/${props.name}`
	} else if (props.type == 'batch') {
		return `/lms/batches/${props.name}`
	} else if (props.type == 'certificate') {
		return `/lms/courses/${props.name}/certification`
	}
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
