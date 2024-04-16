<template>
	<div class="flex items-center">
		<Calendar class="h-4 w-4 stroke-1.5 mr-2 text-gray-700" />
		<span>
			{{ getFormattedDateRange(props.startDate, props.endDate) }}
		</span>
	</div>
</template>

<script setup>
import { Calendar } from 'lucide-vue-next'
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
