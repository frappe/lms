<template>
	<div class="flex flex-col h-full">
		<div>
			<div class="flex items-center justify-between">
				<div class="font-semibold mb-1 text-ink-gray-9">
					{{ __(label) }}
				</div>
				<div class="space-x-2">
					<Badge
						v-if="isDirty"
						:label="__('Not Saved')"
						variant="subtle"
						theme="orange"
					/>
					<Button
						variant="solid"
						:loading="saveSettings.loading"
						@click="update"
					>
						{{ __('Update') }}
					</Button>
				</div>
			</div>
			<div class="text-xs text-ink-gray-5">
				{{ __(description) }}
			</div>
		</div>
		<div class="overflow-y-auto">
			<SettingFields :sections="sections" :data="branding.data" />
		</div>
	</div>
</template>
<script setup>
import { createResource, Button, Badge } from 'frappe-ui'
import SettingFields from '@/components/Settings/SettingFields.vue'
import { watch, ref } from 'vue'

const isDirty = ref(false)

const props = defineProps({
	sections: {
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
	saveSettings.submit(
		{
			fields: getFieldsToSave(),
		},
		{
			onSuccess(data) {
				isDirty.value = false
			},
		}
	)
}

const getFieldsToSave = () => {
	let imageFields = ['favicon', 'banner_image']
	let fieldsToSave = {}

	props.sections.forEach((section) => {
		section.columns.forEach((column) => {
			column.fields.forEach((field) => {
				if (imageFields.includes(field.name)) {
					fieldsToSave[field.name] =
						branding.data[field.name] && branding.data[field.name].file_url
							? branding.data[field.name].file_url
							: null
				} else {
					fieldsToSave[field.name] = branding.data[field.name]
				}
			})
		})
	})

	fieldsToSave['app_logo'] = fieldsToSave['banner_image']
	return fieldsToSave
}

watch(branding, (updatedDoc) => {
	updateDirtyState(updatedDoc)
})

const updateDirtyState = (updatedDoc) => {
	const { textFields, imageFields } = segregateFields()

	textFields.forEach((field) => {
		if (updatedDoc.data[field] != updatedDoc.previousData[field]) {
			isDirty.value = true
		}
	})

	imageFields.forEach((field) => {
		if (
			updatedDoc.data[field]?.file_url !=
			updatedDoc.previousData[field]?.file_url
		) {
			isDirty.value = true
		}
	})
}

const segregateFields = () => {
	let textFields = []
	let imageFields = []

	props.sections.forEach((section) => {
		section.columns.forEach((column) => {
			column.fields.forEach((field) => {
				if (field.type === 'Upload') {
					imageFields.push(field.name)
				} else {
					textFields.push(field.name)
				}
			})
		})
	})
	return { textFields, imageFields }
}
</script>
