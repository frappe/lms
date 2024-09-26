<template>
	<div class="flex flex-col justify-between h-full">
		<div>
			<div class="font-semibold mb-1">
				{{ __(label) }}
			</div>
			<div class="text-xs text-gray-600">
				{{ __(description) }}
			</div>
		</div>
		<SettingFields :fields="fields" :data="data.data" />
		<div class="flex flex-row-reverse mt-auto">
			<Button variant="solid" :loading="saveSettings.loading" @click="update">
				{{ __('Update') }}
			</Button>
		</div>
	</div>
</template>
<script setup>
import { createResource, Button } from 'frappe-ui'
import SettingFields from '@/components/SettingFields.vue'

const props = defineProps({
	fields: {
		type: Array,
		required: true,
	},
	data: {
		type: Object,
		required: true,
	},
	label: {
		type: String,
		required: true,
	},
	description: {
		type: String,
	},
})

const saveSettings = createResource({
	url: 'frappe.client.set_value',
	makeParams(values) {
		console.log(values)
		return {
			doctype: 'Website Settings',
			name: 'Website Settings',
			fieldname: values.fields,
		}
	},
})

const update = () => {
	let fieldsToSave = {}
	let imageFields = ['favicon', 'banner_image', 'footer_logo']
	props.fields.forEach((f) => {
		if (imageFields.includes(f.name)) {
			fieldsToSave[f.name] = f.value ? f.value.file_url : null
		} else {
			fieldsToSave[f.name] = f.value
		}
	})
	saveSettings.submit({
		fields: fieldsToSave,
	})
}
</script>
