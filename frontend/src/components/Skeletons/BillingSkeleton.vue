<template>
	<div
		class="px-5 pb-10 motion-safe:animate-pulse"
		aria-hidden="true"
		data-testid="billing-skeleton"
	>
		<div class="flex flex-col justify-between @4xl:flex-row">
			<div class="mb-10 flex flex-col lg:order-last lg:mt-10 lg:w-1/4">
				<div class="space-y-4 rounded-5 bg-surface-gray-2 p-5">
					<div class="space-y-1">
						<SkeletonText text="text-xs" width="w-1/2" strong />
						<SkeletonText text="leading-5" :lines="2" strong />
					</div>
					<div class="mt-2 space-y-1 border-t border-outline-gray-3 pt-4">
						<SkeletonText text="text-xs" width="w-1/4" strong />
						<SkeletonText text="font-bold" width="w-1/3" strong />
					</div>
				</div>
				<div class="my-5 space-y-2 rounded-5 bg-surface-gray-2 p-4">
					<SkeletonText text="" width="w-1/2" strong />
					<div class="flex items-center gap-x-2">
						<div class="h-7 flex-1 rounded-4 bg-surface-base" />
						<div class="h-7 w-14 rounded-4 bg-surface-base" />
					</div>
				</div>
				<div class="rounded-5 bg-surface-gray-2 p-2">
					<SkeletonText text="text-sm leading-5" :lines="3" strong />
				</div>
			</div>

			<div class="flex-1 lg:me-10">
				<SkeletonText
					text="text-lg-semibold"
					width="w-24"
					class="mb-5"
					strong
				/>
				<div class="grid grid-cols-1 gap-5 @2xl:grid-cols-2">
					<div v-for="fields in [5, 4]" :key="fields" class="space-y-4">
						<FieldSkeleton v-for="i in fields" :key="i" />
					</div>
				</div>
				<div
					class="mt-8 flex flex-col items-start justify-between space-y-4 border-t pt-4 @4xl:flex-row lg:items-center lg:space-y-0"
				>
					<SkeletonText text="" width="w-80" class="w-80 max-w-full" />
					<div class="ms-auto h-8 w-40 rounded-4 bg-surface-gray-3" />
				</div>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import FieldSkeleton from '@/components/Skeletons/FieldSkeleton.vue'
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'

/** pages/Billing.vue: the address form and the order summary beside it. */
</script>
