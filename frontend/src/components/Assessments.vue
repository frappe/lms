<template>
	<div>
		<div class="text-lg font-semibold mb-4">
			{{ __('Assessments') }}
		</div>
		<div v-if="assessments.data?.length">
			<ListView
				:columns="getAssessmentColumns()"
				:rows="assessments.data"
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
import { ListView, createResource } from 'frappe-ui'
import { inject } from 'vue'

const user = inject('$user')

const props = defineProps({
	batch: {
		type: String,
		required: true,
	},
	rows: {
		type: Array,
	},
	columns: {
		type: Array,
	},
	options: {
		type: Object,
		default: () => ({
			selectable: true,
			totalCount: 0,
			rowCount: 0,
		}),
	},
})

const assessments = createResource({
	url: 'lms.lms.utils.get_assessments',
	params: {
		batch: props.batch,
	},
	auto: true,
})

const getAssessmentColumns = () => {
	let columns = [
		{
			label: 'Assessment',
			key: 'title',
		},
		{
			label: 'Type',
			key: 'assessment_type',
		},
	]

	if (!user.data?.is_moderator) {
		columns.push({
			label: 'Status/Score',
			key: 'status',
			align: 'center',
		})
	}
	return columns
}
</script>
