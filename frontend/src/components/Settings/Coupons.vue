<template>
	<div class="flex min-h-0 flex-col text-base">
		<div class="flex items-center justify-between mb-5">
			<div>
				<div class="text-xl font-semibold mb-1 text-ink-gray-9">
					{{ __(label) }}
				</div>
				<div class="text-ink-gray-6 leading-5">
					{{ __(description) }}
				</div>
			</div>
			<Button @click="openForm('new')">
				<template #prefix>
					<Plus class="h-3 w-3 stroke-1.5" />
				</template>
				{{ __('New') }}
			</Button>
		</div>

		<div v-if="coupons.data?.length" class="overflow-y-scroll">
			<table class="w-full text-sm">
				<thead>
					<tr class="bg-surface-gray-2 text-ink-gray-7">
						<th class="text-left p-2">{{ __('Code') }}</th>
						<th class="text-left p-2">{{ __('Type') }}</th>
						<th class="text-left p-2">{{ __('Value') }}</th>
						<th class="text-left p-2">{{ __('Expires On') }}</th>
						<th class="text-left p-2">{{ __('Usage') }}</th>
						<th class="text-left p-2">{{ __('Active') }}</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="row in coupons.data" :key="row.name" class="hover:bg-surface-gray-2 cursor-pointer" @click="openForm(row.name)">
						<td class="p-2">{{ row.code }}</td>
						<td class="p-2">{{ row.discount_type }}</td>
						<td class="p-2">
							<span v-if="row.discount_type === 'Percent'">{{ row.percent_off }}%</span>
							<span v-else>{{ row.amount_off }}</span>
						</td>
						<td class="p-2">{{ row.expires_on || '-' }}</td>
						<td class="p-2">{{ row.times_redeemed }}/{{ row.usage_limit || '∞' }}</td>
						<td class="p-2">
							<Badge v-if="row.active" theme="green">{{ __('Enabled') }}</Badge>
							<Badge v-else theme="gray">{{ __('Disabled') }}</Badge>
						</td>
					</tr>
				</tbody>
			</table>
		</div>

		<CouponDetails v-model="showDialog" :coupon-id="selected" @saved="onSaved" />
	</div>
</template>
<script setup>
import { Button, Badge, createListResource } from 'frappe-ui'
import { ref } from 'vue'
import { Plus } from 'lucide-vue-next'
import CouponDetails from '@/components/Settings/CouponDetails.vue'

defineProps({
	label: String,
	description: String,
})

const showDialog = ref(false)
const selected = ref(null)

const coupons = createListResource({
	doctype: 'LMS Coupon',
	fields: [
		'name',
		'code',
		'discount_type',
		'percent_off',
		'amount_off',
		'expires_on',
		'usage_limit',
		'times_redeemed',
		'active',
	],
})

function openForm(id) {
	selected.value = id
	showDialog.value = true
}

function onSaved() {
	coupons.reload()
}
</script>

