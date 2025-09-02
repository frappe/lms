<template>
	<div class="mb-4">
		<div v-if="label" class="text-xs text-ink-gray-5 mb-2">
			{{ __(label) }}
			<span class="text-ink-red-3">*</span>
		</div>
		<FileUploader
			v-if="!modelValue"
			:fileTypes="['image/*']"
			:validateFile="validateFile"
			@success="(file: File) => saveImage(file)"
		>
			<template v-slot="{ file, progress, uploading, openFileSelector }">
				<div class="flex items-center">
					<div class="border rounded-md w-fit py-7 px-20">
						<Image class="size-5 stroke-1 text-ink-gray-7" />
					</div>
					<div class="ml-4">
						<Button @click="openFileSelector">
							{{ __('Upload') }}
						</Button>
						<div class="mt-1 text-ink-gray-5 text-sm leading-5">
							{{ __(description) }}
						</div>
					</div>
				</div>
			</template>
		</FileUploader>
		<div v-else class="mb-4">
			<div class="flex items-center">
				<img :src="modelValue" class="border rounded-md w-44 h-auto" />
				<div class="ml-4">
					<Button @click="removeImage()">
						{{ __('Remove') }}
					</Button>
					<div
						v-if="description"
						class="mt-2 text-ink-gray-5 text-sm leading-5"
					>
						{{ __(description) }}
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import { validateFile } from '@/utils'
import { Button, FileUploader } from 'frappe-ui'
import { Image } from 'lucide-vue-next'

const emit = defineEmits<{
	(e: 'update:modelValue', value: string): void
}>()

const props = withDefaults(
	defineProps<{
		modelValue: string
		label?: string
		description?: string
	}>(),
	{
		modelValue: '',
		label: '',
		description: '',
	}
)

const saveImage = (file: any) => {
	emit('update:modelValue', file.file_url)
}

const removeImage = () => {
	emit('update:modelValue', '')
}
</script>
