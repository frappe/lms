<template>
	<div class="h-[88vh]">
		<div class="grid grid-cols-[2fr,1fr] gap-5">
			<div class="p-5">
				<div class="mb-8 space-y-2">
					<div class="text-lg font-semibold">
						{{ __('Curriculum') }}
					</div>
					<div class="text-ink-gray-7">
						{{
							__(
								"As a part of this batch's curriculum you will have to complete the following courses and assessments."
							)
						}}
					</div>
				</div>
				<div class="space-y-10">
					<div>
						<div class="font-semibold mb-4">
							{{ __('Courses') }}
						</div>
						<ListView
							v-if="batch.data?.courses?.length"
							:columns="courseColumns"
							:rows="batch.data?.courses"
							row-key="name"
							class="border rounded-lg"
							:options="{
								showTooltip: false,
								selectable: user.data?.is_student ? false : true,
								getRowRoute: (row) => ({
									name: 'CourseDetail',
									params: { courseName: row.course },
								}),
							}"
						>
							<ListHeader
								class="mb-2 grid items-center space-x-4 rounded-none rounded-t bg-surface-gray-2 p-2"
							>
							</ListHeader>
							<ListRows>
								<ListRow
									:row="row"
									v-for="row in batch.data?.courses"
									class="!rounded-none text-sm"
								>
									<template #default="{ column, item }">
										<ListRowItem :item="row[column.key]" :align="column.align">
											<div v-if="column.key === 'progress'">
												{{ getProgress(row.course) }}%
											</div>
											<div v-else>
												{{ row[column.key] }}
											</div>
										</ListRowItem>
									</template>
								</ListRow>
							</ListRows>
						</ListView>
						<div v-else class="text-ink-gray-7">
							{{ __('No courses added to this batch') }}
						</div>
					</div>
					<!-- <BatchCourses :batch="batch" /> -->
					<Assessments :batch="batch.data.name" />
				</div>
			</div>
			<div class="border-l h-[88vh] divide-y">
				<div v-if="batch.data?.evaluation" class="p-4 mb-5">
					<UpcomingEvaluations
						:batch="batch.data.name"
						:endDate="batch.data.evaluation_end_date"
						:courses="batch.data.courses"
					/>
				</div>
				<div class="p-5">
					<BatchFeedback :batch="batch.data?.name" />
				</div>
			</div>
		</div>
	</div>
</template>
<script setup>
import { inject } from 'vue'
import {
	createListResource,
	ListView,
	ListHeader,
	ListRows,
	ListRow,
	ListRowItem,
} from 'frappe-ui'
import Assessments from '@/pages/Batches/components/Assessments.vue'
import BatchCourses from '@/pages/Batches/components/BatchCourses.vue'
import BatchFeedback from '@/pages/Batches/components/BatchFeedback.vue'
import UpcomingEvaluations from '@/components/UpcomingEvaluations.vue'

const user = inject('$user')

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

const progressList = createListResource({
	doctype: 'LMS Enrollment',
	filters: {
		member: user.data?.name,
		course: ['in', props.batch.data?.courses?.map((c) => c.course)],
	},
	fields: ['course', 'progress', 'name'],
	auto: true,
})

const getProgress = (course) => {
	const progress = progressList.data?.find((p) => p.course === course)
	return progress ? Math.round(progress.progress) : 0
}

const courseColumns = [
	{
		key: 'title',
		label: __('Course'),
	},
	{
		key: 'progress',
		label: __('Progress'),
		align: 'right',
	},
]
</script>
