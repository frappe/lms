<template>
	<div class="space-y-10">
		<Assessments :batch="batch.data.name" />
		<UpcomingEvaluations
			:batch="batch.data.name"
			:endDate="batch.data.evaluation_end_date"
			:courses="batch.data.courses"
		/>
		<StudentHeatmap :batch="batch.data.name" />
	</div>
</template>
<script setup>
import UpcomingEvaluations from '@/components/UpcomingEvaluations.vue'
import Assessments from '@/components/Assessments.vue'
import StudentHeatmap from '@/components/StudentHeatmap.vue'

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
