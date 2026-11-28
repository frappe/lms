<template>
	<div
		class="m-0 grid min-w-0 flex-1 grid-cols-1 motion-safe:animate-pulse lg:min-h-0 @4xl:grid-cols-[7fr,3fr]"
		aria-hidden="true"
	>
		<div class="flex min-h-0 flex-col gap-8 overflow-hidden p-5">
			<div class="flex flex-col gap-1.5">
				<SkeletonText text="text-sm leading-tighter" width="w-32" />
				<div class="h-[227px] rounded-4 border border-outline-gray-2">
					<div class="h-10 border-b border-outline-gray-2" />
					<SkeletonText :lines="3" class="p-3" />
				</div>
			</div>
			<div class="flex flex-col gap-1.5">
				<SkeletonText text="text-sm leading-tighter" width="w-24" />
				<div
					class="h-[386px] rounded-5 border border-outline-gray-2 bg-surface-gray-1"
				/>
				<SkeletonText width="w-1/2" />
			</div>
			<div class="space-y-1.5">
				<SkeletonText text="text-sm leading-tighter" width="w-20" />
				<div class="rounded-5 border border-outline-gray-2">
					<div
						v-for="i in 3"
						:key="i"
						class="flex items-center gap-4 border-b border-outline-gray-2 p-2 last:border-b-0"
					>
						<SkeletonText text="text-sm" width="w-1/2" class="flex-1" />
						<SkeletonText text="text-sm" width="w-1/2" class="flex-1" />
					</div>
				</div>
			</div>
		</div>
		<div
			class="order-first flex min-w-0 flex-col gap-4 border-b p-5 lg:order-none lg:min-h-0 lg:border-b-0 lg:border-s"
		>
			<div v-for="i in 2" :key="i" class="space-y-1.5">
				<SkeletonText text="text-sm leading-tighter" width="w-1/3" />
				<div class="h-7 rounded-4 bg-surface-gray-2" />
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'

/**
 * pages/Forms/ProgrammingExerciseForm.vue with an empty problem statement:
 * editor, starter code, test cases, then title and language beside them.
 */
</script>
