<template>
	<div class="flex flex-col h-full text-base">
		<div class="flex items-center space-x-2 mb-8 -ml-1.5">
			<ChevronLeft
				class="size-5 stroke-1.5 text-ink-gray-7 cursor-pointer"
				@click="emit('updateStep', 'list')"
			/>
			<div class="text-xl font-semibold text-ink-gray-9">
				{{ __('Transaction Details') }}
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
			</div>

			<div class="grid grid-cols-3 gap-5 mt-5">
				<Link
					:label="__('Member')"
					doctype="User"
					v-model="transactionData.member"
				/>
				<FormControl
					:label="__('Billing Name')"
					v-model="transactionData.billing_name"
				/>
				<Link
					:label="__('Source')"
					v-model="transactionData.source"
					doctype="LMS Source"
				/>
				<Link
					:label="__('Payment For Document Type')"
					v-model="transactionData.payment_for_document_type"
					doctype="DocType"
				/>
				<Link
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
				/>
				<FormControl :label="__('Amount')" v-model="transactionData.amount" />
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
		<div class="space-x-2 mt-auto ml-auto">
			<Button @click="openDetails()">
				{{ __('Open the ') }}
				{{
					data.payment_for_document_type == 'LMS Course'
						? __('Course')
						: __('Batch')
				}}
			</Button>
			<Button variant="solid" @click="saveTransaction()">
				{{ __('Save') }}
			</Button>
		</div>
	</div>
</template>
<script setup lang="ts">
import { Button, FormControl } from 'frappe-ui'
import { useRouter } from 'vue-router'
import { ref, watch } from 'vue'
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

watch(
	() => props.data,
	(newVal) => {
		transactionData.value = newVal ? { ...newVal } : null
	},
	{ immediate: true }
)

const saveTransaction = (close: () => void) => {
	props.transactions.value.setValue
		.submit({
			...transactionData.value,
		})
		.then(() => {
			close()
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
</script>
