<template>
	<div
		class="motion-safe:animate-pulse sm:rounded-6 sm:border"
		aria-hidden="true"
	>
		<div class="mb-2 hidden gap-4 rounded-4 bg-surface-gray-2 p-2 sm:flex">
			<SkeletonText
				v-for="i in columns"
				:key="i"
				text="text-sm"
				width="w-16"
				class="flex-1"
				strong
			/>
		</div>
		<div v-for="i in rows" :key="i" class="flex h-10 items-center gap-4 px-2">
			<SkeletonText
				v-for="column in columns"
				:key="column"
				text="text-sm"
				:width="column === 1 ? 'w-2/3' : 'w-1/3'"
				class="flex-1"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'

/** A ResponsiveListView drawn with `sm:border sm:rounded-6`, as on the batch dashboard. */
withDefaults(defineProps<{ rows?: number; columns?: number }>(), {
	rows: 3,
	columns: 3,
})
</script>
