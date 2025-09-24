<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('Transaction Details'),
			size: '3xl',
		}"
	>
		<template #body-content>
			<div v-if="transactionData" class="text-base">
				<div class="grid grid-cols-3 gap-5 mt-5">
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
				</div>

				<div class="font-semibold mt-10">
					{{ __('Payment Details') }}
				</div>
				<div class="grid grid-cols-3 gap-5 mt-5">
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
					<Link
						:label="__('Address')"
						v-model="transactionData.address"
						doctype="Address"
					/>
				</div>

				<div class="grid grid-cols-3 gap-5 mt-5">
					<Link
						:label="__('Currency')"
						v-model="transactionData.currency"
						doctype="Currency"
					/>
					<FormControl :label="__('Amount')" v-model="transactionData.amount" />
					<FormControl
						:label="__('Order ID')"
						v-model="transactionData.order_id"
					/>
				</div>

				<div class="grid grid-cols-3 gap-5 mt-5">
					<FormControl :label="__('GSTIN')" v-model="transactionData.gstin" />
					<FormControl :label="__('PAN')" v-model="transactionData.pan" />
					<FormControl
						:label="__('Payment ID')"
						v-model="transactionData.payment_id"
					/>
				</div>
			</div>
		</template>
		<template #actions="{ close }">
			<div class="space-x-2 pb-5 float-right">
				<Button @click="openDetails(close)">
					{{ __('Open the ') }}
					{{
						transaction.payment_for_document_type == 'LMS Course'
							? __('Course')
							: __('Batch')
					}}
				</Button>
				<Button variant="solid" @click="saveTransaction(close)">
					{{ __('Save') }}
				</Button>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import { Dialog, FormControl, Button } from 'frappe-ui'
import { useRouter } from 'vue-router'
import { ref, watch } from 'vue'
import Link from '@/components/Controls/Link.vue'

const show = defineModel<boolean>({ required: true, default: false })
const transactions = defineModel<any>('transactions')
const router = useRouter()
const showModal = defineModel('show')
const transactionData = ref<{ [key: string]: any } | null>(null)

const props = defineProps<{
	transaction: { [key: string]: any } | null
}>()

watch(
	() => props.transaction,
	(newVal) => {
		transactionData.value = newVal ? { ...newVal } : null
	},
	{ immediate: true }
)

const saveTransaction = (close: () => void) => {
	transactions.value.setValue
		.submit({
			...transactionData.value,
		})
		.then(() => {
			close()
		})
}

const openDetails = (close: Function) => {
	if (props.transaction) {
		const docType = props.transaction.payment_for_document_type
		const docName = props.transaction.payment_for_document
		if (docType && docName) {
			router.push({
				name: docType == 'LMS Course' ? 'CourseDetail' : 'BatchDetail',
				params: {
					[docType == 'LMS Course' ? 'courseName' : 'batchName']: docName,
				},
			})
		}
	}
	close()
	showModal.value = false
}
</script>
