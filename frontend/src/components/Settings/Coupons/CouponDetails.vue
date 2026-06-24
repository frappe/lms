<template>
	<SettingsLayout
		:title="isNew ? __('New Coupon') : __('Edit Coupon')"
		:description="
			__(
				'Set the discount, validity, and the courses or batches this coupon applies to.'
			)
		"
		:show-back="true"
		@back="emit('updateStep', 'list')"
	>
		<template #header-actions>
			<Button variant="solid" :disabled="!doc" @click="saveCoupon()">
				{{ __('Save') }}
			</Button>
		</template>

		<div v-if="doc" class="space-y-4">
			<div>
				<BooleanSwitch
					size="sm"
					v-model="doc.enabled"
					:label="__('Enabled')"
					:description="__('Allow this coupon to be used for discounts.')"
				/>
			</div>
			<div class="grid grid-cols-2 gap-4">
				<FormControl
					v-model="doc.code"
					:label="__('Coupon Code')"
					:required="true"
					:placeholder="__('e.g. WELCOME10')"
					@input="() => (doc.code = doc.code.toUpperCase())"
				/>

				<Select
					v-model="doc.discount_type"
					:label="__('Discount Type')"
					:required="true"
					:options="['Percentage', 'Fixed Amount']"
					class="w-full"
				/>

				<FormControl
					v-model="doc.expires_on"
					:label="__('Expires On')"
					type="date"
				/>

				<FormControl
					v-if="doc.discount_type === 'Percentage'"
					v-model="doc.percentage_discount"
					:required="true"
					:label="__('Discount Percentage')"
					type="number"
				/>
				<FormControl
					v-else
					v-model="doc.fixed_amount_discount"
					:required="true"
					:label="__('Discount Amount')"
					type="number"
				/>
				<FormControl
					v-model="doc.usage_limit"
					:label="__('Usage Limit')"
					type="number"
				/>

				<FormControl
					v-model="doc.redemption_count"
					:label="__('Redemptions Count')"
					type="number"
					:disabled="true"
				/>
			</div>
			<div class="pt-4">
				<div class="font-semibold text-ink-gray-9 mb-3">
					{{ __('Applicable For') }}
				</div>
				<CouponItems :items="doc.applicable_items" />
			</div>
		</div>
	</SettingsLayout>
</template>
<script setup lang="ts">
import { Button, FormControl, toast, createDocumentResource } from 'frappe-ui'
import BooleanSwitch from '@/components/Controls/BooleanSwitch.vue'
import { computed, reactive } from 'vue'
import type { Coupon, Coupons } from './types'
import CouponItems from '@/components/Settings/Coupons/CouponItems.vue'
import SettingsLayout from '@/components/Layouts/SettingsLayout.vue'
import Select from '@/components/Controls/Select.vue'

const emit = defineEmits(['updateStep'])

const props = defineProps<{
	coupons: Coupons
	data: Coupon
}>()

const isNew = !props.data?.name

// New coupons are edited on a local object; existing ones are loaded as a full
// document (child table + `modified`) so a single save persists everything and
// the document resource keeps `modified` in sync across saves.
const localDoc = reactive<any>({
	enabled: true,
	discount_type: 'Percentage',
	...props.data,
	applicable_items: props.data?.applicable_items?.length
		? props.data.applicable_items
		: [{ reference_doctype: 'LMS Course', reference_name: null }],
})

const couponDoc = isNew
	? null
	: createDocumentResource({
			doctype: 'LMS Coupon',
			name: props.data.name,
			auto: true,
	  })

const doc = computed<any>(() => (isNew ? localDoc : couponDoc?.doc))

const saveCoupon = () => {
	const current = doc.value
	if (!current) return

	const payload = {
		...current,
		// Drop half-filled rows; the server requires at least one valid item.
		applicable_items: (current.applicable_items || []).filter(
			(row: any) => row.reference_name
		),
	}

	const handlers = {
		onError(err: any) {
			toast.error(err.messages?.[0] || err.message || err)
			console.error(err)
		},
	}

	if (isNew) {
		props.coupons.insert.submit(payload, {
			onSuccess(data: Coupon) {
				toast.success(__('Coupon created successfully'))
				emit('updateStep', 'details', { ...data })
			},
			...handlers,
		})
	} else {
		couponDoc!.setValue.submit(payload, {
			onSuccess() {
				toast.success(__('Coupon updated successfully'))
				props.coupons.reload()
			},
			...handlers,
		})
	}
}
</script>
