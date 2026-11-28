<template>
	<div
		class="grid motion-safe:animate-pulse lg:flex-1 @4xl:grid-cols-[minmax(0,1fr)_300px] @4xl:grid-rows-[auto_1fr]"
		aria-hidden="true"
	>
		<div
			class="order-3 min-w-0 lg:order-none @4xl:col-start-1 lg:row-start-1 @4xl:row-span-2 lg:border-e"
		>
			<SkeletonText
				text="text-lg-semibold"
				width="w-1/3"
				class="mb-4 px-5 pt-5 lg:pe-10"
				strong
			/>
			<div class="divide-y">
				<div
					v-for="i in count"
					:key="i"
					class="flex flex-col gap-3 px-5 py-3 @4xl:grid @4xl:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-10 lg:pe-10"
				>
					<div class="min-w-0 space-y-3">
						<SkeletonText text="text-base leading-6" width="w-3/4" />
						<SkeletonText text="text-base leading-6" width="w-1/2" />
					</div>
					<SkeletonText text="text-sm" width="w-16" class="w-16" />
				</div>
			</div>
		</div>
		<div
			class="order-1 border-b lg:order-none @4xl:col-start-2 lg:row-start-1 lg:border-b-0"
		>
			<div class="flex items-center gap-3 px-5 py-5">
				<div class="size-10 shrink-0 rounded-full bg-surface-gray-2" />
				<div class="min-w-0 flex-1">
					<SkeletonText text="text-base" width="w-1/2" />
					<SkeletonText text="text-xs" width="w-1/3" class="mt-0.5" />
				</div>
			</div>
			<div class="flex gap-6 border-t px-5 py-5">
				<div v-for="i in 2" :key="i" class="w-16">
					<SkeletonText text="text-xs" class="mb-0.5" />
					<SkeletonText text="text-sm" width="w-2/3" />
				</div>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'

/** pages/QuizSubmission.vue: the answers column and the summary sidebar. */
withDefaults(defineProps<{ count?: number }>(), { count: 3 })
</script>
