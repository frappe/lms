<template>
	<div
		class="flex h-full flex-col rounded-6 border border-outline-gray-2 bg-surface-base p-2 motion-safe:animate-pulse"
		aria-hidden="true"
	>
		<div
			class="h-40 shrink-0 overflow-hidden rounded-4 bg-surface-gray-2 px-4 pt-3"
		>
			<div class="pt-[10%]">
				<div class="aspect-[1122/793] rounded-2 bg-surface-gray-3" />
			</div>
		</div>
		<div class="flex items-center gap-2.5 px-2 pb-1.5 pt-3">
			<div class="size-10 shrink-0 rounded-full bg-surface-gray-2" />
			<div class="min-w-0 flex-1">
				<SkeletonText text="text-base-semibold" width="w-1/2" strong />
				<SkeletonText width="w-1/3" />
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'

/** The certified-member card in pages/CertifiedParticipants.vue. */
</script>
