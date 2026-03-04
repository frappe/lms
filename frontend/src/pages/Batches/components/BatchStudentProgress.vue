<template>
	<Dialog
		v-model="show"
		:options="{
			size: 'xl',
		}"
	>
		<template #body>
			<div v-if="studentDetails.data" class="p-5 space-y-10 text-sm">
				<div class="flex items-center space-x-2">
					<Avatar :image="studentDetails.data.user_image" size="3xl" />
					<div class="space-y-1">
						<div class="flex items-center space-x-2">
							<div class="text-xl font-semibold text-ink-gray-9">
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
					<!-- Assessments -->
					<ListView
						:columns="assessmentColumns"
						:rows="studentDetails.data.assessments"
						row-key="title"
						class="border border-outline-gray-modals rounded-lg"
						:options="{
							selectable: false,
							showTooltip: false,
							onRowClick: (row: any) => {
								redirectToAssessment(row)
							}
						}"
					>
						<ListHeader
							class="mb-2 grid items-center space-x-4 rounded-none rounded-t bg-surface-gray-2 p-2"
						>
						</ListHeader>
						<ListRows v-for="row in studentDetails.data.assessments">
							<ListRow :row="row" class="!rounded-none">
								<template #default="{ column, item }">
									<ListRowItem
										:item="row[column.key]"
										:align="column.align"
										class="w-full"
									>
										<div
											v-if="column.key == 'status' && isAssignment(row.status)"
										>
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
					</ListView>

					<!-- Courses -->
					<ListView
						:columns="courseColumns"
						:rows="studentDetails.data.courses"
						row-key="title"
						class="border border-outline-gray-modals rounded-lg"
						:options="{
							selectable: false,
							showTooltip: false,
							onRowClick: (row: any) => {
								redirectToCourse(row)
							}
						}"
					>
						<ListHeader
							class="mb-2 grid items-center space-x-4 rounded-none rounded-t bg-surface-gray-2 p-2"
						>
						</ListHeader>
						<ListRows v-for="row in studentDetails.data.courses">
							<ListRow :row="row" class="!rounded-none">
								<template #default="{ column, item }">
									<ListRowItem
										:item="row[column.key]"
										:align="column.align"
										class="w-full"
									>
										<template #prefix>
											<ProgressBar
												v-if="column.key == 'progress'"
												:progress="Math.ceil(row[column.key])"
												class="!mx-0 !mr-4 max-w-32"
											/>
										</template>
										<div
											v-if="column.key == 'progress'"
											class="text-xs !ml-0 !mr-3 w-5"
										>
											{{ Math.ceil(row[column.key]) }}%
										</div>
										<div v-else>
											{{ row[column.key] }}
										</div>
									</ListRowItem>
								</template>
							</ListRow>
						</ListRows>
					</ListView>
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
	ListView,
	ListHeader,
	ListRows,
	ListRow,
	ListRowItem,
} from 'frappe-ui'
import { useRouter } from 'vue-router'
import ProgressBar from '@/components/ProgressBar.vue'

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
	console.log(row)
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

const assessmentColumns = [
	{ key: 'title', label: 'Assessment', align: 'left', width: '60%' },
	{ key: 'status', label: 'Percentage/Status', align: 'right' },
]

const courseColumns = [
	{ key: 'title', label: 'Course', align: 'left', width: '70%' },
	{ key: 'progress', label: 'Progress', align: 'right' },
]

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
