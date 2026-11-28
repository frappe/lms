<template>
	<div
		class="grid flex-1 grid-cols-1 motion-safe:animate-pulse lg:min-h-0 @4xl:grid-cols-[7fr,3fr]"
		aria-hidden="true"
	>
		<div class="flex min-h-0 flex-col overflow-hidden px-5 py-5">
			<div class="mb-5 flex items-center gap-3">
				<div class="h-7 flex-1 rounded-4 bg-surface-gray-2" />
				<div class="h-7 w-32 rounded-4 bg-surface-gray-2" />
				<div class="h-7 w-32 rounded-4 bg-surface-gray-2" />
			</div>
			<div class="space-y-3">
				<div
					v-for="i in count"
					:key="i"
					class="flex items-center gap-3 rounded-6 border border-outline-gray-2 px-4 py-3"
				>
					<div class="size-4 shrink-0 rounded-4 bg-surface-gray-2" />
					<div class="size-5 shrink-0 rounded-4 bg-surface-gray-2" />
					<SkeletonText text="text-base" width="w-2/3" class="flex-1" />
					<div class="h-5 w-24 shrink-0 rounded-4 bg-surface-gray-2" />
					<div class="h-5 w-16 shrink-0 rounded-4 bg-surface-gray-2" />
					<div class="size-7 shrink-0 rounded-4 bg-surface-gray-2" />
				</div>
			</div>
		</div>
		<div
			class="order-first min-w-0 border-b lg:order-none lg:min-h-0 lg:overflow-hidden lg:border-b-0 lg:border-s"
		>
			<div class="space-y-8 p-5">
				<div class="space-y-5">
					<SkeletonText text="text-lg font-semibold" width="w-1/3" strong />
					<div v-for="i in 6" :key="i" class="space-y-1.5">
						<SkeletonText text="text-sm leading-tighter" width="w-1/3" />
						<div class="h-7 rounded-4 bg-surface-gray-2" />
					</div>
				</div>
				<div class="space-y-5">
					<SkeletonText text="text-lg font-semibold" width="w-1/3" strong />
					<div
						v-for="i in 6"
						:key="i"
						class="-m-2 flex items-center justify-between gap-3 p-2"
					>
						<div class="flex min-w-0 flex-1 flex-col gap-1">
							<SkeletonText text="text-p-base" width="w-1/2" />
							<SkeletonText text="text-p-sm" :lines="i % 2 ? 2 : 1" />
						</div>
						<div class="h-4 w-7 shrink-0 rounded-full bg-surface-gray-2" />
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'

/** pages/Forms/QuizForm.vue: question cards beside the settings column. */
withDefaults(defineProps<{ count?: number }>(), { count: 6 })
</script>
