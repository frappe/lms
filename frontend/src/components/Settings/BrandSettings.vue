<template>
	<SettingsLayout
		:title="__('Brand Settings')"
		:save-state="autosave.status.value"
	>
		<div v-if="branding.data" class="flex flex-col gap-4 p-2 text-ink-gray-8">
			<div class="flex items-center justify-between gap-8">
				<div class="flex flex-col">
					<div class="text-p-base-medium text-ink-gray-7 truncate">
						{{ __('Brand Name') }}
					</div>
					<div class="text-p-sm text-ink-gray-5">
						{{ __('Set the name of your brand. Appears in the left sidebar.') }}
					</div>
				</div>
				<div
					class="flex items-center gap-2"
					@input="autosave.commit('typing')"
					@focusout="() => autosave.commit('now')"
				>
					<FormControl
						type="text"
						size="md"
						:aria-label="__('Brand Name')"
						:placeholder="__('Enter Brand Name')"
						:modelValue="branding.data.app_name"
						@input="(e) => (branding.data.app_name = e.target.value)"
					/>
				</div>
			</div>
			<div class="h-px border-t border-outline-elevation-2" />

			<ImageUploadField
				:label="__('Brand Logo')"
				:description="
					__(
						'Appears in the left sidebar. Recommended size is 32x32 px in PNG or SVG'
					)
				"
				:image_url="branding.data.banner_image?.file_url || ''"
				:is_private="false"
				@upload="(url) => setImage('banner_image', url)"
				@remove="() => setImage('banner_image', null)"
			/>

			<ImageUploadField
				:label="__('Favicon')"
				:description="
					__(
						'Appears next to the title in your browser tab. Recommended size is 32x32 px in PNG or ICO'
					)
				"
				:image_url="branding.data.favicon?.file_url || ''"
				:is_private="false"
				@upload="(url) => setImage('favicon', url)"
				@remove="() => setImage('favicon', null)"
			/>
		</div>
	</SettingsLayout>
</template>
<script setup>
import { createResource, FormControl } from 'frappe-ui'
import SettingsLayout from '@/components/Layouts/settings/desktop/SettingsLayout.vue'
import ImageUploadField from '@/components/Controls/ImageUploadField.vue'
import { ref, watch } from 'vue'
import { useAutosave } from '@/composables/useAutosave'

defineProps({
	label: { type: String },
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

const setImage = (field, url) => {
	branding.data[field] = url ? { file_url: url } : null
	autosave.commit('now')
}

const getFieldsToSave = () => {
	const imageUrl = (field) =>
		branding.data[field]?.file_url ? branding.data[field].file_url : null
	const fields = {
		app_name: branding.data.app_name,
		banner_image: imageUrl('banner_image'),
		favicon: imageUrl('favicon'),
	}
	fields.app_logo = fields.banner_image
	return fields
}

// Website Settings behind a custom endpoint, so there's no isDirty to
// borrow. Clone what the server last gave us and compare, the way
// documentResource does with originalDoc.
const savedFields = ref(null)

watch(
	() => branding.data,
	(data) => {
		if (data) savedFields.value = JSON.stringify(getFieldsToSave())
	},
	{ immediate: true }
)

const autosave = useAutosave({
	isDirty: () =>
		Boolean(branding.data) &&
		JSON.stringify(getFieldsToSave()) !== savedFields.value,
	write: () => {
		// Snapshot what is sent, and baseline against that. Reading the fields
		// again on the response absorbs anything typed while the write was in
		// flight, and useAutosave's queued replay then drops it as not dirty.
		const sent = getFieldsToSave()
		return saveSettings
			.submit({ fields: sent })
			.then(() => (savedFields.value = JSON.stringify(sent)))
	},
})
</script>
