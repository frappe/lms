<template>
	<div class="flex items-center text-gray-600">
		<Calendar2 class="h-4 w-4 stroke-1.5 mr-2" />
		<span>
			{{ getFormattedDateRange(props.startDate, props.endDate) }}
		</span>
	</div>
</template>

<script setup>
import Calendar2 from '@/components/Icons/Calendar2Icon.vue'
import { getFormattedDateRange } from '@/utils'

const props = defineProps({
	startDate: {
		type: String,
	},
	endDate: {
		type: String,
	}
})
</script>
