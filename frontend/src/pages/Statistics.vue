<template>
	<div class="">
		<PageHeader :breadcrumbs="breadcrumbs" />
		<span class="sr-only" role="status">{{ loadingAnnouncement }}</span>
		<div class="p-5">
			<!-- Window breakpoints, not the content area: Statistics keeps its full
			     layout and narrows when Flow docks, instead of dropping columns. -->
			<div
				class="statistics-cards grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4"
			>
				<Tooltip
					v-for="card in numberCards"
					:key="card.key"
					:text="card.tooltip"
				>
					<NumberCard
						:title="card.title"
						:value="chartDetails.data?.[card.key] ?? 0"
						:loading="isPending(chartDetails)"
						:format="compactNumber"
					>
						<!-- Only the number: these cards draw no delta row under it. -->
						<template #loading>
							<SkeletonText
								text="text-3xl-semibold"
								width="w-28"
								class="motion-safe:animate-pulse"
								aria-hidden="true"
							/>
						</template>
					</NumberCard>
				</Tooltip>
			</div>
			<div class="statistics-charts grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
				<ChartCard class="h-72">
					<LineChart
						v-if="!signupsChart.data || hasPoints(signupsChart.data)"
						:data="signupsChart.data || []"
						:loading="isPending(signupsChart)"
						x="date"
						y="count"
						:title="__('Signups')"
						:subtitle="__('Signups per day')"
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
						v-if="!enrollmentChart.data || hasPoints(enrollmentChart.data)"
						:data="enrollmentChart.data || []"
						:loading="isPending(enrollmentChart)"
						x="date"
						y="count"
						:title="__('Enrollments')"
						:subtitle="__('Enrollments per day')"
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
						v-if="!certification.data || hasPoints(certification.data)"
						:data="certification.data || []"
						:loading="isPending(certification)"
						x="date"
						y="count"
						:title="__('Certifications')"
						:subtitle="__('Certifications per day')"
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
				<ChartCard class="h-72">
					<DonutChart
						v-if="!courseCompletion.data || hasCompletions"
						:data="completionSlices || []"
						:loading="isPending(courseCompletion)"
						category="label"
						value="value"
						:title="__('Completions')"
						:subtitle="__('Course Completion')"
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
import { createResource, Tooltip, usePageMeta } from 'frappe-ui'
import { ChartCard, DonutChart, LineChart, NumberCard } from 'frappe-ui/charts'
import { computed } from 'vue'
import PageHeader from '@/components/Layouts/pages/PageHeader.vue'
import ChartEmptyState from '@/components/ChartEmptyState.vue'
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'
import { compactNumber } from '@/utils/numberCardFormat'
import { sessionStore } from '../stores/session'
import { useLoadingAnnouncement } from '@/utils/a11y'

const { brand } = sessionStore()

const numberCards = [
	{ key: 'courses', title: __('Courses'), tooltip: __('Published Courses') },
	{ key: 'users', title: __('Signups'), tooltip: __('Active Members') },
	{
		key: 'enrollments',
		title: __('Enrollments'),
		tooltip: __('Course Enrollments'),
	},
	{
		key: 'completions',
		title: __('Completions'),
		tooltip: __('Course Completions'),
	},
	{
		key: 'certifications',
		title: __('Certifications'),
		tooltip: __('Certified Members'),
	},
]

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

// The server labels each slice in English.
const completionSlices = computed(() =>
	courseCompletion.data?.map((slice) => ({ ...slice, label: __(slice.label) }))
)

// Not yet answered and not failed: a refetch keeps its data and its chart.
const isPending = (resource) => !resource.data && !resource.error

const loadingAnnouncement = useLoadingAnnouncement(
	() =>
		[
			chartDetails,
			signupsChart,
			enrollmentChart,
			certification,
			courseCompletion,
		].some(isPending),
	() => __('Statistics loaded')
)

usePageMeta(() => {
	return {
		title: __('Statistics'),
		icon: brand.favicon,
	}
})
</script>

<style scoped>
[data-theme='dark'] .statistics-charts {
	--chart-sequential-1: var(--dark-cyan-200);
}
</style>
