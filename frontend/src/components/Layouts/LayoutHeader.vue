<template>
	<SkeletonLoader v-if="isLoading" variant="header" />
	<header
		v-else
		class="sticky top-0 z-10 flex items-center justify-between border-b bg-surface-white px-3 py-2.5 sm:px-5"
	>
		<div class="flex items-center gap-2">
			<slot name="left-header" />
		</div>
		<div class="flex items-center gap-2">
			<slot name="right-header" />
		</div>
	</header>
</template>

<script setup lang="ts">
import SkeletonLoader from '@/components/SkeletonLoader.vue'

withDefaults(defineProps<{ isLoading?: boolean }>(), {
	isLoading: false,
})
</script>
