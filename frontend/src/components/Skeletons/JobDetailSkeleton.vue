<template>
	<div
		class="mx-auto max-w-3xl pt-5 motion-safe:animate-pulse"
		aria-hidden="true"
		data-testid="job-detail-skeleton"
	>
		<div class="p-4">
			<div class="mb-12 space-y-5">
				<div class="flex">
					<!-- The real logo sits in an inline link, whose line box is 45px. -->
					<div class="me-4 h-[45px] shrink-0">
						<div class="size-10 rounded-4 bg-surface-gray-3" />
					</div>
					<div class="flex-1">
						<SkeletonText
							text="text-xl font-semibold"
							width="w-1/2"
							class="mb-1"
							strong
						/>
						<SkeletonText text="text-sm font-semibold" width="w-1/3" />
					</div>
				</div>
				<div class="flex items-center gap-x-2">
					<div
						v-for="width in ['w-24', 'w-20', 'w-20']"
						:key="width"
						class="h-6 rounded-4 bg-surface-gray-2"
						:class="width"
					/>
				</div>
			</div>
			<div class="flex h-3 items-center justify-between">
				<div class="m-1 h-px w-1/2 bg-surface-gray-2" />
				<div class="m-1 h-px w-1/2 bg-surface-gray-2" />
			</div>
			<div class="prose-sm mt-12 space-y-2">
				<SkeletonText text="text-sm" :lines="4" />
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'

/** The job header in pages/JobDetail.vue: logo, title, badges and opening lines. */
</script>
