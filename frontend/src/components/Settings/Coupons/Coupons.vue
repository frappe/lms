<template>
	<CouponList
		v-if="step === 'list'"
		:label="props.label"
		:description="props.description"
		:list="list"
		@updateStep="updateStep"
	/>
	<CouponDetails
		v-else-if="step == 'details'"
		:key="data?.name || 'new'"
		:coupons="list.resource"
		:data="data"
		@updateStep="updateStep"
	/>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsListResource } from '@/composables/useSettingsListResource'
import CouponList from '@/components/Settings/Coupons/CouponList.vue'
import CouponDetails from '@/components/Settings/Coupons/CouponDetails.vue'
import type { Coupon } from '@/types'

const step = ref('list')
const data = ref<Coupon | null>(null)

const props = defineProps<{
	label: string
	description: string
}>()

const updateStep = (newStep: 'list' | 'new' | 'edit', newData: Coupon) => {
	step.value = newStep
	if (newData) {
		data.value = newData
	}
}

const list = useSettingsListResource<Coupon>({
	doctype: 'LMS Coupon',
	fields: [
		'name',
		'code',
		'discount_type',
		'percentage_discount',
		'fixed_amount_discount',
		'expires_on',
		'usage_limit',
		'redemption_count',
		'enabled',
	],
	searchFields: ['code'],
})
</script>
