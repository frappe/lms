<template>
	<div
		class="flex items-center justify-between gap-8"
		role="group"
		:aria-labelledby="labelId"
	>
		<div
			:data-testid="testid"
			class="flex size-20 shrink-0 items-center justify-center rounded border border-outline-elevation-2"
		>
			<img
				v-if="image_url"
				:src="safeUrl(image_url)"
				:alt="label"
				class="size-8 rounded"
			/>
			<span
				v-else
				:class="icon"
				class="size-5 text-ink-gray-4"
				aria-hidden="true"
			/>
		</div>
		<div class="flex min-w-0 flex-1 flex-col gap-1">
			<InputLabel
				:id="labelId"
				:label="label"
				:required="required"
				color="gray-7"
				class="font-medium leading-normal"
			/>
			<span v-if="description" class="text-p-base text-ink-gray-6">
				{{ description }}
			</span>
		</div>
		<ImageUploader
			:image_url="image_url"
			:image_type="image_type"
			:is_private="is_private"
			:testid="testid"
			:disabled="disabled"
			@upload="(url) => emit('upload', url)"
			@remove="emit('remove')"
		/>
	</div>
</template>
<script setup lang="ts">
import { useId } from 'vue'
import ImageUploader from '@/components/Controls/ImageUploader.vue'
import { InputLabel } from '@/components/Form/labeling'
import { safeUrl } from '@/utils/safeUrl'

/**
 * A settings row for one image: preview, label, description, and the
 * Upload/Change/Remove buttons (ImageUploader), with privacy passed through.
 *
 * `is_private` is declared at runtime, not as a prop default: an absent
 * Boolean prop casts to false, and false here means the file is public.
 */
defineProps({
	is_private: { type: Boolean, required: true, default: undefined },
	label: { type: String, required: true },
	description: { type: String, default: '' },
	image_url: { type: String, default: '' },
	image_type: { type: String, default: 'image/*' },
	icon: { type: String, default: 'lucide-image' },
	testid: { type: String, default: undefined },
	disabled: { type: Boolean, default: false },
	required: { type: Boolean, default: false },
})

const labelId = useId()

const emit = defineEmits<{
	upload: [url: string]
	remove: []
}>()
</script>
