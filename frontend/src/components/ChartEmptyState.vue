<template>
	<div class="flex h-full w-full flex-col">
		<div class="space-y-1">
			<div class="text-base text-ink-gray-9">{{ title }}</div>
			<div v-if="subtitle" class="text-sm text-ink-gray-6">{{ subtitle }}</div>
		</div>
		<div
			class="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center"
		>
			<span class="size-6 text-ink-gray-5" :class="icon" aria-hidden="true" />
			<p class="max-w-sm text-p-sm text-ink-gray-6">{{ message }}</p>
		</div>
	</div>
</template>
<script setup lang="ts">
// Stands in for a chart with nothing to plot: a flat line at zero, or an
// axis-less "No data to show", tells a new site nothing about what will appear.
withDefaults(
	defineProps<{
		title: string
		subtitle?: string
		message: string
		icon?: string
	}>(),
	{ subtitle: '', icon: 'lucide-chart-line' }
)
</script>
