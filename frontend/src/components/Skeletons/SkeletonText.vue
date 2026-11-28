<template>
	<div :class="text">
		<div v-for="line in lines" :key="line" class="relative">
			&nbsp;
			<span
				class="absolute start-0 top-1/2 h-[0.7em] max-w-full -translate-y-1/2 rounded-4"
				:class="[
					strong ? 'bg-surface-gray-3' : 'bg-surface-gray-2',
					line === lines && lines > 1 ? lastWidth : width,
				]"
			/>
		</div>
	</div>
</template>
<script setup lang="ts">
/**
 * Placeholder lines set in the typography they stand in for, so each line box
 * is exactly as tall as the real text: a non-breaking space holds the line and
 * the bar floats inside it. Callers sit inside an `aria-hidden` skeleton.
 */
withDefaults(
	defineProps<{
		/** The real text's typography class, e.g. `text-p-sm`. */
		text?: string
		lines?: number
		width?: string
		/** Width of the last line when there is more than one. */
		lastWidth?: string
		/** Darker bar, for titles. */
		strong?: boolean
	}>(),
	{
		text: 'text-p-sm',
		lines: 1,
		width: 'w-full',
		lastWidth: 'w-2/3',
		strong: false,
	}
)
</script>
