<template>
	<div v-if="kind === 'switch'" class="flex items-start justify-between gap-4">
		<div class="min-w-0 flex-1 space-y-1">
			<SkeletonText text="text-p-sm-medium" width="w-32" class="w-32" />
			<SkeletonText text="text-p-sm" width="w-4/5" />
		</div>
		<div class="h-4 w-7 shrink-0 rounded-full bg-surface-gray-2" />
	</div>
	<div v-else class="space-y-1.5">
		<SkeletonText
			text="text-sm leading-tighter"
			:width="labelWidth"
			:class="labelWidth"
		/>
		<div class="h-7 w-full rounded-4 bg-surface-gray-2" />
	</div>
</template>
<script setup lang="ts">
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'

/** One frappe-ui FormControl: a labelled input, or a labelled switch row. */
withDefaults(
	defineProps<{ kind?: 'input' | 'switch'; labelWidth?: string }>(),
	{ kind: 'input', labelWidth: 'w-16' }
)
</script>
