<template>
	<div>
		<div class="flex items-center justify-between mb-4">
			<div class="text-lg font-semibold text-ink-gray-9">
				{{ __('Assessments') }}
			</div>
			<Button v-if="canAddAssessments()" @click="showModal = true">
				<template #prefix>
					<Plus class="h-4 w-4" />
				</template>
				{{ __('Add') }}
			</Button>
		</div>
		<div v-if="assessments.data?.length" class="text-sm">
			<ListView
				:columns="getAssessmentColumns()"
				:rows="assessments.data"
				row-key="name"
				:options="{
					showTooltip: false,
					getRowRoute: (row) => getRowRoute(row),
					selectable: user.data?.is_student ? false : true,
				}"
			>
				<ListHeader
					class="mb-2 grid items-center space-x-4 rounded bg-surface-gray-2 p-2"
				>
					<ListHeaderItem :item="item" v-for="item in getAssessmentColumns()">
						<template #prefix="{ item }">
							<component
								v-if="item.icon"
								:is="item.icon"
								class="h-4 w-4 stroke-1.5 ml-4"
							/>
						</template>
					</ListHeaderItem>
				</ListHeader>
				<ListRows>
					<ListRow :row="row" v-for="row in assessments.data">
						<template #default="{ column, item }">
							<ListRowItem :item="row[column.key]" :align="column.align">
								<div v-if="column.key == 'assessment_type'">
									{{ row[column.key] == 'LMS Quiz' ? 'Quiz' : 'Assignment' }}
								</div>
								<div v-else-if="column.key == 'title'">
									{{ row[column.key] }}
								</div>
								<div v-else-if="isNaN(row[column.key])">
									<Badge :theme="getStatusTheme(row[column.key])">
										{{ row[column.key] }}
									</Badge>
								</div>
								<div v-else>
									{{ row[column.key] }}
								</div>
							</ListRowItem>
						</template>
					</ListRow>
				</ListRows>
				<ListSelectBanner>
					<template #actions="{ unselectAll, selections }">
						<div class="flex gap-2">
							<Button
								variant="ghost"
								@click="removeAssessments(selections, unselectAll)"
							>
								<Trash2 class="h-4 w-4 stroke-1.5" />
							</Button>
						</div>
					</template>
				</ListSelectBanner>
			</ListView>
		</div>
		<div v-else class="text-sm italic text-ink-gray-5">
			{{ __('No Assessments') }}
		</div>
	</div>
	<AssessmentModal
		v-model="showModal"
		v-model:assessments="assessments"
		:batch="props.batch"
	/>
</template>
<script setup>
import {
	ListView,
	ListRow,
	ListRows,
	ListHeader,
	ListHeaderItem,
	ListRowItem,
	ListSelectBanner,
	createResource,
	Button,
	Badge,
} from 'frappe-ui'
import { inject, ref } from 'vue'
import AssessmentModal from '@/components/Modals/AssessmentModal.vue'
import { Plus, Trash2 } from 'lucide-vue-next'

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

const getAssessmentColumns = () => {
	let columns = [
		{
			label: 'Assessment',
			key: 'title',
			width: '25rem',
		},
		{
			label: 'Type',
			key: 'assessment_type',
			width: '15rem',
		},
	]

	if (!user.data?.is_moderator) {
		columns.push({
			label: 'Status/Percentage',
			key: 'status',
			align: 'left',
			width: '10rem',
		})
	}
	return columns
}

const getStatusTheme = (status) => {
	if (status === 'Pass') {
		return 'green'
	} else if (status === 'Not Graded') {
		return 'orange'
	} else {
		return 'red'
	}
}
</script>
