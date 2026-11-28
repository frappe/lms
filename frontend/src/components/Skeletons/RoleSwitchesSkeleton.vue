<template>
	<div
		class="grid grid-cols-1 gap-5 motion-safe:animate-pulse md:grid-cols-2"
		aria-hidden="true"
	>
		<div
			v-for="i in rows"
			:key="i"
			class="flex items-center justify-between gap-3"
		>
			<div class="flex min-w-0 flex-1 flex-col gap-1">
				<SkeletonText text="text-p-base" width="w-24" strong />
				<SkeletonText width="w-2/3" />
			</div>
			<div class="h-4 w-7 shrink-0 rounded-full bg-surface-gray-2" />
		</div>
	</div>
</template>
<script setup lang="ts">
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'

/** components/Controls/RoleSwitches.vue: label, description and a switch. */
withDefaults(defineProps<{ rows?: number }>(), { rows: 4 })
</script>
