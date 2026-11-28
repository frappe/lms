<template>
	<div class="space-y-4 motion-safe:animate-pulse" aria-hidden="true">
		<div v-for="i in 3" :key="i" class="space-y-1.5">
			<SkeletonText text="text-sm leading-tighter" width="w-24" />
			<div class="h-7 rounded-4 bg-surface-gray-2" />
		</div>
		<div class="-m-2 flex items-center justify-between gap-3 p-2">
			<div class="flex min-w-0 flex-1 flex-col gap-1">
				<SkeletonText text="text-p-base" width="w-1/3" />
				<SkeletonText text="text-p-sm" width="w-2/3" />
			</div>
			<div class="h-4 w-7 shrink-0 rounded-full bg-surface-gray-2" />
		</div>
		<div class="space-y-1.5">
			<SkeletonText text="text-sm leading-tighter" width="w-20" />
			<div class="h-[223px] rounded-4 border border-outline-gray-2">
				<div class="h-10 border-b border-outline-gray-2" />
				<SkeletonText :lines="3" class="p-3" />
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'

/** pages/Forms/AssignmentForm.vue for an assignment without a schedule. */
</script>
