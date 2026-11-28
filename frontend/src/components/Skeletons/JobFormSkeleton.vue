<template>
	<div
		class="grid grid-cols-1 gap-5 px-5 motion-safe:animate-pulse @4xl:grid-cols-[70%,30%]"
		aria-hidden="true"
		data-testid="job-form-skeleton"
	>
		<div class="space-y-5 pt-5">
			<SkeletonText text="font-semibold" width="w-24" strong />
			<div class="grid grid-cols-1 gap-5 @lg:grid-cols-3">
				<FieldSkeleton v-for="i in 3" :key="i" label-width="w-16" />
			</div>
			<div class="mb-4 space-y-1.5">
				<SkeletonText text="text-sm leading-tighter" width="w-20" />
				<div class="h-[355px] rounded-5 border border-outline-gray-2" />
			</div>
		</div>
		<div class="border-t lg:h-[93vh] lg:border-s lg:border-t-0">
			<div v-if="withStatus" class="space-y-5 border-b py-5 lg:p-5">
				<FieldSkeleton label-width="w-12" />
			</div>
			<div class="space-y-5 border-b py-5 lg:p-5">
				<SkeletonText text="font-semibold" width="w-20" strong />
				<FieldSkeleton v-for="i in 2" :key="i" label-width="w-16" />
			</div>
			<div class="space-y-5 py-5 lg:p-5">
				<SkeletonText text="font-semibold" width="w-32" strong />
				<FieldSkeleton class="mb-4" label-width="w-28" />
				<FieldSkeleton label-width="w-28" />
				<FieldSkeleton class="mb-4" label-width="w-36" />
				<div class="space-y-1.5">
					<SkeletonText text="text-sm leading-tighter" width="w-24" />
					<div class="flex flex-wrap items-start gap-4">
						<div
							class="aspect-[750/422] w-56 max-w-full rounded-5 bg-surface-gray-2"
						/>
						<div class="h-7 w-36 rounded-4 bg-surface-gray-2" />
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import FieldSkeleton from '@/components/Skeletons/FieldSkeleton.vue'
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'

/** pages/Forms/JobForm.vue for a saved job with a company logo. */
defineProps<{ withStatus?: boolean }>()
</script>
