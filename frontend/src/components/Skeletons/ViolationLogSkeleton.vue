<template>
	<ol
		class="border-s border-outline-gray-2 ps-4 motion-safe:animate-pulse"
		aria-hidden="true"
	>
		<li v-for="i in count" :key="i" class="pb-4 last:pb-0">
			<SkeletonText text="text-xs leading-5" width="w-1/2" />
			<SkeletonText text="text-xs leading-5" width="w-1/3" class="mt-0.5" />
		</li>
	</ol>
</template>
<script setup lang="ts">
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'

/** The proctoring log timeline in pages/QuizSubmission.vue. */
withDefaults(defineProps<{ count?: number }>(), { count: 2 })
</script>
