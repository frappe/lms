<template>
	<div
		data-testid="search-preview"
		class="flex gap-4 rounded-6 border border-outline-gray-2 px-4 py-3.5"
	>
		<div class="min-w-0 flex-1">
			<p class="truncate text-p-sm text-ink-green-6" dir="ltr">{{ url }}</p>
			<p class="truncate text-lg text-ink-blue-5">
				{{ title || __('Untitled') }}
			</p>
			<p
				class="mt-0.5 line-clamp-2 text-p-sm"
				:class="description ? 'text-ink-gray-7' : 'text-ink-gray-6'"
			>
				{{ description || __('Add a description to show here.') }}
			</p>
		</div>
		<img
			v-if="image"
			:src="safeUrl(image)"
			alt=""
			class="size-16 shrink-0 rounded-4 object-cover"
		/>
	</div>
</template>

<script setup lang="ts">
import { safeUrl } from '@/utils/safeUrl'

/** A search result as engines show it: address, title, description and thumbnail. */
defineProps<{
	url: string
	title?: string | null
	description?: string | null
	image?: string | null
}>()
</script>
