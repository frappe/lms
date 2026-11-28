<template>
	<div
		class="text-base motion-safe:animate-pulse"
		aria-hidden="true"
		data-testid="program-enrollment-skeleton"
	>
		<div class="rounded-5 bg-surface-gray-2 p-2">
			<SkeletonText text="leading-5" :lines="2" class="invisible" />
		</div>
		<div class="mt-5">
			<SkeletonText text="text-sm-semibold" width="w-36" />
			<div class="mt-2 grid grid-cols-1 gap-4 @2xl:grid-cols-2">
				<div
					v-for="i in 2"
					:key="i"
					class="flex flex-col rounded-5 border border-outline-gray-2 p-2"
				>
					<SkeletonText text="font-semibold leading-5" width="w-3/4" strong />
					<div class="mb-8 mt-2 flex items-center gap-x-5">
						<SkeletonText text="text-sm" width="w-20" class="w-20" />
						<SkeletonText text="text-sm" width="w-20" class="w-20" />
					</div>
					<div class="flex items-center gap-x-2.5">
						<div class="size-6 shrink-0 rounded-full bg-surface-gray-2" />
						<SkeletonText text="" width="w-28" class="w-28" />
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'

/** The summary in pages/Programs/ProgramEnrollment.vue: a note and course cards. */
</script>
