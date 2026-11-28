<template>
	<div class="motion-safe:animate-pulse" aria-hidden="true">
		<div
			v-for="(width, index) in widths"
			:key="index"
			class="flex h-9 items-center gap-2 px-2"
		>
			<div class="size-4 shrink-0 rounded-4 bg-surface-gray-2" />
			<div class="h-5 rounded-4 bg-surface-gray-2" :class="width" />
		</div>
	</div>
</template>
<script setup lang="ts">
import { computed } from 'vue'

/** 36px chapter and lesson rows of a course outline. */
const props = withDefaults(defineProps<{ count?: number }>(), { count: 8 })

const WIDTHS = ['w-2/3', 'w-1/2', 'w-3/5', 'w-2/5']

const widths = computed(() =>
	Array.from({ length: props.count }, (_, i) => WIDTHS[i % WIDTHS.length])
)
</script>
