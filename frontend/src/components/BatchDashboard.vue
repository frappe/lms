<template>
	<div>
		<UpcomingEvaluations :upcoming_evals="batch.data.upcoming_evals" />
		<Assessments :assessments="batch.data.assessments" />
	</div>
</template>
<script setup>
import UpcomingEvaluations from './UpcomingEvaluations.vue'
import Assessments from './Assessments.vue'

const props = defineProps({
	batch: {
		type: Object,
		default: null,
	},
})
</script>
