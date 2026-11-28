<template>
	<div class="space-y-6 motion-safe:animate-pulse" aria-hidden="true">
		<div
			class="flex flex-col gap-4 rounded-6 border border-outline-gray-2 px-5 py-4 @2xl:flex-row @2xl:items-center @2xl:gap-6"
		>
			<div
				class="flex shrink-0 flex-col items-center gap-1.5 @2xl:w-32 @2xl:border-e @2xl:border-outline-gray-2 @2xl:pe-6"
			>
				<SkeletonText text="text-3xl-semibold" width="w-8" class="w-8" strong />
				<div class="h-4 w-24 rounded-4 bg-surface-gray-2" />
				<SkeletonText width="w-16" class="w-16" />
			</div>
			<div class="flex flex-1 flex-col">
				<div
					v-for="row in 5"
					:key="row"
					class="flex items-center gap-2 px-1.5 py-0.5 text-p-sm"
				>
					&nbsp;
					<span class="h-1.5 flex-1 rounded-full bg-surface-gray-2" />
				</div>
			</div>
		</div>
		<div class="grid grid-cols-1 gap-4 @2xl:grid-cols-2">
			<div
				v-for="card in 2"
				:key="card"
				class="flex flex-col gap-2.5 rounded-6 border border-outline-gray-2 p-4"
			>
				<div class="h-4 w-24 rounded-4 bg-surface-gray-2" />
				<SkeletonText text="text-p-base leading-6" width="w-3/4" />
				<div class="flex items-center gap-2">
					<div class="size-5 rounded-full bg-surface-gray-2" />
					<SkeletonText text="text-p-base" width="w-28" class="w-28" />
				</div>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'

/** The body of components/CourseReviews.vue: rating summary and two reviews. */
</script>
