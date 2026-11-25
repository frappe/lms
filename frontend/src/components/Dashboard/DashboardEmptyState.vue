<template>
	<EmptyStateLayout
		name="students"
		icon="lucide-users"
		:title="__('No students yet')"
		:description="description"
	>
		<Button
			variant="subtle"
			:label="__('Enroll students')"
			@click="emit('enroll')"
		>
			<template #prefix>
				<span class="lucide-plus size-4" />
			</template>
		</Button>
	</EmptyStateLayout>
</template>
<script setup lang="ts">
import { Button } from 'frappe-ui'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'

defineProps<{
	description: string
}>()

const emit = defineEmits<{
	enroll: []
}>()
</script>
