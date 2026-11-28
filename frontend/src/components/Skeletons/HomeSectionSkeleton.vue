<template>
	<div class="motion-safe:animate-pulse" aria-hidden="true">
		<div class="mb-3 flex items-center justify-between">
			<SkeletonText :text="headingText" width="w-40" class="w-40" strong />
			<SkeletonText text="text-xs" width="w-12" class="w-12" />
		</div>
		<div
			v-if="kind === 'courses'"
			class="grid grid-cols-1 gap-5 @lg:grid-cols-2 @4xl:grid-cols-3"
		>
			<CourseCardSkeleton v-for="i in 3" :key="i" />
		</div>
		<div v-else class="grid grid-cols-1 gap-5 @lg:grid-cols-2 @4xl:grid-cols-4">
			<BatchCardSkeleton v-for="i in 4" :key="i" />
		</div>
	</div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'
import CourseCardSkeleton from '@/components/Skeletons/CourseCardSkeleton.vue'
import BatchCardSkeleton from '@/components/Skeletons/BatchCardSkeleton.vue'

/**
 * The courses or batches section of pages/Home: its heading and one row of
 * cards, as many as the endpoint returns by default.
 */
const props = withDefaults(
	defineProps<{
		kind: 'courses' | 'batches'
		/** StudentHome sets its headings in smaller type. */
		student?: boolean
	}>(),
	{ student: false }
)

const headingText = computed(() =>
	props.student ? 'font-semibold text-md' : 'text-lg-semibold'
)
</script>
