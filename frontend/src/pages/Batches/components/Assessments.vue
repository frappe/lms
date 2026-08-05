<template>
	<div>
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-ink-gray-9 font-semibold">
				{{ __('Assessments') }}
			</h2>
			<Button v-if="canAddAssessments()" @click="showModal = true">
				<template #prefix>
					<span class="lucide-plus h-4 w-4" />
				</template>
				{{ __('Add') }}
			</Button>
		</div>
		<div v-if="assessments.data?.length" class="text-sm">
			<ResponsiveListView
				:columns="assessmentColumns"
				:rows="assessments.data"
				row-key="name"
				class="sm:border sm:rounded-lg"
				:options="listOptions"
			>
				<template #cell="{ column, value }">
					<span v-if="column.key == 'assessment_type'">
						{{ getAssessmentTypeLabel(value) }}
					</span>
					<Badge
						v-else-if="column.key == 'status' && isNaN(value)"
						:theme="getStatusTheme(value)"
					>
						{{ value }}
					</Badge>
					<span v-else>{{ value }}</span>
				</template>
				<template #selection-actions="{ unselectAll, selections }">
					<Button
						variant="ghost"
						:label="__('Delete')"
						@click="removeAssessments(selections, unselectAll)"
					>
						<span class="lucide-trash-2 h-4 w-4" />
					</Button>
				</template>
			</ResponsiveListView>
		</div>
		<div v-else class="text-ink-gray-7">
			{{ __('No assessments added to this batch') }}
		</div>
	</div>
	<AssessmentModal
		v-model="showModal"
		v-model:assessments="assessments"
		:batch="props.batch"
	/>
</template>
<script setup>
import { createResource, Button, Badge } from 'frappe-ui'
import { computed, inject, ref } from 'vue'
import AssessmentModal from '@/components/Modals/AssessmentModal.vue'
import ResponsiveListView from '@/components/ResponsiveListView.vue'

const user = inject('$user')
const showModal = ref(false)
const readOnlyMode = window.read_only_mode

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

const deleteAssessments = createResource({
	url: 'lms.lms.api.delete_documents',
	makeParams(values) {
		return {
			doctype: 'LMS Assessment',
			documents: values.assessments,
		}
	},
})

const removeAssessments = (selections, unselectAll) => {
	deleteAssessments.submit(
		{ assessments: Array.from(selections) },
		{
			onSuccess(data) {
				assessments.reload()
				unselectAll()
			},
		}
	)
}

const getRowRoute = (row) => {
	if (row.assessment_type == 'LMS Assignment') {
		if (row.submission) {
			return {
				name: 'AssignmentSubmission',
				params: {
					assignmentID: row.assessment_name,
					submissionName: row.submission.name,
				},
			}
		} else {
			return {
				name: 'AssignmentSubmission',
				params: {
					assignmentID: row.assessment_name,
					submissionName: 'new',
				},
			}
		}
	} else if (row.assessment_type == 'LMS Programming Exercise') {
		if (row.submission) {
			return {
				name: 'ProgrammingExerciseSubmission',
				params: {
					exerciseID: row.assessment_name,
					submissionID: row.submission.name,
				},
			}
		} else {
			return {
				name: 'ProgrammingExerciseSubmission',
				params: {
					exerciseID: row.assessment_name,
					submissionID: 'new',
				},
			}
		}
	} else {
		return {
			name: 'QuizPage',
			params: {
				quizID: row.assessment_name,
			},
		}
	}
}

const canAddAssessments = () => {
	if (readOnlyMode) return false
	return user.data?.is_moderator || user.data?.is_evaluator
}

const assessmentColumns = computed(() => {
	let columns = [
		{
			label: __('Assessment'),
			key: 'title',
		},
		{
			label: __('Type'),
			key: 'assessment_type',
			width: '10rem',
		},
	]

	if (!user.data?.is_moderator) {
		columns.push({
			label: __('Status/Percentage'),
			key: 'status',
			align: 'left',
			width: '10rem',
		})
	}
	return columns
})

const listOptions = computed(() => ({
	showTooltip: false,
	getRowRoute: (row) => getRowRoute(row),
	selectable: user.data?.is_student ? false : true,
}))

const getStatusTheme = (status) => {
	if (status === 'Pass' || status === 'Passed') {
		return 'green'
	} else if (status === 'Not Graded') {
		return 'orange'
	} else {
		return 'red'
	}
}

const getAssessmentTypeLabel = (type) => {
	if (type == 'LMS Assignment') {
		return __('Assignment')
	} else if (type == 'LMS Quiz') {
		return __('Quiz')
	} else if (type == 'LMS Programming Exercise') {
		return __('Programming Exercise')
	}
}
</script>
