<template>
	<div
		class="flex h-full flex-col motion-safe:animate-pulse"
		aria-hidden="true"
	>
		<div class="mb-2 flex items-center justify-between">
			<SkeletonText text="text-lg-semibold" width="w-32" class="w-32" strong />
			<div class="flex gap-x-1">
				<div class="size-7 rounded-4 bg-surface-gray-2" />
				<div class="size-7 rounded-4 bg-surface-gray-2" />
			</div>
		</div>
		<div class="flex-1 rounded-5 border border-outline-gray-2">
			<div
				class="grid h-full grid-cols-7 divide-x divide-outline-gray-1 rtl:divide-x-reverse"
			>
				<div v-for="i in 7" :key="i" class="space-y-3 p-2">
					<div class="h-4 w-10 rounded-4 bg-surface-gray-2" />
				</div>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'

/** frappe-ui's Calendar in week mode, filling the box the calendar will. */
</script>
