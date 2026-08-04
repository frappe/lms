<template>
	<Dialog
		v-model:open="show"
		size="xl"
		:title="studentDetails.data?.full_name || __('Student Details')"
		bare
	>
		<template #default>
			<div
				v-if="studentDetails.loading && !studentDetails.data"
				class="flex items-center justify-center py-12"
			>
				<LoadingIndicator class="size-4" />
			</div>
			<div v-else-if="studentDetails.data" class="p-5 space-y-10 text-sm">
				<div class="flex items-center gap-x-4">
					<Avatar :image="studentDetails.data.user_image" size="3xl" />
					<div class="space-y-1">
						<div class="flex items-center gap-x-2">
							<div class="text-2xl-semibold text-ink-gray-9">
								{{ studentDetails.data.full_name }}
							</div>
							<Badge
								v-if="
									Object.keys(studentDetails.data.assessments).length ||
									Object.keys(studentDetails.data.courses).length
								"
								:theme="studentDetails.data.progress === 100 ? 'green' : 'red'"
							>
								{{ studentDetails.data.progress }}% {{ __('Complete') }}
							</Badge>
						</div>
						<div class="text-sm text-ink-gray-7">
							{{ studentDetails.data.email }}
						</div>
					</div>
				</div>

				<div class="space-y-8">
					<ResponsiveListView
						:columns="assessmentColumns"
						:rows="studentDetails.data.assessments"
						row-key="title"
						class="sm:border sm:border-outline-elevation-2 sm:rounded-lg"
						:options="assessmentListOptions"
					>
						<template #cell="{ column, value }">
							<Badge
								v-if="column.key == 'status' && isAssignment(value)"
								:theme="getStatusTheme(value as string)"
							>
								{{ value }}
							</Badge>
							<span v-else>{{ value }}</span>
						</template>
					</ResponsiveListView>

					<!-- Courses -->
					<ResponsiveListView
						:columns="courseColumns"
						:rows="studentDetails.data.courses"
						row-key="title"
						class="sm:border sm:border-outline-elevation-2 sm:rounded-lg"
						:options="courseListOptions"
					>
						<template #cell="{ column, value }">
							<span
								v-if="column.key == 'progress'"
								class="flex items-center gap-2"
							>
								<ProgressBar
									:progress="Math.ceil(Number(value))"
									class="!mx-0 min-w-0 max-w-32 flex-1"
								/>
								<span class="text-xs shrink-0">
									{{ Math.ceil(Number(value)) }}%
								</span>
							</span>
							<span v-else>{{ value }}</span>
						</template>
					</ResponsiveListView>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import {
	Avatar,
	Badge,
	createResource,
	Dialog,
	LoadingIndicator,
} from 'frappe-ui'
import { useRouter } from 'vue-router'
import ProgressBar from '@/components/ProgressBar.vue'
import ResponsiveListView from '@/components/ResponsiveListView.vue'
import type { ListColumn, ListRow, ListViewOptions } from '@/types'

const show = defineModel()
const router = useRouter()
const props = defineProps<{
	student: string
	batch: string
}>()

const studentDetails = createResource({
	url: 'lms.lms.utils.get_batch_student_progress',
	makeParams() {
		return {
			member: props.student,
			batch: props.batch,
		}
	},
	auto: true,
})

const redirectToAssessment = (row: any) => {
	if (!row.submission) return
	if (row.type == 'LMS Assignment') {
		router.push({
			name: 'AssignmentSubmission',
			params: {
				assignmentID: row.assessment,
				submissionName: row.submission,
			},
		})
	} else if (row.type == 'LMS Programming Exercise') {
		router.push({
			name: 'ProgrammingExerciseSubmission',
			params: {
				exerciseID: row.assessment,
				submissionID: row.submission,
			},
		})
	} else if (row.type == 'LMS Quiz') {
		router.push({
			name: 'QuizSubmission',
			params: {
				submission: row.submission,
			},
		})
	}
}

const redirectToCourse = (row: any) => {
	router.push({
		name: 'CourseDetail',
		params: {
			courseName: row.course,
		},
	})
}

const assessmentColumns: ListColumn[] = [
	{ key: 'title', label: __('Assessment'), align: 'left', width: '60%' },
	{ key: 'status', label: __('Percentage/Status'), align: 'left' },
]

const courseColumns: ListColumn[] = [
	{ key: 'title', label: __('Course'), align: 'left', width: '70%' },
	{ key: 'progress', label: __('Progress'), align: 'left' },
]

const assessmentListOptions: ListViewOptions = {
	selectable: false,
	showTooltip: false,
	onRowClick: (row: ListRow) => redirectToAssessment(row),
}

const courseListOptions: ListViewOptions = {
	selectable: false,
	showTooltip: false,
	onRowClick: (row: ListRow) => redirectToCourse(row),
}

const isAssignment = (value: any) => {
	return isNaN(value)
}

const getStatusTheme = (status: string) => {
	if (status === 'Pass') {
		return 'green'
	} else if (status == 'Not Graded') {
		return 'orange'
	} else {
		return 'red'
	}
}
</script>
