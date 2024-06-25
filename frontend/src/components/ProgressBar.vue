<template>
	<div class="w-full bg-gray-200 rounded-full h-1 my-2">
		<div
			class="bg-gray-900 h-1 rounded-full"
			:style="{ width: progressBarWidth }"
		></div>
	</div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
	progress: {
		type: Number,
		default: 0,
	},
})

const progressBarWidth = computed(() => {
	const formattedPercentage = Math.min(Math.ceil(props.progress), 100)
	return `${formattedPercentage}%`
})
</script>
