<template>
	<div class="flex flex-col h-full">
		<div class="flex items-center justify-between">
			<div class="text-xl font-semibold mb-1 text-ink-gray-9">
				{{ label }}
			</div>
			<!-- <Badge
                v-if="isDirty"
                :label="__('Not Saved')"
                variant="subtle"
                theme="orange"
            /> -->
		</div>
		<div class="overflow-y-scroll">
			<div class="flex flex-col divide-y">
				<SettingFields :fields="fields" :data="data.doc" />
				<SettingFields
					v-if="paymentGateway.data"
					:fields="paymentGateway.data.fields"
					:data="paymentGateway.data.data"
					class="pt-5 my-0"
				/>
			</div>
		</div>
		<div class="flex flex-row-reverse mt-auto">
			<Button variant="solid" @click="update">
				{{ __('Update') }}
			</Button>
		</div>
	</div>
</template>
<script setup>
import SettingFields from '@/components/Settings/SettingFields.vue'
import { createResource, Badge, Button } from 'frappe-ui'
import { watch } from 'vue'

const props = defineProps({
	label: {
		type: String,
		required: true,
	},
	description: {
		type: String,
		required: true,
	},
	data: {
		type: Object,
		required: true,
	},
	fields: {
		type: Array,
		required: true,
	},
})

const paymentGateway = createResource({
	url: 'lms.lms.api.get_payment_gateway_details',
	makeParams(values) {
		return {
			payment_gateway: props.data.doc.payment_gateway,
		}
	},
	transform(data) {
		arrangeFields(data.fields)
		return data
	},
	auto: true,
})

const arrangeFields = (fields) => {
	fields = fields.sort((a, b) => {
		if (a.type === 'Upload' && b.type !== 'Upload') {
			return 1
		} else if (a.type !== 'Upload' && b.type === 'Upload') {
			return -1
		}
		return 0
	})

	fields.splice(3, 0, {
		type: 'Column Break',
	})
}

const saveSettings = createResource({
	url: 'frappe.client.set_value',
	makeParams(values) {
		let fields = {}
		Object.keys(paymentGateway.data.data).forEach((key) => {
			if (
				paymentGateway.data.data[key] &&
				typeof paymentGateway.data.data[key] === 'object'
			) {
				fields[key] = paymentGateway.data.data[key].file_url
			} else {
				fields[key] = paymentGateway.data.data[key]
			}
		})

		return {
			doctype: paymentGateway.data.doctype,
			name: paymentGateway.data.docname,
			fieldname: fields,
		}
	},
	auto: false,
	onSuccess(data) {
		paymentGateway.reload()
	},
})

const update = () => {
	props.fields.forEach((f) => {
		if (f.type != 'Column Break') {
			props.data.doc[f.name] = f.value
		}
	})
	props.data.save.submit()
	saveSettings.submit()
}

watch(
	() => props.data.doc.payment_gateway,
	() => {
		paymentGateway.reload()
	}
)
</script>
