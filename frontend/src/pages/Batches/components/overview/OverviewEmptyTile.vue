<template>
	<EmptyStateLayout
		compact
		width="lg"
		:name="title"
		:icon="icon"
		:title="title"
		:description="description"
		class="rounded-6 border border-dashed border-outline-gray-3"
	>
		<div class="flex flex-wrap justify-center gap-2">
			<slot />
		</div>
	</EmptyStateLayout>
</template>

<script setup lang="ts">
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'

/** Dashed call to action for an empty overview section. */
defineProps<{ icon: string; title: string; description: string }>()
</script>
