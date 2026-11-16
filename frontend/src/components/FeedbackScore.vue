<template>
	<span
		class="inline-flex items-center gap-1 text-base-medium tabular-nums text-ink-gray-8"
		:data-rating="field"
	>
		<template v-if="stars">
			<span class="lucide-star size-3.5 text-ink-yellow-5" aria-hidden="true" />
			<span class="sr-only">{{ label }}:</span>
			{{ stars }}
		</template>
		<template v-else>
			<span class="text-ink-gray-4" aria-hidden="true">–</span>
			<span class="sr-only"> {{ label }}: {{ __('Not rated') }} </span>
		</template>
	</span>
</template>

<script setup lang="ts">
defineProps<{ field: string; label: string; stars: number }>()
</script>
