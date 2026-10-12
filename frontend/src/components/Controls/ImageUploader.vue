<template>
	<FileUploader
		:file-types="image_type"
		:uploadArgs="{ private: is_private }"
		:validateFile="validate"
		@success="(file) => emit('upload', file.file_url)"
	>
		<template #default="{ progress, uploading, openFileSelector }">
			<div class="flex items-end space-x-1 rtl:space-x-reverse">
				<Button
					:data-testid="testid ? `${testid}-upload` : undefined"
					:iconLeft="uploading ? 'cloud-upload' : 'lucide-image-up'"
					:loading="uploading"
					:disabled="disabled"
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
					v-if="image_url && !disabled"
					:data-testid="testid ? `${testid}-remove` : undefined"
					:label="__('Remove')"
					@click="emit('remove')"
				/>
			</div>
		</template>
	</FileUploader>
</template>
<script setup lang="ts">
import { FileUploader, Button } from 'frappe-ui'
import { validateFile } from '@/utils'

/**
 * `is_private` is declared at runtime, not through the type-only form,
 * because Vue casts an absent Boolean prop to false, which here would mean
 * silently public. `default: undefined` stops that (resolvePropValue casts
 * only when there's no default), so an omitted `is_private` stays undefined
 * and frappe-ui's FileUploader reads that as private, the safe default.
 */
defineProps({
	is_private: { type: Boolean, required: true, default: undefined },
	image_url: { type: String, default: '' },
	image_type: { type: String, default: 'image/*' },
	testid: { type: String, default: undefined },
	// A read-only field still shows its image; it just offers no way to change
	// it. Plain Boolean, unlike is_private: absent means "not disabled", which
	// is both the safe reading and the common one.
	disabled: { type: Boolean, default: false },
})

const emit = defineEmits<{
	upload: [url: string]
	remove: []
}>()

const validate = (file: File) => validateFile(file, true, 'image')
</script>
