<template>
	<div class="flex items-center text-ink-gray-7">
		<span class="lucide-calendar h-4 w-4 me-2" />
		<span>
			{{ getFormattedDateRange(props.startDate, props.endDate) }}
		</span>
	</div>
</template>

<script setup>
import { getFormattedDateRange } from '@/utils'

const props = defineProps({
	startDate: {
		type: String,
	},
	endDate: {
		type: String,
	},
})
</script>
