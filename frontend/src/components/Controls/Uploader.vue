<template>
	<div class="mb-4">
		<div v-if="label" class="text-xs text-ink-gray-5 mb-2">
			{{ __(label) }}
			<span v-if="required" class="text-ink-red-3">*</span>
		</div>
		<FileUploader
			:fileTypes="[fileType]"
			:validateFile="(file: File) => validateFile(file, true, type)"
			@success="(file: { file_url: string }) => saveFile(file)"
			@failure="onUploadFailure"
		>
			<template v-slot="{ uploading, progress, openFileSelector }">
				<div class="flex items-start gap-4">
					<div
						:class="[
							'relative shrink-0 border rounded-md bg-surface-gray-2 grid place-items-center overflow-hidden',
							previewBoxClasses,
						]"
					>
						<template v-if="modelValue">
							<img
								v-if="type === 'image'"
								:src="modelValue"
								class="size-full object-cover"
							/>
							<video v-else controls class="size-full object-cover">
								<source :src="modelValue" />
								{{ __('Your browser does not support the video tag.') }}
							</video>
						</template>
						<component
							v-else
							:is="type === 'image' ? Image : Video"
							class="size-5 stroke-1 text-ink-gray-5"
						/>
					</div>
					<div class="flex items-center gap-2">
						<Button @click="openFileSelector" :loading="uploading">
							{{
								uploading
									? `${__('Uploading')} ${progress}%`
									: modelValue
									? __('Replace')
									: __('Upload')
							}}
						</Button>
						<Button
							v-if="modelValue && !uploading"
							variant="ghost"
							theme="red"
							@click="removeImage()"
						>
							{{ __('Remove') }}
						</Button>
					</div>
				</div>
			</template>
		</FileUploader>
	</div>
</template>

<script setup lang="ts">
import { validateFile } from '@/utils'
import { Button, FileUploader, toast } from 'frappe-ui'
import { Image, Video } from 'lucide-vue-next'
import { computed } from 'vue'

const emit = defineEmits<{
	(e: 'update:modelValue', value: string): void
}>()

const props = withDefaults(
	defineProps<{
		modelValue: string | null
		label?: string
		type?: 'image' | 'video'
		required?: boolean
		shape?: 'square' | 'circle'
	}>(),
	{
		type: 'image',
		required: true,
		shape: 'square',
	}
)

const fileType = computed<string>(() =>
	props.type === 'image' ? 'image/*' : 'video/*'
)

const previewBoxClasses = computed<string>(() => {
	if (props.shape === 'circle') return 'size-24 rounded-full'
	return 'w-56 aspect-[750/422] rounded-md'
})

const saveFile = (file: { file_url: string }) => {
	emit('update:modelValue', file.file_url)
}

const removeImage = () => {
	emit('update:modelValue', '')
}

const onUploadFailure = (error: any) => {
	let message = __('Error Uploading File')
	if (error?._server_messages) {
		message = JSON.parse(JSON.parse(error._server_messages)[0]).message
	} else if (error?.exc) {
		message = JSON.parse(error.exc)[0].split('\n').slice(-2, -1)[0]
	}
	toast.error(message)
}
</script>
