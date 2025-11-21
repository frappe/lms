<template>
	<TransactionList
		v-if="step === 'list'"
		:label="props.label"
		:description="props.description"
		:transactions="transactions"
		@updateStep="updateStep"
	/>
	<TransactionDetails
		v-else-if="step == 'details'"
		:transactions="transactions"
		:data="data"
		v-model:show="show"
		@updateStep="updateStep"
	/>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { createListResource } from 'frappe-ui'
import TransactionList from '@/components/Settings/Transactions/TransactionList.vue'
import TransactionDetails from '@/components/Settings/Transactions/TransactionDetails.vue'

const step = ref('list')
const data = ref<any | null>(null)
const show = defineModel('show')

const props = defineProps<{
	label: string
	description: string
}>()

const updateStep = (newStep: 'list' | 'new' | 'edit', newData: any) => {
	step.value = newStep
	if (newData) {
		data.value = newData
	}
}

const transactions = createListResource({
	doctype: 'LMS Payment',
	fields: [
		'name',
		'member',
		'billing_name',
		'source',
		'payment_for_document_type',
		'payment_for_document',
		'payment_received',
		'payment_for_certificate',
		'currency',
		'amount',
		'amount_with_gst',
		'coupon',
		'coupon_code',
		'discount_amount',
		'original_amount',
		'order_id',
		'payment_id',
		'gstin',
		'pan',
		'address',
	],
	auto: true,
	orderBy: 'modified desc',
})
</script>
