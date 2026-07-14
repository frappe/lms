<template>
	<SettingsLayout :title="__(label)" :description="__(description)">
		<template #header-actions>
			<Button variant="solid" @click="openForm()">
				<template #prefix>
					<span class="lucide-plus h-4 w-4" />
				</template>
				{{ __('New') }}
			</Button>
		</template>

		<List v-if="coupons.data?.length" :columns="columns" class="list-row-px-3">
			<ListHeader>
				<ListHeaderCell>{{ __('Code') }}</ListHeaderCell>
				<ListHeaderCell>{{ __('Discount') }}</ListHeaderCell>
				<ListHeaderCell>{{ __('Expires On') }}</ListHeaderCell>
				<ListHeaderCell>{{ __('Redeemed') }}</ListHeaderCell>
				<ListHeaderCell>{{ __('Status') }}</ListHeaderCell>
				<ListHeaderCell />
			</ListHeader>
			<ListRows :items="coupons.data" row-key="name" v-slot="{ item: row }">
				<ListRow class="py-3" @click="openForm(row)">
					<ListCell class="gap-2">
						<span class="lucide-tag size-4 shrink-0 text-ink-gray-5" />
						<span class="truncate text-p-base-medium text-ink-gray-8">
							{{ row.code }}
						</span>
					</ListCell>
					<ListCell class="text-p-base text-ink-gray-6">
						<span class="truncate">
							<template v-if="row.discount_type == 'Percentage'">
								{{ row.percentage_discount }}%
							</template>
							<template v-else-if="row.discount_type == 'Fixed Amount'">
								{{ row.fixed_amount_discount }}/-
							</template>
						</span>
					</ListCell>
					<ListCell class="text-p-base text-ink-gray-6">
						<span class="truncate">
							{{ dayjs(row.expires_on).format('DD MMM YYYY') }}
						</span>
					</ListCell>
					<ListCell class="text-p-base text-ink-gray-6">
						{{ row.redemption_count }}/{{ row.usage_limit }}
					</ListCell>
					<ListCell>
						<Badge :theme="row.enabled ? 'green' : 'gray'">
							{{ row.enabled ? __('Enabled') : __('Disabled') }}
						</Badge>
					</ListCell>
					<ListCell class="justify-end" @click.stop>
						<Dropdown
							:options="[
								{
									label: __('Delete'),
									icon: 'lucide-trash-2',
									onClick: () => confirmDeletion(row.name),
								},
							]"
							:button="{ icon: 'lucide-more-horizontal', variant: 'ghost' }"
							placement="right"
						/>
					</ListCell>
				</ListRow>
			</ListRows>
		</List>
		<EmptyStateLayout
			v-else
			name="Coupons"
			:description="__('Add one to get started.')"
			icon="lucide-ticket"
		/>
	</SettingsLayout>
</template>
<script setup lang="ts">
import { Badge, Button, Dropdown, call, toast } from 'frappe-ui'
import {
	List,
	ListCell,
	ListHeader,
	ListHeaderCell,
	ListRow,
	ListRows,
} from 'frappe-ui/list'
import { getCurrentInstance, inject } from 'vue'
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

// Grid track sizes shared by the header and every row (--list-columns).
const columns = [
	'minmax(0, 1.4fr)',
	'minmax(0, 1fr)',
	'minmax(0, 1fr)',
	'5.5rem',
	'6.5rem',
	'2.25rem',
]

const openForm = (coupon: Coupon = {} as Coupon) => {
	emit('updateStep', 'details', { ...coupon })
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

function trashCoupon(name, close) {
	call('frappe.client.delete', { doctype: 'LMS Coupon', name }).then(() => {
		toast.success(__('Coupon deleted successfully'))
		coupons.reload()
		if (typeof close === 'function') close()
	})
}
</script>
