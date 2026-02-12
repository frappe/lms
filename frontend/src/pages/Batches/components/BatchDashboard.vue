<template>
	<div class="space-y-10 mt-5 w-[75%] mx-auto">
		<UpcomingEvaluations
			:batch="batch.data.name"
			:endDate="batch.data.evaluation_end_date"
			:courses="batch.data.courses"
		/>
		<BatchCourses :batch="batch" />
		<Assessments :batch="batch.data.name" />
		<div class="grid grid-cols-2 gap-10"></div>
	</div>
</template>
<script setup>
import UpcomingEvaluations from '@/components/UpcomingEvaluations.vue'
import Assessments from '@/pages/Batches/components/Assessments.vue'
import BatchCourses from '@/pages/Batches/components/BatchCourses.vue'

const props = defineProps({
	batch: {
		type: Object,
		default: null,
	},
	isStudent: {
		type: Boolean,
		default: false,
	},
})
</script>
