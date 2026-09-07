<template>
	<div class="lg:h-[88vh]">
		<div class="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-5">
			<div class="p-5">
				<div class="mb-8 space-y-2">
					<div class="text-lg-semibold text-ink-gray-9">
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
						<div class="text-ink-gray-9 font-semibold mb-4">
							{{ __('Courses') }}
						</div>
						<ResponsiveListView
							v-if="batch.data?.courses?.length"
							:columns="courseColumns"
							:rows="batch.data?.courses"
							row-key="name"
							class="sm:border sm:rounded-lg"
							:options="courseListOptions"
						>
							<template #cell="{ column, row, value }">
								<span v-if="column.key === 'progress'">
									{{ getProgress(row.course) }}%
								</span>
								<span v-else>{{ value }}</span>
							</template>
						</ResponsiveListView>
						<div v-else class="text-ink-gray-7">
							{{ __('No courses added to this batch') }}
						</div>
					</div>
					<!-- <BatchCourses :batch="batch" /> -->
					<Assessments :batch="batch.data.name" />
				</div>
			</div>
			<div class="border-t divide-y lg:border-s lg:border-t-0 lg:h-[88vh]">
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
import { computed, inject } from 'vue'
import { createListResource } from 'frappe-ui'
import Assessments from '@/pages/Batches/components/Assessments.vue'
import BatchCourses from '@/pages/Batches/components/BatchCourses.vue'
import BatchFeedback from '@/pages/Batches/components/BatchFeedback.vue'
import ResponsiveListView from '@/components/ResponsiveListView.vue'
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
		align: 'left',
	},
]

const courseListOptions = computed(() => ({
	showTooltip: false,
	selectable: user.data?.is_student ? false : true,
	getRowRoute: (row) => ({
		name: 'CourseDetail',
		params: { courseName: row.course },
	}),
}))
</script>
