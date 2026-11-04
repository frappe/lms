<template>
	<div
		class="flex items-start gap-2 rounded-6 border p-3 text-p-base"
		:class="
			correct
				? 'border-outline-green-3 bg-surface-green-2 text-ink-green-7'
				: 'border-outline-red-3 bg-surface-red-2 text-ink-red-7'
		"
	>
		<span
			:class="correct ? 'lucide-check-circle' : 'lucide-x-circle'"
			class="mt-0.5 size-4 shrink-0"
		/>
		<span><slot /></span>
	</div>
</template>

<script setup lang="ts">
defineProps<{ correct: boolean }>()
</script>
