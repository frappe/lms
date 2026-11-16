<template>
	<div
		class="flex items-center gap-3 rounded-5 border border-dashed border-outline-gray-2 p-4"
	>
		<span
			class="size-5 shrink-0 text-ink-gray-5"
			:class="icon"
			aria-hidden="true"
		/>
		<p class="text-p-sm text-ink-gray-6">{{ message }}</p>
	</div>
</template>
<script setup lang="ts">
// An empty section inside a form or tab, whose own Add button sits above it:
// says what belongs here instead of only that nothing does.
withDefaults(defineProps<{ message: string; icon?: string }>(), {
	icon: 'lucide-inbox',
})
</script>
