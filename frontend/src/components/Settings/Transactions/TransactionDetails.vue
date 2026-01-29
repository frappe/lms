<template>
	<div class="flex flex-col h-full text-base">
		<div class="flex items-center justify-between mb-10 -ml-1.5">
			<div class="flex items-center space-x-2">
				<ChevronLeft
					class="size-5 stroke-1.5 text-ink-gray-7 cursor-pointer"
					@click="emit('updateStep', 'list')"
				/>
				<div class="text-xl font-semibold text-ink-gray-9">
					{{ __('Transaction Details') }}
				</div>
			</div>
			<div class="space-x-2">
				<Button
					v-if="
						transactionData?.payment_for_document_type &&
						transactionData?.payment_for_document
					"
					@click="openDetails()"
				>
					{{ __('Open the ') }}
					{{
						transactionData.payment_for_document_type == 'LMS Course'
							? __('Course')
							: __('Batch')
					}}
				</Button>
				<Button variant="solid" @click="saveTransaction()">
					{{ __('Save') }}
				</Button>
			</div>
		</div>
		<div v-if="transactionData" class="overflow-y-auto">
			<div class="grid grid-cols-3 gap-5">
				<FormControl
					:label="__('Payment Received')"
					type="checkbox"
					v-model="transactionData.payment_received"
				/>
				<FormControl
					:label="__('Payment For Certificate')"
					type="checkbox"
					v-model="transactionData.payment_for_certificate"
				/>
				<FormControl
					:label="__('Member Consent')"
					type="checkbox"
					v-model="transactionData.member_consent"
					:disabled="true"
				/>
			</div>

			<div class="grid grid-cols-3 gap-5 mt-5">
				<Link
					:label="__('Member')"
					doctype="User"
					v-model="transactionData.member"
					:required="true"
				/>
				<FormControl
					:label="__('Billing Name')"
					v-model="transactionData.billing_name"
					:required="true"
				/>
				<Link
					:label="__('Source')"
					v-model="transactionData.source"
					doctype="LMS Source"
				/>
				<FormControl
					type="select"
					:options="documentTypeOptions"
					:label="__('Payment For Document Type')"
					v-model="transactionData.payment_for_document_type"
					doctype="DocType"
				/>
				<Link
					v-if="transactionData.payment_for_document_type"
					:label="__('Payment For Document')"
					v-model="transactionData.payment_for_document"
					:doctype="transactionData.payment_for_document_type"
				/>
			</div>

			<div class="font-semibold mt-10">
				{{ __('Payment Details') }}
			</div>
			<div class="grid grid-cols-3 gap-5 mt-5">
				<Link
					:label="__('Currency')"
					v-model="transactionData.currency"
					doctype="Currency"
					:required="true"
				/>
				<FormControl
					:label="__('Amount')"
					v-model="transactionData.amount"
					:required="true"
				/>
				<FormControl
					v-if="transactionData.amount_with_gst"
					:label="__('Amount with GST')"
					v-model="transactionData.amount_with_gst"
				/>
			</div>

			<div v-if="transactionData.coupon">
				<div class="font-semibold mt-10">
					{{ __('Coupon Details') }}
				</div>
				<div class="grid grid-cols-3 gap-5 mt-5">
					<FormControl
						v-if="transactionData.coupon"
						:label="__('Coupon Code')"
						v-model="transactionData.coupon"
					/>
					<FormControl
						v-if="transactionData.coupon"
						:label="__('Coupon Code')"
						v-model="transactionData.coupon_code"
					/>
					<FormControl
						v-if="transactionData.coupon"
						:label="__('Discount Amount')"
						v-model="transactionData.discount_amount"
					/>
					<FormControl
						v-if="transactionData.coupon"
						:label="__('Original Amount')"
						v-model="transactionData.original_amount"
					/>
				</div>
			</div>

			<div class="font-semibold mt-10">
				{{ __('Billing Details') }}
			</div>
			<div class="grid grid-cols-3 gap-5 mt-5">
				<Link
					:label="__('Address')"
					v-model="transactionData.address"
					doctype="Address"
					:required="true"
				/>
				<FormControl :label="__('GSTIN')" v-model="transactionData.gstin" />
				<FormControl :label="__('PAN')" v-model="transactionData.pan" />
				<FormControl
					:label="__('Payment ID')"
					v-model="transactionData.payment_id"
				/>
				<FormControl
					:label="__('Order ID')"
					v-model="transactionData.order_id"
				/>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import { Button, FormControl, toast } from 'frappe-ui'
import { useRouter } from 'vue-router'
import { computed, ref, watch } from 'vue'
import { ChevronLeft } from 'lucide-vue-next'
import Link from '@/components/Controls/Link.vue'

const router = useRouter()
const transactionData = ref<{ [key: string]: any } | null>(null)
const emit = defineEmits(['updateStep'])
const show = defineModel('show')

const props = defineProps<{
	transactions: any
	data: any
}>()

const saveTransaction = () => {
	if (props.data?.name) {
		updateTransaction()
	} else {
		createTransaction()
	}
}

const createTransaction = () => {
	console.log(props.transactions)
	props.transactions.insert
		.submit({
			...transactionData.value,
		})
		.then(() => {
			toast.success(__('Transaction created successfully'))
		})
		.catch((err: any) => {
			toast.error(__(err.messages?.[0] || err))
			console.error(err)
		})
}

const updateTransaction = () => {
	props.transactions.setValue
		.submit({
			...transactionData.value,
		})
		.then(() => {
			toast.success(__('Transaction updated successfully'))
		})
		.catch((err: any) => {
			toast.error(__(err.messages?.[0] || err))
			console.error(err)
		})
}

const openDetails = () => {
	if (props.data) {
		const docType = props.data.payment_for_document_type
		const docName = props.data.payment_for_document
		if (docType && docName) {
			router.push({
				name: docType == 'LMS Course' ? 'CourseDetail' : 'BatchDetail',
				params: {
					[docType == 'LMS Course' ? 'courseName' : 'batchName']: docName,
				},
			})
		}
		show.value = false
	}
}

const emptyTransactionData = {
	payment_received: false,
	payment_for_certificate: false,
	member: null,
	billing_name: null,
	source: null,
	payment_for_document_type: null,
	payment_for_document: null,
	member_consent: false,
	currency: null,
	amount: null,
	amount_with_gst: null,
	coupon: null,
	coupon_code: null,
	discount_amount: null,
	original_amount: null,
	order_id: null,
	payment_id: null,
	gstin: null,
	pan: null,
	address: null,
}

watch(
	() => props.data,
	(newVal) => {
		transactionData.value = newVal ? { ...newVal } : emptyTransactionData
	},
	{ immediate: true }
)

const documentTypeOptions = computed(() => {
	return [
		{
			label: __('Course'),
			value: 'LMS Course',
		},
		{
			label: __('Batch'),
			value: 'LMS Batch',
		},
	]
})
</script>
