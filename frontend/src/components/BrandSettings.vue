<template>
	<div class="flex flex-col justify-between min-h-0">
		<div>
			<div class="flex items-center justify-between">
				<div class="font-semibold mb-1 text-ink-gray-9">
					{{ __(label) }}
				</div>
				<Badge
					v-if="isDirty"
					:label="__('Not Saved')"
					variant="subtle"
					theme="orange"
				/>
			</div>
			<div class="text-xs text-ink-gray-5">
				{{ __(description) }}
			</div>
		</div>
		<div class="overflow-y-auto">
			<SettingFields :fields="fields" :data="data.data" />
			<div class="flex flex-row-reverse mt-auto">
				<Button variant="solid" :loading="saveSettings.loading" @click="update">
					{{ __('Update') }}
				</Button>
			</div>
		</div>
	</div>
</template>
<script setup>
import { createResource, Button, Badge } from 'frappe-ui'
import SettingFields from '@/components/SettingFields.vue'
import { watch, ref } from 'vue'

const isDirty = ref(false)

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
	saveSettings.submit(
		{
			fields: fieldsToSave,
		},
		{
			onSuccess(data) {
				isDirty.value = false
			},
		}
	)
}

watch(props.data, (newData) => {
	if (newData && !isDirty.value) {
		isDirty.value = true
	}
})
</script>
