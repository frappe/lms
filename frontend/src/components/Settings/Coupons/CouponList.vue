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
		:search-label="__('Search coupons')"
		empty-name="Coupons"
		empty-icon="lucide-ticket"
		@new="openForm()"
		@load-more="list.loadMore()"
		@row-click="openForm"
	/>
</template>
<script setup lang="ts">
import { call, toast } from 'frappe-ui'
import { getCurrentInstance, inject } from 'vue'
import type { Coupon, SettingsListColumn, SettingsListRow } from '@/types'
import type { SettingsListSource } from '@/composables/useSettingsListResource'
import SettingsList from '@/components/Layouts/SettingsList.vue'

const dayjs = inject('$dayjs') as typeof import('dayjs')
const app = getCurrentInstance()
const $dialog = app?.appContext.config.globalProperties.$dialog
const emit = defineEmits(['updateStep'])

const props = defineProps<{
	label: string
	description: string
	list: SettingsListSource
}>()

const openForm = (coupon: SettingsListRow = {}) => {
	emit('updateStep', 'details', { ...coupon })
}

function trashCoupon(name: string, close: () => void) {
	call('frappe.client.delete', { doctype: 'LMS Coupon', name }).then(() => {
		toast.success(__('Coupon deleted successfully'))
		props.list.reload()
		if (typeof close === 'function') close()
	})
}

const confirmDeletion = (name: string) => {
	$dialog({
		title: __('Delete this coupon?'),
		message: __(
			'This will permanently delete the coupon and the code will no longer be valid.'
		),
		actions: [
			{
				label: __('Delete'),
				theme: 'red',
				variant: 'solid',
				onClick({ close }: { close: () => void }) {
					trashCoupon(name, close)
				},
			},
		],
	})
}

const discountLabel = (row: Coupon) => {
	if (row.discount_type === 'Percentage') return `${row.percentage_discount}%`
	if (row.discount_type === 'Fixed Amount')
		return `${row.fixed_amount_discount}/-`
	return ''
}

const columns: SettingsListColumn[] = [
	{
		key: 'code',
		label: __('Code'),
		type: 'stacked',
		width: 'minmax(0, 1.4fr)',
		primary: (row) => row.code,
	},
	{
		key: 'discount',
		label: __('Discount'),
		type: 'text',
		value: (row) => discountLabel(row as Coupon),
	},
	{
		key: 'expires_on',
		label: __('Expires On'),
		type: 'text',
		value: (row) => dayjs(row.expires_on).format('DD MMM YYYY'),
	},
	{
		key: 'redeemed',
		label: __('Redeemed'),
		type: 'text',
		width: '5.5rem',
		value: (row) => `${row.redemption_count}/${row.usage_limit}`,
	},
	{
		key: 'status',
		label: __('Status'),
		type: 'badge',
		width: '6.5rem',
		badges: (row) => [
			row.enabled
				? { label: __('Enabled'), theme: 'green' }
				: { label: __('Disabled'), theme: 'gray' },
		],
	},
	{
		key: 'actions',
		type: 'actions',
		ariaLabel: (row) => __('Actions for {0}').format(row.code),
		options: (row) => [
			{
				label: __('Delete'),
				icon: 'lucide-trash-2',
				onClick: () => confirmDeletion(row.name),
			},
		],
	},
]
</script>
