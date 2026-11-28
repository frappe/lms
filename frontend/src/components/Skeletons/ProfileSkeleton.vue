<template>
	<div aria-hidden="true">
		<SkeletonLoader variant="header" />
		<div class="motion-safe:animate-pulse">
			<div class="h-[130px] w-full bg-surface-gray-2" />
			<div class="mx-auto -mt-10 max-w-4xl px-5 md:-mt-4">
				<div class="flex flex-col items-center @2xl:flex-row">
					<div
						class="size-[100px] shrink-0 rounded-full border-4 border-[color:var(--surface-base)] bg-surface-gray-3"
					/>
					<div class="mt-5 md:ms-6 md:mt-0">
						<SkeletonText
							text="text-4xl-semibold"
							width="w-full"
							class="w-56"
							strong
						/>
					</div>
				</div>
				<div class="mb-4 mt-10 h-7 w-56 rounded-4 bg-surface-gray-2" />
				<div class="mb-10 mt-7">
					<SkeletonText
						text="text-lg-semibold"
						width="w-24"
						class="mb-3"
						strong
					/>
					<SkeletonText text="text-sm" :lines="3" />
				</div>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'

/** pages/Profile.vue: header, cover, avatar and name, tabs, an About section. */
</script>
