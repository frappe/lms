<template>
	<div class="space-y-10 p-5">
		<UpcomingEvaluations
			:batch="batch.data.name"
			:endDate="batch.data.evaluation_end_date"
			:courses="batch.data.courses"
		/>
		<Assessments :batch="batch.data.name" />
		<BatchCourses :batch="batch.data.name" />
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
