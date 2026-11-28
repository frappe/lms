<template>
	<div
		class="space-y-2 rounded-5 border p-3 motion-safe:animate-pulse"
		aria-hidden="true"
	>
		<SkeletonText text="text-lg-semibold" width="w-1/2" strong />
		<SkeletonText text="" width="w-24" />
		<SkeletonText text="" width="w-28" />
	</div>
</template>
<script setup lang="ts">
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'

/** The program card in pages/Programs/Programs.vue; its rows inherit the body type. */
</script>
