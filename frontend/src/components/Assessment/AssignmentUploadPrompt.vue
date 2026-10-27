<template>
	<div
		data-testid="assignment-dropzone"
		class="flex flex-col items-center gap-2 rounded-5 border border-outline-gray-2 bg-surface-gray-1 px-4 py-5 text-center"
	>
		<span class="lucide-file-up size-5 text-ink-gray-5" />
		<span class="text-base text-ink-gray-7">
			{{ __('Upload Assignment') }}
		</span>
		<slot />
		<span class="text-xs text-ink-gray-5">
			{{ __('You can only upload {0} files').format(type) }}
		</span>
	</div>
</template>

<script setup lang="ts">
defineProps<{ type: string }>()
</script>
