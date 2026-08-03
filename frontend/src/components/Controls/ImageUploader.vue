<template>
	<FileUploader
		:file-types="image_type"
		:uploadArgs="{ private: false }"
		@success="(file) => emit('upload', file.file_url)"
	>
		<template #default="{ progress, uploading, openFileSelector }">
			<div class="flex items-end space-x-1 rtl:space-x-reverse">
				<Button
					:iconLeft="uploading ? 'cloud-upload' : 'lucide-image-up'"
					:label="
						uploading
							? __('Uploading {0}%').format(progress)
							: image_url
							? __('Change')
							: __('Upload')
					"
					@click="openFileSelector"
				/>
				<Button
					v-if="image_url"
					:label="__('Remove')"
					@click="emit('remove')"
				/>
			</div>
		</template>
	</FileUploader>
</template>
<script setup lang="ts">
import { FileUploader, Button } from 'frappe-ui'

withDefaults(
	defineProps<{
		image_url?: string
		image_type?: string
	}>(),
	{
		image_url: '',
		image_type: 'image/*',
	}
)

const emit = defineEmits<{
	upload: [url: string]
	remove: []
}>()
</script>
