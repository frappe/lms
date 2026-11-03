<template>
	<div class="">
		<PageHeader :breadcrumbs="breadcrumbs" />
		<div
			v-if="chartDetails.loading && !chartDetails.data"
			class="flex flex-1 items-center justify-center p-5"
		>
			<LoadingIndicator class="size-5 text-ink-gray-5" />
		</div>
		<div v-else-if="chartDetails.data" class="p-5">
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
				<Tooltip :text="__('Published Courses')">
					<NumberCard
						title="Courses"
						:value="chartDetails.data.courses"
						:format="compactNumber"
					/>
				</Tooltip>
				<Tooltip :text="__('Active Members')">
					<NumberCard
						title="Signups"
						:value="chartDetails.data.users"
						:format="compactNumber"
					/>
				</Tooltip>
				<Tooltip :text="__('Course Enrollments')">
					<NumberCard
						title="Enrollments"
						:value="chartDetails.data.enrollments"
						:format="compactNumber"
					/>
				</Tooltip>
				<Tooltip :text="__('Course Completions')">
					<NumberCard
						title="Completions"
						:value="chartDetails.data.completions"
						:format="compactNumber"
					/>
				</Tooltip>
				<Tooltip :text="__('Certified Members')">
					<NumberCard
						title="Certifications"
						:value="chartDetails.data.certifications"
						:format="compactNumber"
					/>
				</Tooltip>
			</div>
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
				<ChartCard class="h-72">
					<LineChart
						v-if="hasPoints(signupsChart.data)"
						:data="signupsChart.data"
						x="date"
						y="count"
						title="Signups"
						subtitle="Signups per day"
						:x-axis="{ type: 'time', timeGrain: 'day' }"
					/>
					<ChartEmptyState
						v-else-if="signupsChart.data"
						:title="__('Signups')"
						:subtitle="__('Signups per day')"
						:message="
							__(
								'New accounts on your site show up here, day by day, as people join.'
							)
						"
						icon="lucide-user-plus"
					/>
				</ChartCard>
				<ChartCard class="h-72">
					<LineChart
						v-if="hasPoints(enrollmentChart.data)"
						:data="enrollmentChart.data"
						x="date"
						y="count"
						title="Enrollments"
						subtitle="Enrollments per day"
						:x-axis="{ type: 'time', timeGrain: 'day' }"
					/>
					<ChartEmptyState
						v-else-if="enrollmentChart.data"
						:title="__('Enrollments')"
						:subtitle="__('Enrollments per day')"
						:message="
							__(
								'Each time a learner joins one of your courses, it shows up here.'
							)
						"
						icon="lucide-book-open"
					/>
				</ChartCard>
				<ChartCard class="h-72">
					<LineChart
						v-if="hasPoints(certification.data)"
						:data="certification.data"
						x="date"
						y="count"
						title="Certifications"
						subtitle="Certifications per day"
						:x-axis="{ type: 'time', timeGrain: 'day' }"
					/>
					<ChartEmptyState
						v-else-if="certification.data"
						:title="__('Certifications')"
						:subtitle="__('Certifications per day')"
						:message="
							__('Certificates your learners earn show up here, day by day.')
						"
						icon="lucide-badge-check"
					/>
				</ChartCard>
				<ChartCard v-if="courseCompletion.data" class="h-72">
					<DonutChart
						v-if="hasCompletions"
						:data="courseCompletion.data"
						category="label"
						value="value"
						title="Completions"
						subtitle="Course Completion"
						:center-label="__('Enrollments')"
					/>
					<ChartEmptyState
						v-else
						:title="__('Completions')"
						:subtitle="__('Course Completion')"
						:message="
							__(
								'When learners finish a course, you will see how many completed out of everyone enrolled.'
							)
						"
						icon="lucide-circle-check"
					/>
				</ChartCard>
			</div>
		</div>
	</div>
</template>
<script setup>
import {
	createResource,
	LoadingIndicator,
	Tooltip,
	usePageMeta,
} from 'frappe-ui'
import { ChartCard, DonutChart, LineChart, NumberCard } from 'frappe-ui/charts'
import { computed } from 'vue'
import PageHeader from '@/components/Layouts/pages/PageHeader.vue'
import ChartEmptyState from '@/components/ChartEmptyState.vue'
import { compactNumber } from '@/utils/numberCardFormat'
import { sessionStore } from '../stores/session'

const { brand } = sessionStore()

const breadcrumbs = computed(() => {
	return [
		{
			label: __('Statistics'),
			route: {
				name: 'Statistics',
			},
		},
	]
})

const chartDetails = createResource({
	url: 'lms.lms.api.get_chart_details',
	cache: ['statistics'],
	auto: true,
})

const signupsChart = createResource({
	url: 'lms.lms.utils.get_chart_data',
	params: {
		chart_name: 'New Signups',
	},
	auto: true,
})

const enrollmentChart = createResource({
	url: 'lms.lms.utils.get_chart_data',
	cache: ['enrollments'],
	params: {
		chart_name: 'Course Enrollments',
	},
	auto: true,
})

const certification = createResource({
	url: 'lms.lms.utils.get_chart_data',
	cache: ['certifications'],
	params: {
		chart_name: 'Certification',
	},
	auto: true,
})

const courseCompletion = createResource({
	url: 'lms.lms.utils.get_course_completion_data',
	auto: true,
	cache: ['courseCompletion'],
})

// A flat line at zero says nothing on a new site, so it gives way to a
// sentence about what will show up there.
const hasPoints = (data) => Boolean(data?.some((point) => point.count > 0))

// A donut with zero completions conveys nothing, so it shows a sentence until
// at least one learner has completed a course.
const hasCompletions = computed(() => {
	const completed = courseCompletion.data?.find((d) => d.label === 'Completed')
	return (completed?.value || 0) > 0
})

usePageMeta(() => {
	return {
		title: __('Statistics'),
		icon: brand.favicon,
	}
})
</script>
