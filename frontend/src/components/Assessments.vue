<template>
	<div>
		<div class="text-lg font-semibold mb-4">
			{{ __('Assessments') }}
		</div>
		<div v-if="assessments?.length">
			<ListView
				:columns="getAssessmentColumns()"
				:rows="attempts?.data"
				row-key="name"
				:options="{ selectable: false, showTooltip: false }"
			>
			</ListView>
		</div>
		<div v-else class="text-sm italic text-gray-600">
			{{ __('No Assessments') }}
		</div>
	</div>
</template>
<script setup>
import { ListView } from 'frappe-ui'

const props = defineProps({
	assessments: {
		type: Array,
		default: [],
	},
})

const getSubmissionColumns = () => {
	return [
		{
			label: 'Assessment',
			key: 'title',
		},
		{
			label: 'Type',
			key: 'type',
		},
		{
			label: 'Status/Score',
			key: 'status',
			align: 'center',
		},
	]
}
</script>
