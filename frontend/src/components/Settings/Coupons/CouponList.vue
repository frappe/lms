<template>
	<SettingsLayout :title="__(label)" :description="__(description)">
		<template #header-actions>
			<Button variant="solid" @click="openForm()">
				<template #prefix>
					<Plus class="h-4 w-4 stroke-1.5" />
				</template>
				{{ __('New') }}
			</Button>
		</template>

		<ListView
			v-if="coupons.data?.length"
			:columns="columns"
			:rows="coupons.data"
			row-key="name"
			:options="{
				showTooltip: false,
				selectable: true,
				onRowClick: (row: Coupon) => {
					openForm(row)
				},
			}"
		>
			<ListHeader
				class="mb-2 grid items-center gap-x-4 rounded bg-surface-gray-2 p-2"
			>
			</ListHeader>
			<ListRows>
				<ListRow :row="row" v-for="row in coupons.data" :key="row.name">
					<template #default="{ column, item }">
						<ListRowItem :item="row[column.key]" :align="column.align">
							<div v-if="column.key == 'enabled'">
								<Badge v-if="row[column.key]" theme="green">
									{{ __('Enabled') }}
								</Badge>
								<Badge v-else theme="gray">
									{{ __('Disabled') }}
								</Badge>
							</div>
							<div v-else-if="column.key == 'expires_on'">
								{{ dayjs(row[column.key]).format('DD MMM YYYY') }}
							</div>
							<div v-else-if="column.key == 'discount'">
								<div v-if="row['discount_type'] == 'Percentage'">
									{{ row['percentage_discount'] }}%
								</div>
								<div v-else-if="row['discount_type'] == 'Fixed Amount'">
									{{ row['fixed_amount_discount'] }}/-
								</div>
							</div>
							<div v-else class="leading-5 text-sm">
								{{ row[column.key] }}
							</div>
						</ListRowItem>
					</template>
				</ListRow>
			</ListRows>
			<ListSelectBanner>
				<template #actions="{ unselectAll, selections }">
					<div class="flex gap-2">
						<Button
							variant="ghost"
							@click="confirmDeletion(selections, unselectAll)"
						>
							<Trash2 class="h-4 w-4 stroke-1.5" />
						</Button>
					</div>
				</template>
			</ListSelectBanner>
		</ListView>
		<EmptyStateLayout
			v-else
			name="Coupons"
			:description="__('Add one to get started.')"
			:icon="Ticket"
		/>
	</SettingsLayout>
</template>
<script setup lang="ts">
import {
	Badge,
	Button,
	call,
	createListResource,
	FeatherIcon,
	ListView,
	ListHeader,
	ListHeaderItem,
	ListRows,
	ListRow,
	ListRowItem,
	ListSelectBanner,
	toast,
} from 'frappe-ui'
import { computed, getCurrentInstance, inject, ref } from 'vue'
import { Plus, Trash2, Ticket } from 'lucide-vue-next'
import type { Coupon, Coupons } from './types'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import SettingsLayout from '@/components/Layouts/SettingsLayout.vue'

const dayjs = inject('$dayjs') as typeof import('dayjs')
const app = getCurrentInstance()
const $dialog = app?.appContext.config.globalProperties.$dialog
const emit = defineEmits(['updateStep'])

const props = defineProps<{
	label: string
	description: string
	coupons: Coupons
}>()

const openForm = (coupon: Coupon = {} as Coupon) => {
	emit('updateStep', 'details', { ...coupon })
}

const confirmDeletion = (selections: any[], unselectAll: () => void) => {
	if (selections.length === 0) {
		toast.info(__('No coupons selected for deletion'))
		return
	}
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
					call('lms.lms.api.delete_documents', {
						doctype: 'LMS Coupon',
						documents: Array.from(selections),
					}).then((data: any) => {
						toast.success(__('Coupon(s) deleted successfully'))
						coupons.reload()
						unselectAll()
						close()
					})
				},
			},
		],
	})
}

function trashCoupon(name, close) {
	call('frappe.client.delete', { doctype: 'LMS Coupon', name }).then(() => {
		toast.success(__('Coupon deleted successfully'))
		coupons.reload()
		if (typeof close === 'function') close()
	})
}

const columns = computed(() => {
	return [
		{
			label: __('Code'),
			key: 'code',
			icon: 'tag',
			width: '150px',
		},
		{
			label: __('Discount'),
			key: 'discount',
			align: 'center',
			width: '80px',
			icon: 'dollar-sign',
		},
		{
			label: __('Expires On'),
			key: 'expires_on',
			width: '120px',
			icon: 'calendar',
		},
		{
			label: __('Usage Limit'),
			key: 'usage_limit',
			align: 'center',
			width: '100px',
			icon: 'hash',
		},
		{
			label: __('Redemption Count'),
			key: 'redemption_count',
			align: 'center',
			width: '100px',
			icon: 'users',
		},
		{
			label: __('Enabled'),
			key: 'enabled',
			align: 'center',
			icon: 'check-square',
		},
	]
})
</script>
