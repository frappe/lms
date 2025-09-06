<template>
	<div class="flex flex-col justify-between h-full">
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
			<SettingFields :fields="fields" :data="branding.data" />
		</div>
		<div class="flex flex-row-reverse mt-auto">
			<Button variant="solid" :loading="saveSettings.loading" @click="update">
				{{ __('Update') }}
			</Button>
		</div>
	</div>
</template>
<script setup>
import { createResource, Button, Badge } from 'frappe-ui'
import SettingFields from '@/components/Settings/SettingFields.vue'
import { watch, ref } from 'vue'

const isDirty = ref(false)

const props = defineProps({
	fields: {
		type: Array,
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

const branding = createResource({
	url: 'lms.lms.api.get_branding',
	auto: true,
	cache: 'brand',
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
	let imageFields = ['favicon', 'banner_image']
	props.fields.forEach((f) => {
		if (imageFields.includes(f.name)) {
			fieldsToSave[f.name] = f.value ? f.value.file_url : null
		} else {
			fieldsToSave[f.name] = f.value
		}
	})

	fieldsToSave['app_logo'] = fieldsToSave['banner_image']
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

watch(branding, (updatedDoc) => {
	let textFields = []
	let imageFields = []

	props.fields.forEach((f) => {
		if (f.type === 'Upload') {
			imageFields.push(f.name)
		} else {
			textFields.push(f.name)
		}
	})

	textFields.forEach((field) => {
		if (updatedDoc.data[field] != updatedDoc.previousData[field]) {
			isDirty.value = true
		}
	})

	imageFields.forEach((field) => {
		if (
			updatedDoc.data[field] &&
			updatedDoc.data[field].file_url != updatedDoc.previousData[field].file_url
		) {
			isDirty.value = true
		}
	})
})
</script>
