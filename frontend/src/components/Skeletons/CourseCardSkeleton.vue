<template>
	<div
		class="flex h-full flex-col rounded-6 border border-outline-gray-2 bg-surface-base p-2 motion-safe:animate-pulse"
		aria-hidden="true"
	>
		<div class="h-40 shrink-0 rounded-4 bg-surface-gray-2" />
		<div class="flex flex-1 flex-col gap-1.5 px-2 pb-1.5 pt-3">
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
			<div class="mt-auto flex items-center justify-between gap-4 pt-3">
				<SkeletonText width="w-12" class="w-12" />
				<SkeletonText width="w-10" class="w-10" />
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'

/** components/CourseCard.vue with a two-line title and introduction. */
</script>
