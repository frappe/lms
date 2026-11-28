<template>
	<div
		class="text-base motion-safe:animate-pulse"
		aria-hidden="true"
		data-testid="program-form-skeleton"
	>
		<div class="space-y-5 pb-5">
			<FieldSkeleton label-width="w-10" />
			<div class="grid grid-cols-1 gap-5 @2xl:grid-cols-2">
				<div v-for="i in 2" :key="i" class="flex h-[15px] items-center gap-2">
					<div class="size-3.5 rounded-2 bg-surface-gray-2" />
					<div class="h-2.5 w-28 rounded-4 bg-surface-gray-2" />
				</div>
			</div>
		</div>
		<div
			v-for="(width, index) in ['w-16', 'w-20']"
			:key="width"
			:class="index ? '' : 'pb-5'"
		>
			<div class="mb-4 mt-5 flex h-7 items-center justify-between">
				<SkeletonText
					text="text-lg-semibold"
					:width="width"
					:class="width"
					strong
				/>
				<div class="h-7 w-16 rounded-4 bg-surface-gray-2" />
			</div>
			<div
				class="h-[54px] rounded-5 border border-dashed border-outline-gray-2"
			/>
		</div>
	</div>
</template>
<script setup lang="ts">
import FieldSkeleton from '@/components/Skeletons/FieldSkeleton.vue'
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'

/** pages/Forms/ProgramForm.vue: title, two checkboxes, courses and members. */
</script>
