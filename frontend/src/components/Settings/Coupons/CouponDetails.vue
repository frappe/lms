<template>
	<div class="flex flex-col text-base h-full">
		<div class="flex items-center space-x-2 mb-8 -ml-1.5">
			<ChevronLeft
				class="size-5 stroke-1.5 text-ink-gray-7 cursor-pointer"
				@click="emit('updateStep', 'list')"
			/>
			<div class="text-xl font-semibold text-ink-gray-9">
				{{ data?.name ? __('Edit Coupon') : __('New Coupon') }}
			</div>
		</div>
		<div class="space-y-4 overflow-y-auto">
			<div>
				<FormControl
					v-model="data.enabled"
					:label="__('Enabled')"
					type="checkbox"
				/>
			</div>
			<div class="grid grid-cols-2 gap-4">
				<FormControl
					v-model="data.code"
					:label="__('Coupon Code')"
					:required="true"
					@input="() => (data.code = data.code.toUpperCase())"
				/>

				<FormControl
					v-model="data.discount_type"
					:label="__('Discount Type')"
					:required="true"
					type="select"
					:options="['Percentage', 'Fixed Amount']"
				/>

				<FormControl
					v-model="data.expires_on"
					:label="__('Expires On')"
					type="date"
				/>

				<FormControl
					v-if="data.discount_type === 'Percentage'"
					v-model="data.percentage_discount"
					:required="true"
					:label="__('Discount Percentage')"
					type="number"
				/>
				<FormControl
					v-else
					v-model="data.fixed_amount_discount"
					:required="true"
					:label="__('Discount Amount')"
					type="number"
				/>
				<FormControl
					v-model="data.usage_limit"
					:label="__('Usage Limit')"
					type="number"
				/>

				<FormControl
					v-model="data.redemptions_count"
					:label="__('Redemptions Count')"
					type="number"
					:disabled="true"
				/>
			</div>
			<div class="py-8">
				<div class="font-semibold text-ink-gray-9 mb-2">
					{{ __('Applicable For') }}
				</div>
				<CouponItems ref="couponItems" :data="data" :coupons="coupons" />
			</div>
		</div>
		<div class="mt-auto space-x-2 ml-auto">
			<Button variant="solid" @click="saveCoupon()">
				{{ __('Save') }}
			</Button>
		</div>
	</div>
</template>
<script setup lang="ts">
import { Button, FormControl, toast } from 'frappe-ui'
import { ref } from 'vue'
import { ChevronLeft } from 'lucide-vue-next'
import type { Coupon, Coupons } from './types'
import CouponItems from '@/components/Settings/Coupons/CouponItems.vue'

const couponItems = ref<any>(null)
const emit = defineEmits(['updateStep'])

const props = defineProps<{
	coupons: Coupons
	data: Coupon
}>()

const saveCoupon = () => {
	if (props.data?.name) {
		editCoupon()
	} else {
		createCoupon()
	}
}

const editCoupon = () => {
	props.coupons.setValue.submit(
		{
			...props.data,
		},
		{
			onSuccess(data: Coupon) {
				if (couponItems.value) {
					couponItems.value.saveItems()
				}
			},
		}
	)
}

const createCoupon = () => {
	if (couponItems.value) {
		let rows = couponItems.value.saveItems()
		props.data.applicable_items = rows
	}
	props.coupons.insert.submit(
		{
			...props.data,
		},
		{
			onSuccess(data: Coupon) {
				toast.success(__('Coupon created successfully'))
				emit('updateStep', 'details', { ...data })
			},
			onError(err: any) {
				toast.error(err.messages?.[0] || err.message || err)
				console.error(err)
			},
		}
	)
}
</script>
