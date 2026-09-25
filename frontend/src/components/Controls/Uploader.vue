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
			:private="false"
			:validateFile="(file: File) => validateFile(file, false, type)"
			@success="(file: { file_url: string }) => saveFile(file)"
			@failure="onUploadFailure"
		>
			<template v-slot="{ uploading, progress, openFileSelector }">
				<div
					class="flex"
					:class="size === 'sm' ? 'items-center gap-3' : 'items-start gap-4'"
				>
					<div
						:class="[
							'relative shrink-0 border rounded-5 bg-surface-gray-2 grid place-items-center overflow-hidden',
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
					<div
						:class="
							size === 'sm'
								? 'flex min-w-0 flex-col items-start gap-1.5'
								: 'flex items-center gap-2'
						"
					>
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
						<!-- The small preview leaves room beside it, so the hint sits
						     there instead of under the whole control. -->
						<InputDescription
							v-if="size === 'sm' && showDescription"
							:id="descriptionId"
							:description="description ? __(description) : undefined"
						/>
					</div>
				</div>
			</template>
		</FileUploader>
		<InputDescription
			v-if="size !== 'sm' && showDescription"
			:id="descriptionId"
			:description="description ? __(description) : undefined"
		/>
		<InputError v-if="hasError" :id="errorMessageId" :lines="errorLines" />
	</div>
</template>

<script setup lang="ts">
import { validateFile } from '@/utils'
import { Button, FileUploader, UploadError, toast } from 'frappe-ui'
import {
	InputDescription,
	InputError,
	InputLabel,
	useInputLabeling,
} from 'frappe-ui/experimental'
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
		size?: 'sm' | 'md'
		description?: string
		error?: string
	}>(),
	{
		type: 'image',
		required: true,
		shape: 'square',
		size: 'md',
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
	if (props.size === 'sm') return 'w-24 aspect-[750/422] rounded-4'
	return 'w-56 aspect-[750/422] rounded-5'
})

const saveFile = (file: { file_url: string }) => {
	emit('update:modelValue', file.file_url)
}

const removeImage = () => {
	emit('update:modelValue', '')
}

const uploadErrorMessage = (error: unknown): string => {
	if (typeof error === 'string') return error
	if (error instanceof UploadError) return error.messages[0] || error.message
	return __('Error Uploading File')
}

const onUploadFailure = (error: unknown) => {
	toast.error(uploadErrorMessage(error))
}
</script>
