<template>
	<div class="space-y-1.5">
		<InputLabel
			v-if="label"
			:id="labelId"
			:for-id="inputId"
			:label="label ? __(label) : undefined"
			:required="required"
		/>
		<FileUploader
			:fileTypes="[fileType]"
			:uploadArgs="{ private: false }"
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
								:src="safeUrl(modelValue)"
								:alt="label ? __(label) : __('Uploaded image preview')"
								class="size-full object-cover"
							/>
							<video v-else controls class="size-full object-cover">
								<source :src="safeUrl(modelValue)" />
								{{ __('Your browser does not support the video tag.') }}
							</video>
						</template>
						<component
							v-else
							:is="type === 'image' ? Image : Video"
							class="size-5 text-ink-gray-5"
						/>
					</div>
					<div class="flex items-center gap-2">
						<Button
							:id="inputId"
							@click="openFileSelector"
							:loading="uploading"
						>
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
		<InputDescription
			v-if="showDescription"
			:id="descriptionId"
			:description="description ? __(description) : undefined"
		/>
		<InputError v-if="hasError" :id="errorMessageId" :lines="errorLines" />
	</div>
</template>

<script setup lang="ts">
import { validateFile } from '@/utils'
import { Button, FileUploader, toast } from 'frappe-ui'
import {
	InputDescription,
	InputError,
	InputLabel,
	useInputLabeling,
} from '@/components/Form/labeling'
import { Image, Video } from 'lucide-vue-next'
import { computed } from 'vue'
import { safeUrl } from '@/utils/safeUrl'

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
		description?: string
		error?: string
	}>(),
	{
		type: 'image',
		required: true,
		shape: 'square',
	}
)

const {
	inputId,
	labelId,
	descriptionId,
	errorMessageId,
	hasError,
	errorLines,
	showDescription,
} = useInputLabeling(props)

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
