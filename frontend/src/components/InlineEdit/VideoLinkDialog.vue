<template>
	<Dialog v-model:open="open" size="xl" :title="__('Preview video')">
		<template #default>
			<div class="@container">
				<VideoPreviewField
					:modelValue="link || ''"
					@update:modelValue="(url: string) => (link = url)"
				/>
			</div>
		</template>
		<template #actions>
			<div class="flex justify-end">
				<Button variant="solid" @click="open = false">
					{{ __('Done') }}
				</Button>
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { Button, Dialog } from 'frappe-ui'
import VideoPreviewField from '@/components/Controls/VideoPreviewField.vue'

/** Sets a preview video link: paste a YouTube link or upload a file. */
const open = defineModel<boolean>('open', { default: false })
const link = defineModel<string | null | undefined>()
</script>
