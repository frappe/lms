<template>
	<Button v-if="hasPrev" @click="emit('switch', 'prev')">
		<template #prefix>
			<span class="lucide-chevron-left size-4" />
		</template>
		<span>{{ __('Previous') }}</span>
	</Button>
	<Button v-if="hasNext" @click="emit('switch', 'next')">
		<template #suffix>
			<span class="lucide-chevron-right size-4" />
		</template>
		<span>{{ __('Next') }}</span>
	</Button>
	<Button
		v-else
		:route="{ name: 'CourseDetail', params: { courseName } }"
		class="text-p-base-medium"
	>
		{{ __('Back to Course') }}
	</Button>
</template>
<script setup lang="ts">
import { Button } from 'frappe-ui'

defineProps<{
	hasPrev: boolean
	hasNext: boolean
	courseName: string
}>()

const emit = defineEmits<{
	switch: [direction: 'prev' | 'next']
}>()
</script>
