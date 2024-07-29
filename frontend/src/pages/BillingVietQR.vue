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
					{{ __('QR Code') }}
				</div>
				<div class="text-gray-600 mt-1">
					{{ __('Scan the QR code to complete the payment.') }}
				</div>
				<div class="flex justify-center mt-4">
					<img :src="qrCodeUrl" alt="QR Code" class="w-1/2 h-auto" />
				</div>
				<div class="mt-8 text-center text-gray-600">
					{{ __('Admin will check the payment and grant access to you soon after you complete the bank transfer.') }}
				</div>
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
import { createResource } from 'frappe-ui'
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
		fetchQRCode.submit()
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

// Add the QR code URL here
const qrCodeUrl = ref('')

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


const fetchQRCode = createResource({
	url: 'lms.lms.utils.get_vietqr_code',
	onSuccess(data) {
		qrCodeUrl.value = data
	},
})

</script>
