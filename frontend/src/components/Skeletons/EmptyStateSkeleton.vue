<template>
	<div
		class="flex h-full min-h-64 w-full grow items-center justify-center motion-safe:animate-pulse"
		aria-hidden="true"
	>
		<div class="flex w-full flex-col items-center gap-3 px-6 sm:px-4">
			<div class="size-10 rounded-4 bg-surface-gray-2 sm:size-7.5" />
			<div class="flex w-full flex-col items-center gap-1">
				<SkeletonText
					text="text-base-medium sm:text-lg-medium"
					class="w-40"
					strong
				/>
				<SkeletonText
					text="text-p-sm sm:text-p-base"
					:lines="descriptionLines"
					last-width="w-3/4"
					class="w-[36rem] max-w-full"
				/>
			</div>
			<div v-if="action" class="h-7 w-32 rounded-4 bg-surface-gray-2" />
		</div>
	</div>
</template>

<script setup lang="ts">
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'

/** components/Layouts/EmptyStateLayout.vue with one action button. */
withDefaults(defineProps<{ descriptionLines?: number; action?: boolean }>(), {
	descriptionLines: 1,
	action: true,
})
</script>
