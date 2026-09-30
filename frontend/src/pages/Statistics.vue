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
				<ChartCard class="h-80">
					<LineChart
						v-if="signupsChart.data"
						:data="signupsChart.data"
						x="date"
						y="count"
						title="Signups"
						subtitle="Signups per day"
						:x-axis="{ type: 'time', timeGrain: 'day' }"
					/>
				</ChartCard>
				<ChartCard class="h-80">
					<LineChart
						v-if="enrollmentChart.data"
						:data="enrollmentChart.data"
						x="date"
						y="count"
						title="Enrollments"
						subtitle="Enrollments per day"
						:x-axis="{ type: 'time', timeGrain: 'day' }"
					/>
				</ChartCard>
				<ChartCard class="h-80">
					<LineChart
						v-if="certification.data"
						:data="certification.data"
						x="date"
						y="count"
						title="Certifications"
						subtitle="Certifications per day"
						:x-axis="{ type: 'time', timeGrain: 'day' }"
					/>
				</ChartCard>
				<ChartCard v-if="hasCompletions" class="h-80">
					<DonutChart
						:data="courseCompletion.data"
						category="label"
						value="value"
						title="Completions"
						subtitle="Course Completion"
						:center-label="__('Enrollments')"
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

// A donut with zero completions conveys nothing, so hide it until at least one
// learner has completed a course.
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
