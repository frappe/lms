<template>
	<div class="">
		<div
			v-if="access.data?.access && orderSummary.data"
			class="mt-10 w-1/2 mx-auto"
		>
			<div class="text-3xl font-bold">
				{{ __('Billing Details') }}
			</div>
			<div class="text-gray-600 mt-1">
				{{ __('Enter the billing information to complete the payment.') }}
			</div>
			<div class="border rounded-md p-5 mt-5">
				<div class="text-xl font-semibold">
					{{ __('Summary') }}
				</div>
				<div class="text-gray-600 mt-1">
					{{ __('Review the details of your purchase.') }}
				</div>
				<div class="mt-5">
					<div class="flex items-center justify-between">
						<div>
							{{ orderSummary.data.title }}
						</div>
						<div
							:class="{
								'font-semibold text-xl': !orderSummary.data.gst_applied,
							}"
						>
							{{
								orderSummary.data.gst_applied
									? orderSummary.data.original_amount_formatted
									: orderSummary.data.total_amount_formatted
							}}
						</div>
					</div>
					<div
						v-if="orderSummary.data.gst_applied"
						class="flex items-center justify-between mt-2"
					>
						<div>
							{{ __('GST Amount') }}
						</div>
						<div>
							{{ orderSummary.data.gst_amount_formatted }}
						</div>
					</div>
					<div
						v-if="orderSummary.data.gst_applied"
						class="flex items-center justify-between mt-2"
					>
						<div>
							{{ __('Total Amount') }}
						</div>
						<div class="font-semibold text-2xl">
							{{ orderSummary.data.total_amount_formatted }}
						</div>
					</div>
				</div>

				<div class="text-xl font-semibold mt-10">
					{{ __('Address') }}
				</div>
				<div class="text-gray-600 mt-1">
					{{ __('Specify your billing address correctly.') }}
				</div>
				<div class="grid grid-cols-2 gap-5 mt-4">
					<div>
						<div class="mt-4">
							<div class="mb-1.5 text-sm text-gray-700">
								{{ __('Billing Name') }}
							</div>
							<Input type="text" v-model="billingDetails.billing_name" />
						</div>
						<div class="mt-4">
							<div class="mb-1.5 text-sm text-gray-700">
								{{ __('Address Line 1') }}
							</div>
							<Input type="text" v-model="billingDetails.address_line1" />
						</div>
						<div class="mt-4">
							<div class="mb-1.5 text-sm text-gray-700">
								{{ __('Address Line 2') }}
							</div>
							<Input type="text" v-model="billingDetails.address_line2" />
						</div>
						<div class="mt-4">
							<div class="mb-1.5 text-sm text-gray-700">
								{{ __('City') }}
							</div>
							<Input type="text" v-model="billingDetails.city" />
						</div>
						<div class="mt-4">
							<div class="mb-1.5 text-sm text-gray-700">
								{{ __('State') }}
							</div>
							<Input type="text" v-model="billingDetails.state" />
						</div>
					</div>
					<div>
						<div class="mt-4">
							<div class="mb-1.5 text-sm text-gray-700">
								{{ __('Country') }}
							</div>
							<Link
								doctype="Country"
								:value="billingDetails.country"
								@change="(option) => changeCurrency(option)"
							/>
						</div>
						<div class="mt-4">
							<div class="mb-1.5 text-sm text-gray-700">
								{{ __('Postal Code') }}
							</div>
							<Input type="text" v-model="billingDetails.pincode" />
						</div>
						<div class="mt-4">
							<div class="mb-1.5 text-sm text-gray-700">
								{{ __('Phone Number') }}
							</div>
							<Input type="text" v-model="billingDetails.phone" />
						</div>
						<div class="mt-4">
							<div class="mb-1.5 text-sm text-gray-700">
								{{ __('Source') }}
							</div>
							<Link
								doctype="LMS Source"
								:value="billingDetails.source"
								@change="(option) => (billingDetails.source = option)"
							/>
						</div>
						<div v-if="billingDetails.country == 'India'" class="mt-4">
							<div class="mb-1.5 text-sm text-gray-700">
								{{ __('GST Number') }}
							</div>
							<Input type="text" v-model="billingDetails.gstin" />
						</div>
						<div v-if="billingDetails.country == 'India'" class="mt-4">
							<div class="mb-1.5 text-sm text-gray-700">
								{{ __('Pan Number') }}
							</div>
							<Input type="text" v-model="billingDetails.pan" />
						</div>
					</div>
				</div>
				<Button variant="solid" class="mt-8" @click="generatePaymentLink()">
					{{ __('Proceed to Payment') }}
				</Button>
			</div>
		</div>
		<div v-else-if="access.data?.message">
			<NotPermitted
				:text="access.data.message"
				:buttonLabel="
					type == 'course' ? 'Checkout Courses' : 'Checkout Batches'
				"
				:buttonLink="type == 'course' ? '/lms/courses' : '/lms/batches'"
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
import { Input, Button, createResource } from 'frappe-ui'
import { reactive, inject, onMounted, ref } from 'vue'
import Link from '@/components/Controls/Link.vue'
import NotPermitted from '@/components/NotPermitted.vue'
import { createToast } from '@/utils/'

