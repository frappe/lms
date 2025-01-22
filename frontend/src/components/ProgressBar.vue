<template>
	<Tooltip :text="`${props.progress}%`">
		<div class="w-full bg-gray-200 rounded-full h-1">
			<div
				class="bg-gray-900 rounded-full"
				:class="progressBarHeight"
				:style="{ width: progressBarWidth }"
			></div>
		</div>
	</Tooltip>
</template>

<script setup>
import { computed } from 'vue'
import { Tooltip } from 'frappe-ui'

const props = defineProps({
	progress: {
		type: Number,
		default: 0,
	},
	size: {
		type: String,
		default: 'sm',
	},
})

const progressBarWidth = computed(() => {
	const formattedPercentage = Math.min(Math.ceil(props.progress), 100)
	return `${formattedPercentage}%`
})

const progressBarHeight = computed(() => {
	if (props.size === 'sm') {
		return 'h-1'
	}
	if (props.size === 'md') {
		return 'h-2'
	}
	if (props.size === 'lg') {
		return 'h-3'
	}
})
</script>
