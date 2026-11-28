<template>
	<div
		class="flex h-full flex-col gap-1.5 rounded-6 border border-outline-gray-2 bg-surface-base p-4 motion-safe:animate-pulse"
		aria-hidden="true"
	>
		<div class="flex min-h-6 items-center justify-between gap-2">
			<SkeletonText text="text-p-xs-medium" width="w-20" class="w-20" />
			<!-- The real avatars sit in inline links, whose line box is 25px. -->
			<div class="flex h-[25px] items-center">
				<div class="size-5 rounded-full bg-surface-gray-2" />
			</div>
		</div>
		<SkeletonText
			text="text-base-semibold leading-snug"
			:lines="2"
			last-width="w-1/2"
			strong
		/>
		<SkeletonText :lines="2" />
		<div class="mt-3 space-y-2">
			<SkeletonText v-for="width in ROW_WIDTHS" :key="width" :width="width" />
		</div>
		<div class="mt-auto flex items-center justify-between gap-2 pt-4">
			<div class="h-5 w-20 rounded-4 bg-surface-gray-2" />
			<SkeletonText width="w-10" class="w-10" />
		</div>
	</div>
</template>
<script setup lang="ts">
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'

/** pages/Batches/components/BatchCard.vue with a two-line title and four detail rows. */
const ROW_WIDTHS = ['w-2/3', 'w-1/2', 'w-3/5', 'w-1/3']
</script>
