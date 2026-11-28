<template>
	<div
		class="rounded-5 border p-3 motion-safe:animate-pulse"
		aria-hidden="true"
	>
		<SkeletonText text="text-lg-semibold" width="w-1/2" class="mb-2" strong />
		<div class="flex items-center gap-x-5">
			<SkeletonText text="text-sm" width="w-20" class="w-20" />
			<SkeletonText text="text-sm" width="w-20" class="w-20" />
		</div>
		<div v-if="progress" class="mt-5">
			<div class="h-1 rounded-full bg-surface-gray-3" />
			<SkeletonText text="text-sm" width="w-24" class="mt-1" />
		</div>
	</div>
</template>
<script setup lang="ts">
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'

/** A program card in pages/Programs/StudentPrograms.vue. */
defineProps<{ progress?: boolean }>()
</script>
