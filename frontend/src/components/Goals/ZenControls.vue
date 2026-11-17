<template>
	<div class="flex shrink-0 items-center gap-1">
		<Button
			v-if="canAsk"
			variant="ghost"
			:aria-label="__('Ask {0}').format(TUTOR_NAME)"
			@click="emit('ask')"
		>
			<template #icon
				><span class="lucide-message-circle-question size-4"
			/></template>
		</Button>
		<Button
			variant="ghost"
			:aria-label="__('Leave zen mode')"
			@click="emit('leave')"
		>
			<template #icon><span class="lucide-minimize-2 size-4" /></template>
		</Button>
	</div>
</template>

<script setup lang="ts">
import { Button } from 'frappe-ui'
import { TUTOR_NAME } from '@/utils/characters'

// Zen mode hides the page header, so its two controls travel with the step instead.
defineProps<{ canAsk: boolean }>()
const emit = defineEmits<{ ask: []; leave: [] }>()
</script>
