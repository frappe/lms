<template>
	<div class="mb-4">
		<div v-if="label" class="text-xs text-ink-gray-5 mb-2">
			{{ __(label) }}
			<span v-if="required" class="text-ink-red-3">*</span>
		</div>
		<FileUploader
			v-if="!modelValue"
			:fileTypes="[fileType]"
			:validateFile="(file: File) => validateFile(file, true, type)"
			@success="(file: File) => saveFile(file)"
		>
			<template v-slot="{ file, progress, uploading, openFileSelector }">
				<div class="flex items-center">
					<div class="border rounded-md w-fit py-7 px-20">
						<component
							:is="props.type === 'image' ? Image : Video"
							class="size-5 stroke-1 text-ink-gray-7"
						/>
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
				<img
					v-if="type == 'image'"
					:src="modelValue"
					:class="[
						'border object-cover',
						shape === 'circle'
							? 'w-20 h-20 rounded-full'
							: 'w-44 h-auto min-h-20 rounded-md',
					]"
				/>
				<video v-else controls class="border rounded-md w-44 h-auto">
					<source :src="modelValue" />
					{{ __('Your browser does not support the video tag.') }}
				</video>
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
import { Image, Video } from 'lucide-vue-next'
import { computed } from 'vue'

const emit = defineEmits<{
	(e: 'update:modelValue', value: string): void
}>()

const props = withDefaults(
	defineProps<{
		modelValue: string | null
		label?: string
		description?: string
		type?: 'image' | 'video'
		required?: boolean
		shape?: 'square' | 'circle'
	}>(),
	{
		modelValue: '',
		label: '',
		description: '',
		type: 'image',
		required: true,
		shape: 'square',
	}
)

const fileType = computed(() => {
	return props.type === 'image' ? 'image/*' : 'video/*'
})

const saveFile = (file: any) => {
	emit('update:modelValue', file.file_url)
}

const removeImage = () => {
	emit('update:modelValue', '')
}
</script>