const user = inject('$user')

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
		type: props.type,
		name: props.name,
	},
	onSuccess(data) {
		orderSummary.submit()
		setBillingDetails(data.address)
	},
})

const orderSummary = createResource({
	url: 'lms.lms.utils.get_order_summary',
	makeParams(values) {
		return {
			doctype: props.type == 'course' ? 'LMS Course' : 'LMS Batch',
			docname: props.name,
			country: billingDetails.country,
		}
	},
	onError(err) {
		showError(err)
	},
})

const billingDetails = reactive({})

const setBillingDetails = (data) => {
	billingDetails.billing_name = data.billing_name || ''
	billingDetails.address_line1 = data.address_line1 || ''
	billingDetails.address_line2 = data.address_line2 || ''
	billingDetails.city = data.city || ''
	billingDetails.state = data.state || ''
	billingDetails.country = data.country || ''
	billingDetails.pincode = data.pincode || ''
	billingDetails.phone = data.phone || ''
	billingDetails.source = data.source || ''
	billingDetails.gstin = data.gstin || ''
	billingDetails.pan = data.pan || ''
}

const paymentOptions = createResource({
	url: 'lms.lms.utils.get_payment_options',
	makeParams(values) {
		return {
			doctype: props.type == 'course' ? 'LMS Course' : 'LMS Batch',
			docname: props.name,
			phone: billingDetails.phone,
			country: billingDetails.country,
		}
	},
})

const generatePaymentLink = () => {
	paymentOptions.submit(
		{},
		{
			validate(params) {
				return validateAddress()
			},
			onSuccess(data) {
				data.handler = (response) => {
					let doctype = props.type == 'course' ? 'LMS Course' : 'LMS Batch'
					let docname = props.name
					handleSuccess(response, doctype, docname, data.order_id)
				}
				let rzp1 = new Razorpay(data)
				rzp1.open()
			},
			onError(err) {
				showError(err)
			},
		}
	)
}

const paymentResource = createResource({
	url: 'lms.lms.utils.verify_payment',
	makeParams(values) {
		return {
			response: values.response,
			doctype: props.type == 'course' ? 'LMS Course' : 'LMS Batch',
			docname: props.name,
			address: billingDetails,
			order_id: values.orderId,
		}
	},
})

const handleSuccess = (response, doctype, docname, orderId) => {
	paymentResource.submit(
		{
			response: response,
			orderId: orderId,
		},
		{
			onSuccess(data) {
				createToast({
					title: 'Success',
					text: 'Payment Successful',
					icon: 'check',
					iconClasses: 'bg-green-600 text-white rounded-md p-px',
				})
				setTimeout(() => {
					window.location.href = data
				}, 3000)
			},
		}
	)
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
	createToast({
		title: 'Error',
		text: err.messages?.[0] || err,
		icon: 'x',
		iconClasses: 'bg-red-600 text-white rounded-md p-px',
		position: 'top-center',
		timeout: 10,
	})
}

const changeCurrency = (country) => {
	billingDetails.country = country
	orderSummary.reload()
}
</script>
