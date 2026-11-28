<template>
	<HeaderButton
		:label="__('Export analytics')"
		icon="lucide-download"
		variant="subtle"
		@click="emit('export')"
	/>
	<HeaderButton
		:label="__('Enroll')"
		icon="lucide-plus"
		variant="solid"
		@click="emit('enroll')"
	/>
</template>

<script setup lang="ts">
import HeaderButton from '@/components/HeaderButton.vue'

/** Export analytics and Enroll, shown with the course or batch Dashboard tab. */
const emit = defineEmits<{ export: []; enroll: [] }>()
</script>
