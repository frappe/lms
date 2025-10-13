<template>
	<Dialog v-model="show" :options="{ title: dialogTitle, size: '3xl' }">
		<template #body-content>
			<div class="grid grid-cols-2 gap-4 pt-4">
				<FormControl
					v-model="doc.code"
					:label="__('Coupon Code')"
					:required="true"
					pattern="^[A-Za-z0-9]+$"
					minlength="6"
					@beforeinput="handleCodeInput"
					@input="doc.code = $event.target.value.toUpperCase()"
				/>
				<FormControl
					v-model="doc.discount_type"
					:label="__('Discount Type')"
					:required="true"
					type="select"
					:options="['Percent', 'Amount']"
				/>
				<FormControl
					v-if="doc.discount_type === 'Percent'"
					v-model="doc.percent_off"
					:required="true"
					:label="__('Discount Percentage')"
					type="number"
				/>
				<FormControl
					v-else
					v-model="doc.amount_off"
					:required="true"
					:label="__('Discount Amount')"
					type="number"
				/>
				<FormControl
					v-model="doc.expires_on"
					:label="__('Expires On')"
					type="date"
					:description="__('Leave blank for no expiry')"
				/>
				<FormControl
					v-model="doc.usage_limit"
					:label="__('Usage Limit')"
					type="number"
					:placeholder="__('Unlimited')"
				/>
				<Switch v-model="doc.active" :label="__('Active')" />
				<div class="col-span-2">
					<div class="text-md font-medium text-ink-gray-7 mb-1 mt-2">
						{{ __('Select Courses/Batches')
						}}<span class="text-ink-red-3">*</span>
					</div>
					<div class="space-y-2">
						<div
							v-for="(row, idx) in doc.applicable_items"
							:key="idx"
							class="flex gap-2 items-end"
						>
							<FormControl
								class="w-28"
								v-model="row.reference_doctype"
								:label="__('Type')"
								type="select"
								:options="[
									{ label: 'Course  ', value: 'LMS Course' },
									{ label: 'Batch  ', value: 'LMS Batch' },
								]"
							/>
							<Link
								class="min-w-40"
								:doctype="row.reference_doctype || 'LMS Course'"
								:label="__('Name')"
								:value="row.reference_name"
								@change="(opt) => (row.reference_name = opt)"
							/>
							<Button variant="subtle" @click="removeRow(idx)">
								<X class="h-3 w-3" />
							</Button>
						</div>
					</div>
					<Button class="mt-2" @click="addRow">
						<template #prefix><Plus class="h-3 w-3" /></template>
						{{ __('Add Item') }}
					</Button>
				</div>
			</div>
		</template>
		<template #actions>
			<div class="pb-5 float-right space-x-2">
				<Button variant="outline" @click="show = false">{{
					__('Cancel')
				}}</Button>
				<Button variant="solid" @click="save">{{ __('Save') }}</Button>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import { Dialog, Button, FormControl, createResource, toast } from 'frappe-ui'
import { ref, watch, computed } from 'vue'
import { Plus, X } from 'lucide-vue-next'
import Link from '@/components/Controls/Link.vue'

const show = defineModel({ type: Boolean, required: true })
const props = defineProps({ couponId: String })
const emit = defineEmits(['saved'])

const doc = ref({
	code: '',
	discount_type: 'Percent',
	percent_off: null,
	amount_off: null,
	active: 1,
	expires_on: null,
	usage_limit: null,
	applicable_items: [],
})

const dialogTitle = computed(() =>
	props.couponId === 'new' ? __('New Coupon') : __('Edit Coupon')
)

const getDoc = createResource({
	url: 'frappe.client.get',
	makeParams() {
		return { doctype: 'LMS Coupon', name: props.couponId }
	},
	onSuccess(data) {
		doc.value = data
	},
})

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
)

function addRow() {
	doc.value.applicable_items.push({
		reference_doctype: 'LMS Course',
		reference_name: null,
	})
}
function removeRow(idx) {
	doc.value.applicable_items.splice(idx, 1)
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
					show.value = false
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
					show.value = false
					emit('saved')
				},
				onError(err) {
					toast.error(err.messages?.[0] || err.message || err)
				},
			}
		)
	}
}
</script>
