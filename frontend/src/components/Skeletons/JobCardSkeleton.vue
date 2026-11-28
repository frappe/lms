<template>
	<div
		class="flex h-full flex-col rounded-5 border p-3 motion-safe:animate-pulse"
		aria-hidden="true"
	>
		<div class="mb-4 flex flex-col space-y-2">
			<SkeletonText text="text-lg-semibold" width="w-1/2" strong />
			<SkeletonText text="leading-5" width="w-2/3" />
			<SkeletonText text="text-sm" width="w-1/3" />
		</div>
		<div class="mt-auto flex items-center gap-x-2">
			<div
				v-for="i in 3"
				:key="i"
				class="h-5 w-16 rounded-4 bg-surface-gray-2"
			/>
		</div>
	</div>
</template>
<script setup lang="ts">
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'

/** components/JobCard.vue for a job with no applicants yet. */
</script>
