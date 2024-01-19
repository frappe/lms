<template>
	<div class="text-base h-screen">
		<div v-if="access.data?.access" class="mt-20 w-1/2 mx-auto">
			<div class="text-3xl font-bold">
				{{ __('Billing Details') }}
			</div>
			<div class="text-gray-600 mt-1">
				{{ __('Enter the billing information to complete the payment.') }}
			</div>
			<div class="border rounded-md p-8 mt-10">
				<div class="text-xl font-semibold">
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
							<Input type="text" v-model="billingDetails.address_line_1" />
						</div>
						<div class="mt-4">
							<div class="mb-1.5 text-sm text-gray-700">
								{{ __('Address Line 2') }}
							</div>
							<Input type="text" v-model="billingDetails.address_line_2" />
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
							<Input type="text" v-model="billingDetails.country" />
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
							<Input type="text" v-model="billingDetails.source" />
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
				<Button variant="solid" class="mt-8">
					{{ __('Proceed to Payment') }}
				</Button>
			</div>
		</div>
		<div v-else>
			<div class="text-base border rounded-md w-1/3 mx-auto my-32">
				<div class="border-b px-5 py-3 font-medium">
					<span
						class="inline-flex items-center before:bg-red-600 before:w-2 before:h-2 before:rounded-md before:mr-2"
					></span>
					{{ __('Not Permitted') }}
				</div>
				<div class="px-5 py-3">
					<div class="mb-4 leading-6">
						{{ access.data?.message }}
					</div>
					<Button
						v-if="!user.data.name"
						variant="solid"
						class="w-full"
						@click="redirectToLogin()"
					>
						{{ __('Login') }}
					</Button>
					<router-link
						v-else-if="type == 'course'"
						:to="{
							name: 'Courses',
						}"
					>
						<Button variant="solid">
							{{ __('Checkout Courses') }}
						</Button>
					</router-link>
					<router-link
						v-else-if="type == 'batch'"
						:to="{
							name: 'Batches',
						}"
					>
						<Button varian="solid">
							{{ __('Checkout Batches') }}
						</Button>
					</router-link>
				</div>
			</div>
		</div>
	</div>
</template>
<script setup>
import { Input, Button, createResource } from 'frappe-ui'
import { reactive, inject, onMounted, ref } from 'vue'

const user = inject('$user')

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
	auto: true,
})

const billingDetails = reactive({
	billing_name: '',
	address_line_1: '',
	address_line_2: '',
	city: '',
	state: '',
	pincode: '',
	country: '',
	phone: '',
	source: '',
	gstin: '',
	pan: '',
})

const redirectToLogin = () => {
	window.location.href = `/login?redirect-to=/billing/${props.type}/${props.name}`
}
</script>
