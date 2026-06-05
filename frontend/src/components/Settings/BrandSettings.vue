<template>
	<SettingsLayout
		:title="__('Brand Settings')"
		:description="__('Configure your Brand Name, Logo, and Favicon')"
	>
		<template #header-actions>
			<Button
				v-if="isDirty"
				variant="solid"
				:loading="saveSettings.loading"
				@click="update"
			>
				{{ __('Update') }}
			</Button>
		</template>

		<div v-if="branding.data" class="flex flex-col gap-4 p-2 text-ink-gray-8">
			<!-- Brand Name -->
			<div class="flex items-center justify-between gap-8">
				<div class="flex flex-col">
					<div class="text-p-base font-medium text-ink-gray-7 truncate">
						{{ __('Brand Name') }}
					</div>
					<div class="text-p-sm text-ink-gray-5">
						{{ __('Set the name of your brand. Appears in the left sidebar.') }}
					</div>
				</div>
				<div class="flex items-center gap-2">
					<FormControl
						type="text"
						size="md"
						:placeholder="__('Enter Brand Name')"
						:modelValue="branding.data.app_name"
						@input="
							(e) => {
								branding.data.app_name = e.target.value
								isDirty = true
							}
						"
					/>
				</div>
			</div>
			<div class="h-px border-t border-outline-gray-modals" />

			<!-- Logo -->
			<div class="flex flex-col justify-between gap-4">
				<div class="flex items-center flex-1 gap-5">
					<div
						class="flex items-center justify-center rounded border border-outline-gray-modals size-20"
					>
						<img
							v-if="branding.data.banner_image?.file_url"
							:src="branding.data.banner_image.file_url"
							alt="Logo"
							class="size-8 rounded"
						/>
						<ImageIcon v-else class="size-5 text-ink-gray-4" />
					</div>
					<div class="flex flex-1 flex-col gap-1">
						<span class="text-base font-medium">{{ __('Brand Logo') }}</span>
						<span class="text-p-base text-ink-gray-6">
							{{
								__(
									'Appears in the left sidebar. Recommended size is 32x32 px in PNG or SVG'
								)
							}}
						</span>
					</div>
					<div>
						<ImageUploader
							:image_url="branding.data.banner_image?.file_url || ''"
							@upload="(url) => setImage('banner_image', url)"
							@remove="() => setImage('banner_image', null)"
						/>
					</div>
				</div>
			</div>

			<!-- Favicon -->
			<div class="flex flex-col justify-between gap-4">
				<div class="flex items-center flex-1 gap-5">
					<div
						class="flex items-center justify-center rounded border border-outline-gray-modals size-20"
					>
						<img
							v-if="branding.data.favicon?.file_url"
							:src="branding.data.favicon.file_url"
							alt="Favicon"
							class="size-8 rounded"
						/>
						<ImageIcon v-else class="size-5 text-ink-gray-4" />
					</div>
					<div class="flex flex-1 flex-col gap-1">
						<span class="text-base font-medium">{{ __('Favicon') }}</span>
						<span class="text-p-base text-ink-gray-6">
							{{
								__(
									'Appears next to the title in your browser tab. Recommended size is 32x32 px in PNG or ICO'
								)
							}}
						</span>
					</div>
					<div>
						<ImageUploader
							:image_url="branding.data.favicon?.file_url || ''"
							@upload="(url) => setImage('favicon', url)"
							@remove="() => setImage('favicon', null)"
						/>
					</div>
				</div>
			</div>
		</div>
	</SettingsLayout>
</template>
<script setup>
import { createResource, Button, FormControl } from 'frappe-ui'
import { Image as ImageIcon } from 'lucide-vue-next'
import SettingsLayout from '@/components/Layouts/SettingsLayout.vue'
import ImageUploader from '@/components/Controls/ImageUploader.vue'
import { ref } from 'vue'

defineProps({
	label: { type: String },
	description: { type: String },
})

const isDirty = ref(false)

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
	isDirty.value = true
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

const update = () => {
	saveSettings.submit(
		{ fields: getFieldsToSave() },
		{
			onSuccess() {
				isDirty.value = false
			},
		}
	)
}
</script>
