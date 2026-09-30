<template>
	<Tooltip :text="`${props.progress}%`">
		<div
			class="w-full bg-surface-gray-3 rounded-full h-1"
			:class="$attrs.class"
			role="progressbar"
			aria-valuemin="0"
			aria-valuemax="100"
			:aria-valuenow="value"
			:aria-label="props.label"
		>
			<div
				class="bg-surface-gray-10 rounded-full"
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
	label: {
		type: String,
		default: () => __('Progress'),
	},
})

const value = computed(() => Math.min(Math.ceil(props.progress), 100))

const progressBarWidth = computed(() => `${value.value}%`)

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
