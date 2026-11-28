<template>
	<div
		class="flex gap-2 motion-safe:animate-pulse"
		:class="scroll ? 'overflow-hidden pb-2' : 'overflow-hidden'"
		aria-hidden="true"
	>
		<div
			v-for="(width, index) in widths"
			:key="index"
			class="shrink-0 rounded-4 border border-transparent bg-surface-gray-2 px-2.5 py-1 text-p-sm"
			:class="width"
		>
			&nbsp;
		</div>
	</div>
</template>
<script setup lang="ts">
import { computed } from 'vue'

/** Category chips: the real chips' box, padding and type, without the words.
 * One row, like CategoryChips. */
const props = withDefaults(
	defineProps<{
		count?: number
		/** Mirrors a row that scrolls sideways instead of wrapping. */
		scroll?: boolean
	}>(),
	{ count: 6, scroll: false }
)

const WIDTHS = ['w-10', 'w-20', 'w-24', 'w-16', 'w-28', 'w-20', 'w-24', 'w-16']

const widths = computed(() =>
	Array.from({ length: props.count }, (_, i) => WIDTHS[i % WIDTHS.length])
)
</script>
