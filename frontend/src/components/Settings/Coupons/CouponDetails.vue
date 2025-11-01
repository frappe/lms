<template>
	<div class="flex flex-col text-base h-full overflow-y-auto">
		<div class="flex items-center space-x-2 mb-5">
			<Button variant="ghost" @click="emit('updateStep', 'list')">
				<template #icon>
					<ChevronLeft class="size-5 stroke-1 text-ink-gray-7" />
				</template>
			</Button>
			<div class="text-xl font-semibold text-ink-gray-9">
				{{ data?.name ? __('Edit Coupon') : __('New Coupon') }}
			</div>
		</div>
		<div class="space-y-4">
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
		<div class="mt-auto w-full space-x-2">
			<Button variant="solid" class="float-right" @click="saveCoupon()">
				{{ __('Save') }}
			</Button>
		</div>
	</div>
</template>
<script setup lang="ts">
import {
	Button,
	createListResource,
	createResource,
	FormControl,
	toast,
} from 'frappe-ui'
import { ref, watch, computed } from 'vue'
import { ChevronLeft, Plus, X } from 'lucide-vue-next'
import type { Coupon, Coupons } from './types'
import CouponItems from '@/components/Settings/Coupons/CouponItems.vue'

const couponItems = ref<any>(null)

const props = defineProps<{
	coupons: Coupons
	data: Coupon
}>()

const emit = defineEmits(['updateStep'])

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
		console.log(rows)
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

/* 
watch(
	() => show.value,
	(val) => {
		if (val) {
			if (props.couponId && props.couponId !== 'new') {
				getDoc.submit()
			} else {
				doc.value = {
					code: '',
					discount_type: 'Percent',
					active: 1,
					applicable_items: [],
				}
			}
		}
	}
) */
/* 
function addRow() {
	doc.value.applicable_items.push({
		reference_doctype: 'LMS Course',
		reference_name: null,
	})
}
function removeRow(idx) {
	doc.value.applicable_items.splice(idx, 1)
} */
/* 
function getFilters(idx) {
	// don't show the batch or course that has already been selected
	const row = doc.value.applicable_items[idx]
	if (!row.reference_doctype) return {}
	const doctype = row.reference_doctype
	const selectedNames = doc.value.applicable_items
		.filter(
			(r, i) => i !== idx && r.reference_doctype === doctype && r.reference_name
		)
		.map((r) => r.reference_name)
	if (selectedNames.length === 0) return {}
	return {
		name: ['not in', selectedNames],
	}
}

const saveDoc = createResource({
	url: 'frappe.client.save',
	makeParams(values) {
		return { doc: doc.value }
	},
})

const insertDoc = createResource({
	url: 'frappe.client.insert',
	makeParams(values) {
		return { doc: { doctype: 'LMS Coupon', ...doc.value } }
	},
})

function handleCodeInput(event) {
	if (event.data && !/^[A-Za-z0-9]*$/.test(event.data)) {
		event.preventDefault()
	}
}

function save() {
	if (props.couponId && props.couponId !== 'new') {
		saveDoc.submit(
			{},
			{
				onSuccess() {
					toast.success(__('Saved'))
					emit('saved')
				},
				onError(err) {
					toast.error(err.messages?.[0] || err.message || err)
				},
			}
		)
	} else {
		insertDoc.submit(
			{},
			{
				onSuccess() {
					toast.success(__('Saved'))
				},
				onError(err) {
					toast.error(err.messages?.[0] || err.message || err)
				},
			}
		)
	}
} */
</script>
