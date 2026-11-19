<template>
	<span class="flex items-center gap-2">
		<!-- Tiles fill from the left by count, so they read as progress, not as which item. -->
		<span class="flex gap-0.5" aria-hidden="true">
			<span
				v-for="i in total"
				:key="i"
				class="h-1 w-3.5 rounded-full"
				:class="i <= done ? 'bg-surface-gray-7' : 'bg-surface-gray-3'"
			/>
		</span>
		<span class="hidden sm:inline">{{ label }}</span>
		<span class="sm:hidden">{{ `${done}/${total}` }}</span>
	</span>
</template>

<script setup lang="ts">
defineProps<{ done: number; total: number; label: string }>()
</script>
