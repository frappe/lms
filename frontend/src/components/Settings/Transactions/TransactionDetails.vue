<template>
	<div class="flex flex-col h-full text-base">
		<div class="flex items-center justify-between mb-10 -ms-1.5">
			<div class="flex items-center gap-x-2">
				<ChevronLeft
					class="size-5 stroke-1.5 text-ink-gray-7 cursor-pointer"
					@click="emit('updateStep', 'list')"
				/>
				<div class="text-xl font-semibold text-ink-gray-9">
					{{ __('Transaction Details') }}
				</div>
			</div>
			<div class="flex items-center gap-x-2">
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
					:required="!!fieldMeta.member?.reqd"
				/>
				<FormControl
					:label="__('Billing Name')"
					v-model="transactionData.billing_name"
					:required="!!fieldMeta.billing_name?.reqd"
				/>
				<Link
					:label="__('Source')"
					v-model="transactionData.source"
					doctype="LMS Source"
					:required="!!fieldMeta.source?.reqd"
				/>
				<FormControl
					type="select"
					:options="documentTypeOptions"
					:label="__('Payment For Document Type')"
					v-model="transactionData.payment_for_document_type"
					doctype="DocType"
					:required="!!fieldMeta.payment_for_document_type?.reqd"
				/>
				<Link
					v-if="transactionData.payment_for_document_type"
					:label="__('Payment For Document')"
					v-model="transactionData.payment_for_document"
					:doctype="transactionData.payment_for_document_type"
					:required="!!fieldMeta.payment_for_document?.reqd"
				/>
			</div>

			<div class="font-semibold mt-10 text-ink-gray-9">
				{{ __('Payment Details') }}
			</div>
			<div class="grid grid-cols-3 gap-5 mt-5">
				<Link
					:label="__('Currency')"
					v-model="transactionData.currency"
					doctype="Currency"
					:required="!!fieldMeta.currency?.reqd"
				/>
				<FormControl
					:label="__('Amount')"
					v-model="transactionData.amount"
					:required="!!fieldMeta.amount?.reqd"
				/>
				<FormControl
					v-if="transactionData.amount_with_gst"
					:label="__('Amount with GST')"
					v-model="transactionData.amount_with_gst"
					:required="!!fieldMeta.amount_with_gst?.reqd"
				/>
			</div>

			<div v-if="transactionData.coupon">
				<div class="font-semibold mt-10 text-ink-gray-9">
					{{ __('Coupon Details') }}
				</div>
				<div class="grid grid-cols-3 gap-5 mt-5">
					<FormControl
						v-if="transactionData.coupon"
						:label="__('Coupon Code')"
						v-model="transactionData.coupon"
						:required="!!fieldMeta.coupon?.reqd"
					/>
					<FormControl
						v-if="transactionData.coupon"
						:label="__('Coupon Code')"
						v-model="transactionData.coupon_code"
						:required="!!fieldMeta.coupon_code?.reqd"
					/>
					<FormControl
						v-if="transactionData.coupon"
						:label="__('Discount Amount')"
						v-model="transactionData.discount_amount"
						:required="!!fieldMeta.discount_amount?.reqd"
					/>
					<FormControl
						v-if="transactionData.coupon"
						:label="__('Original Amount')"
						v-model="transactionData.original_amount"
						:required="!!fieldMeta.original_amount?.reqd"
					/>
				</div>
			</div>

			<div class="font-semibold mt-10 text-ink-gray-9">
				{{ __('Billing Details') }}
			</div>
			<div class="grid grid-cols-3 gap-5 mt-5">
				<Link
					:label="__('Address')"
					v-model="transactionData.address"
					doctype="Address"
					:required="!!fieldMeta.address?.reqd"
				/>
				<FormControl
					:label="__('GSTIN')"
					v-model="transactionData.gstin"
					:required="!!fieldMeta.gstin?.reqd"
				/>
				<FormControl
					:label="__('PAN')"
					v-model="transactionData.pan"
					:required="!!fieldMeta.pan?.reqd"
				/>
				<FormControl
					:label="__('Payment ID')"
					v-model="transactionData.payment_id"
					:required="!!fieldMeta.payment_id?.reqd"
				/>
				<FormControl
					:label="__('Order ID')"
					v-model="transactionData.order_id"
					:required="!!fieldMeta.order_id?.reqd"
				/>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import { Button, FormControl, Switch, toast } from 'frappe-ui'
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
	fieldMeta: Record<
		string,
		{ reqd?: number; default?: string; description?: string }
	>
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
	const docType = transactionData.value?.payment_for_document_type
	const docName = transactionData.value?.payment_for_document
	if (docType && docName) {
		router.push({
			name: docType == 'LMS Course' ? 'CourseDetail' : 'BatchDetail',
			params: {
				[docType == 'LMS Course' ? 'courseName' : 'batchName']: docName,
			},
		})
		show.value = false
	}
}

const getDefault = (fieldname: string) =>
	props.fieldMeta[fieldname]?.default || null

const getEmptyTransactionData = () => ({
	payment_received: false,
	payment_for_certificate: false,
	member: getDefault('member'),
	billing_name: getDefault('billing_name'),
	source: getDefault('source'),
	payment_for_document_type: getDefault('payment_for_document_type'),
	payment_for_document: getDefault('payment_for_document'),
	member_consent: false,
	currency: getDefault('currency'),
	amount: getDefault('amount'),
	amount_with_gst: getDefault('amount_with_gst'),
	coupon: getDefault('coupon'),
	coupon_code: getDefault('coupon_code'),
	discount_amount: getDefault('discount_amount'),
	original_amount: getDefault('original_amount'),
	order_id: getDefault('order_id'),
	payment_id: getDefault('payment_id'),
	gstin: getDefault('gstin'),
	pan: getDefault('pan'),
	address: getDefault('address'),
})

watch(
	() => props.data,
	(newVal) => {
		transactionData.value = newVal ? { ...newVal } : getEmptyTransactionData()
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
