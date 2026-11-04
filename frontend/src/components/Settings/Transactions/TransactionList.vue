<template>
	<SettingsList
		:title="__(label)"
		:description="__(description)"
		:columns="columns"
		:rows="list.rows"
		:loading="list.loading"
		:has-next-page="list.hasNextPage"
		v-model:search="list.search"
		searchable
		empty-name="Transactions"
		empty-icon="lucide-landmark"
		@new="emit('updateStep', 'new', null)"
		@load-more="list.loadMore()"
		@row-click="openForm"
	>
		<template #header-bottom>
			<Select
				v-model="paymentType"
				class="w-44"
				:aria-label="__('Filter by payment type')"
				:options="paymentTypeOptions"
			/>
		</template>
	</SettingsList>
</template>
<script setup lang="ts">
import { Select } from 'frappe-ui'
import { ref, watch } from 'vue'
import SettingsList from '@/components/Layouts/SettingsList.vue'
import type { SettingsListSource } from '@/composables/useSettingsListResource'
import type { SettingsListColumn, SettingsListRow } from '@/types'

const paymentType = ref('All')
const emit = defineEmits(['updateStep'])

const paymentTypeOptions = [
	{ label: __('All Payments'), value: 'All' },
	{ label: __('Paid'), value: 'Paid' },
	{ label: __('Unpaid'), value: 'Unpaid' },
	{ label: __('For Certificate'), value: 'Certificate' },
	{ label: __('For Course'), value: 'Course' },
]

const props = defineProps<{
	label: string
	description: string
	list: SettingsListSource
}>()

const paymentFilter = (type: string) => {
	switch (type) {
		case 'Paid':
			return [['payment_received', '=', 1]]
		case 'Unpaid':
			return [['payment_received', '=', 0]]
		case 'Certificate':
			return [['payment_for_certificate', '=', 1]]
		case 'Course':
			return [['payment_for_certificate', '=', 0]]
		default:
			return []
	}
}

watch(paymentType, (type) => props.list.applyFilters(paymentFilter(type)))

const currencySymbols: Record<string, string> = {
	USD: '$',
	EUR: '€',
	GBP: '£',
	INR: '₹',
	AED: 'د.إ',
	CHF: 'Fr',
	JPY: '¥',
	AUD: '$',
}

const columns: SettingsListColumn[] = [
	{
		key: 'billing_name',
		label: __('Billing Name'),
		type: 'stacked',
		primary: (row) => row.billing_name,
		secondary: (row) => row.member,
	},
	{
		key: 'amount',
		label: __('Amount'),
		type: 'text',
		width: '8rem',
		value: (row) =>
			`${currencySymbols[row.currency] || row.currency} ${row.amount}`,
	},
	{
		key: 'status',
		label: __('Status'),
		type: 'badge',
		width: '10rem',
		badges: (row) => {
			const badges = []
			if (row.payment_received)
				badges.push({ label: __('Paid'), theme: 'green' as const })
			if (row.payment_for_certificate)
				badges.push({ label: __('Certificate'), theme: 'blue' as const })
			return badges
		},
	},
]

const openForm = (transaction: SettingsListRow) => {
	emit('updateStep', 'details', { ...transaction })
}
</script>
