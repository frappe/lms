<template>
	<component
		:is="href ? 'a' : 'span'"
		v-if="source"
		:href="href ? safeUrl(href) : undefined"
		:target="href ? '_blank' : undefined"
		:rel="href ? 'noopener' : undefined"
		class="mt-1 inline-flex items-center gap-1 rounded-4 bg-surface-gray-2 px-1.5 py-0.5 text-p-xs text-ink-gray-7"
		:class="
			href
				? 'transition-colors hover:bg-surface-gray-3 hover:text-ink-gray-9'
				: ''
		"
		:title="href ? __('Open the document at this page') : undefined"
	>
		<span class="lucide-file-text size-3" />
		{{ source }}
		<span v-if="href" class="lucide-arrow-up-right size-3" />
	</component>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { safeUrl } from '@/utils/safeUrl'

const props = defineProps<{ source?: string | null }>()
const sourceLink = inject<((source: string) => string | null) | null>(
	'goalSourceLink',
	null
)

const href = computed(() =>
	props.source && sourceLink ? sourceLink(props.source) : null
)
</script>
