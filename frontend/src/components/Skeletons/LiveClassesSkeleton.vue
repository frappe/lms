<template>
	<div class="motion-safe:animate-pulse" aria-hidden="true">
		<EmptyStateSkeleton v-if="empty" class="min-h-[60vh]" />
		<template v-else>
			<div class="flex h-7 items-center justify-between">
				<SkeletonText
					text="text-lg-semibold"
					width="w-24"
					class="w-24"
					strong
				/>
				<div v-if="canAdd" class="h-7 w-16 rounded-4 bg-surface-gray-2" />
			</div>
			<div class="mt-5 grid grid-cols-1 gap-5 @lg:grid-cols-2 @4xl:grid-cols-4">
				<div
					v-for="i in count"
					:key="i"
					class="flex h-full flex-col rounded-5 border p-3"
				>
					<SkeletonText
						text="font-semibold"
						width="w-2/3"
						class="mb-1"
						strong
					/>
					<SkeletonText
						text="leading-normal"
						width="w-full"
						class="mb-6 mt-1"
					/>
					<div class="mt-auto space-y-3">
						<SkeletonText text="" width="w-1/2" />
						<SkeletonText text="" width="w-2/3" />
					</div>
				</div>
			</div>
		</template>
	</div>
</template>

<script setup lang="ts">
import EmptyStateSkeleton from '@/components/Skeletons/EmptyStateSkeleton.vue'
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'

/**
 * The Classes tab of a batch (pages/Batches/components/LiveClass.vue): its
 * class cards, or its empty state when the batch cannot hold classes yet.
 */
withDefaults(
	defineProps<{ empty?: boolean; canAdd?: boolean; count?: number }>(),
	{ empty: false, canAdd: false, count: 4 }
)
</script>
