<template>
	<!-- In place of a chart's "No data to show": an icon and what fills it. -->
	<div
		class="flex h-full flex-col items-center justify-center gap-2 px-6 text-center"
	>
		<span
			class="lucide-chart-no-axes-column size-5 text-ink-gray-4"
			aria-hidden="true"
		/>
		<p class="max-w-64 text-p-sm text-ink-gray-6">{{ text }}</p>
	</div>
</template>

<script setup lang="ts">
defineProps<{ text: string }>()
</script>
