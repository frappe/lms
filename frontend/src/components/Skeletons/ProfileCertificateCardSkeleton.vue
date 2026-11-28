<template>
	<div
		class="flex flex-col overflow-hidden rounded-6 border border-outline-gray-2 motion-safe:animate-pulse"
		aria-hidden="true"
	>
		<div
			class="flex justify-center border-b border-outline-gray-1 bg-surface-gray-1 p-3"
		>
			<div class="aspect-[1122/793] w-64 max-w-full bg-surface-gray-2" />
		</div>
		<div class="flex flex-1 flex-col gap-1.5 p-3">
			<SkeletonText text="font-medium leading-5" width="w-3/4" strong />
			<SkeletonText width="w-1/2" />
		</div>
		<div class="flex items-center gap-2 px-3 pb-3">
			<div class="h-7 w-14 rounded-4 bg-surface-gray-2" />
			<span class="flex-1" />
			<div class="size-7 rounded-4 bg-surface-gray-2" />
			<div class="size-7 rounded-4 bg-surface-gray-2" />
		</div>
	</div>
</template>
<script setup lang="ts">
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'

/** A certificate card in pages/ProfileCertificates.vue, one-line title. */
</script>
