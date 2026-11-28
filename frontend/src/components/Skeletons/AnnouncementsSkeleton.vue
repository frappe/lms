<template>
	<EmptyStateSkeleton
		v-if="empty"
		class="min-h-[60vh]"
		:description-lines="2"
	/>
	<div v-else class="motion-safe:animate-pulse" aria-hidden="true">
		<SkeletonText
			text="text-lg-semibold"
			width="w-36"
			class="mb-5 w-36"
			strong
		/>
		<div v-for="i in count" :key="i" class="mb-8">
			<div class="mb-2 flex items-center justify-between">
				<div class="flex items-center">
					<div class="size-8 rounded-full bg-surface-gray-2" />
					<SkeletonText text="" width="w-28" class="ms-2 w-28" />
				</div>
				<SkeletonText text="text-sm" width="w-16" class="w-16" />
			</div>
			<div
				class="prose prose-sm !min-w-full rounded-5 bg-surface-sidebar px-4 py-2"
			>
				<SkeletonText text="" :lines="2" class="mb-2" />
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import EmptyStateSkeleton from '@/components/Skeletons/EmptyStateSkeleton.vue'
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'

/** The Announcements tab of a batch: its posts, or its empty state. */
withDefaults(defineProps<{ empty?: boolean; count?: number }>(), {
	empty: false,
	count: 2,
})
</script>
