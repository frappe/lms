<template>
	<div class="motion-safe:animate-pulse" aria-hidden="true">
		<SkeletonLoader variant="header" />
		<div class="flex">
			<div class="min-w-0 flex-1 pb-10 pt-5 sm:border-e">
				<div class="mx-auto max-w-6xl space-y-8 px-5">
					<div class="flex items-end justify-between gap-4">
						<div class="flex min-w-0 flex-1 flex-col gap-4">
							<SkeletonText
								text="text-p-sm-semibold"
								width="w-28"
								class="w-28"
							/>
							<SkeletonText
								v-if="!isMobile"
								text="text-xl-semibold"
								width="w-1/2"
								strong
							/>
						</div>
						<div v-if="!isMobile" class="flex shrink-0 items-center gap-x-2">
							<div class="size-7 rounded-4 bg-surface-gray-2" />
						</div>
					</div>
					<div class="h-64 w-full rounded-5 bg-surface-gray-2" />
					<SkeletonText text="text-p-base" :lines="4" />
				</div>
			</div>
			<aside
				v-if="!isMobile && chaptersOpen"
				class="hidden w-[30%] shrink-0 overflow-hidden @2xl:block"
			>
				<div class="min-w-72 border-b bg-surface-gray-1 p-5">
					<div class="flex h-7 items-center gap-2">
						<div class="size-4 shrink-0 rounded-4 bg-surface-gray-2" />
						<SkeletonText
							text="text-lg-semibold leading-snug"
							width="w-2/3"
							class="flex-1"
							strong
						/>
					</div>
					<template v-if="withProgress">
						<SkeletonText text="text-sm" width="w-28" class="mt-4 w-28" />
						<div class="mt-2 h-1 w-full rounded-full bg-surface-gray-2" />
					</template>
				</div>
				<OutlineRowsSkeleton class="px-2 py-3" />
			</aside>
		</div>
	</div>
</template>
<script setup lang="ts">
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import OutlineRowsSkeleton from '@/components/Skeletons/OutlineRowsSkeleton.vue'
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'
import { useScreenSize } from '@/utils/composables'

/** pages/Lesson.vue before its lesson arrives: header, title, body, chapters. */
defineProps<{ chaptersOpen: boolean; withProgress: boolean }>()

const { isMobile } = useScreenSize()
</script>
