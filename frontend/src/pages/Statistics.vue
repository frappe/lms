<template>
	<div class="">
		<header
			class="sticky top-0 z-10 flex items-center justify-between border-b bg-surface-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs class="h-7" :items="breadcrumbs" />
		</header>
		<div v-if="chartDetails.data" class="p-5">
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
				<NumberChart
					class="border rounded-md"
					:config="{ title: 'Courses', value: _chartDetails.data.courses }"
				/>
				<NumberChart
					class="border rounded-md"
					:config="{ title: 'Signups', value: _chartDetails.data.users }"
				/>
				<NumberChart
					class="border rounded-md"
					:config="{
						title: 'Enrollments',
						value: _chartDetails.data.enrollments,
					}"
				/>
				<NumberChart
					class="border rounded-md"
					:config="{
						title: 'Completions',
						value: _chartDetails.data.completions,
					}"
				/>
				<NumberChart
					class="border rounded-md"
					:config="{
						title: 'Milestones',
						value: _chartDetails.data.lesson_completions,
					}"
				/>
			</div>
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
				<div class="border rounded-md min-h-72">
					<AxisChart
						:config="{
							data: signupsData,
							title: 'Signups',
							subtitle: 'Signups per month',
							xAxis: {
								key: 'date',
								type: 'time',
								title: 'Date',
								timeGrain: 'day',
							},
							yAxis: {
								title: 'Signups',
							},
							series: [{ name: 'signups', type: 'line', showDataPoints: true }],
						}"
					/>
				</div>
				<div class="border rounded-md min-h-72">
					<AxisChart
						:config="{
							data: enrollmentsData,
							title: 'Enrollments',
							subtitle: 'Enrollments per month',
							xAxis: {
								key: 'date',
								type: 'time',
								title: 'Date',
								timeGrain: 'day',
							},
							yAxis: {
								title: 'Enrollments',
							},
							series: [
								{ name: 'enrollments', type: 'line', showDataPoints: true },
							],
						}"
					/>
				</div>
				<div class="border rounded-md">
					<AxisChart
						:config="{
							data: lessonData,
							title: 'Milestones',
							subtitle: 'Milestones per month',
							xAxis: {
								key: 'date',
								type: 'time',
								title: 'Date',
								timeGrain: 'day',
							},
							yAxis: {
								title: 'Milestones',
							},
							series: [
								{
									name: 'lesson_completion',
									type: 'line',
									showDataPoints: true,
								},
							],
						}"
					/>
				</div>
				<div class="border rounded-md">
					<DonutChart
						:config="{
							data: courseData,
							title: 'Completions',
							subtitle: 'Course Completion',
							categoryColumn: 'label',
							valueColumn: 'value',
						}"
					/>
				</div>
			</div>
		</div>
	</div>
</template>
<script setup>
import {
	AxisChart,
	Breadcrumbs,
	createResource,
	DonutChart,
	NumberChart,
	usePageMeta,
} from 'frappe-ui'
import { computed } from 'vue'
import { sessionStore } from '../stores/session'

const { brand } = sessionStore()

const breadcrumbs = computed(() => {
	return [
		{
			label: 'Statistics',
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

const _chartDetails = {
	data: {
		enrollments: 100523,
		courses: 27,
		users: 49038,
		completions: 16316,
		lesson_completions: 331982,
	},
}

const signupsChart = createResource({
	url: 'lms.lms.utils.get_chart_data',
	cache: ['signups'],
	params: {
		chart_name: 'New Signups',
	},
	auto: true,
})

const signupsData = [
	{ date: new Date('23-03-2025'), signups: 57 },
	{ date: new Date('24-03-2025'), signups: 97 },
	{ date: new Date('25-03-2025'), signups: 96 },
	{ date: new Date('26-03-2025'), signups: 60 },
	{ date: new Date('27-03-2025'), signups: 55 },
	{ date: new Date('28-03-2025'), signups: 72 },
	{ date: new Date('29-03-2025'), signups: 51 },
	{ date: new Date('30-03-2025'), signups: 37 },
	{ date: new Date('31-03-2025'), signups: 54 },
	{ date: new Date('01-04-2025'), signups: 76 },
	{ date: new Date('02-04-2025'), signups: 87 },
	{ date: new Date('03-04-2025'), signups: 80 },
	{ date: new Date('04-04-2025'), signups: 67 },
	{ date: new Date('05-04-2025'), signups: 47 },
	{ date: new Date('06-04-2025'), signups: 46 },
	{ date: new Date('07-04-2025'), signups: 110 },
	{ date: new Date('08-04-2025'), signups: 103 },
	{ date: new Date('09-04-2025'), signups: 77 },
	{ date: new Date('10-04-2025'), signups: 107 },
	{ date: new Date('11-04-2025'), signups: 82 },
	{ date: new Date('12-04-2025'), signups: 53 },
	{ date: new Date('13-04-2025'), signups: 63 },
	{ date: new Date('14-04-2025'), signups: 83 },
	{ date: new Date('15-04-2025'), signups: 112 },
	{ date: new Date('16-04-2025'), signups: 75 },
	{ date: new Date('17-04-2025'), signups: 84 },
	{ date: new Date('18-04-2025'), signups: 67 },
	{ date: new Date('19-04-2025'), signups: 60 },
	{ date: new Date('20-04-2025'), signups: 48 },
	{ date: new Date('21-04-2025'), signups: 60 },
	{ date: new Date('22-04-2025'), signups: 96 },
	{ date: new Date('23-04-2025'), signups: 0 },
]

const enrollmentChart = createResource({
	url: 'lms.lms.utils.get_chart_data',
	cache: ['enrollments'],
	params: {
		chart_name: 'Course Enrollments',
	},
	auto: true,
})

const enrollmentsData = [
	{ date: new Date('23-03-2025'), enrollments: 116 },
	{ date: new Date('24-03-2025'), enrollments: 174 },
	{ date: new Date('25-03-2025'), enrollments: 162 },
	{ date: new Date('26-03-2025'), enrollments: 159 },
	{ date: new Date('27-03-2025'), enrollments: 105 },
	{ date: new Date('28-03-2025'), enrollments: 111 },
	{ date: new Date('29-03-2025'), enrollments: 99 },
	{ date: new Date('30-03-2025'), enrollments: 85 },
	{ date: new Date('31-03-2025'), enrollments: 107 },
	{ date: new Date('01-04-2025'), enrollments: 153 },
	{ date: new Date('02-04-2025'), enrollments: 142 },
	{ date: new Date('03-04-2025'), enrollments: 147 },
	{ date: new Date('04-04-2025'), enrollments: 127 },
	{ date: new Date('05-04-2025'), enrollments: 96 },
	{ date: new Date('06-04-2025'), enrollments: 97 },
	{ date: new Date('07-04-2025'), enrollments: 156 },
	{ date: new Date('08-04-2025'), enrollments: 145 },
	{ date: new Date('09-04-2025'), enrollments: 118 },
	{ date: new Date('10-04-2025'), enrollments: 158 },
	{ date: new Date('11-04-2025'), enrollments: 132 },
	{ date: new Date('12-04-2025'), enrollments: 103 },
	{ date: new Date('13-04-2025'), enrollments: 113 },
	{ date: new Date('14-04-2025'), enrollments: 153 },
	{ date: new Date('15-04-2025'), enrollments: 162 },
	{ date: new Date('16-04-2025'), enrollments: 135 },
	{ date: new Date('17-04-2025'), enrollments: 144 },
	{ date: new Date('18-04-2025'), enrollments: 127 },
	{ date: new Date('19-04-2025'), enrollments: 120 },
	{ date: new Date('20-04-2025'), enrollments: 108 },
	{ date: new Date('21-04-2025'), enrollments: 120 },
	{ date: new Date('22-04-2025'), enrollments: 156 },
	{ date: new Date('23-04-2025'), enrollments: 0 },
]

const lessonCompletion = createResource({
	url: 'lms.lms.utils.get_chart_data',
	cache: ['lessonCompletion'],
	params: {
		chart_name: 'Lesson Completion',
	},
	auto: true,
})

const lessonData = [
	{ date: new Date('23-03-2025'), lesson_completion: 311 },
	{ date: new Date('24-03-2025'), lesson_completion: 544 },
	{ date: new Date('25-03-2025'), lesson_completion: 485 },
	{ date: new Date('26-03-2025'), lesson_completion: 545 },
	{ date: new Date('27-03-2025'), lesson_completion: 381 },
	{ date: new Date('28-03-2025'), lesson_completion: 294 },
	{ date: new Date('29-03-2025'), lesson_completion: 320 },
	{ date: new Date('30-03-2025'), lesson_completion: 238 },
	{ date: new Date('31-03-2025'), lesson_completion: 350 },
	{ date: new Date('01-04-2025'), lesson_completion: 420 },
	{ date: new Date('02-04-2025'), lesson_completion: 470 },
	{ date: new Date('03-04-2025'), lesson_completion: 472 },
	{ date: new Date('04-04-2025'), lesson_completion: 342 },
	{ date: new Date('05-04-2025'), lesson_completion: 318 },
	{ date: new Date('06-04-2025'), lesson_completion: 289 },
	{ date: new Date('07-04-2025'), lesson_completion: 450 },
	{ date: new Date('08-04-2025'), lesson_completion: 600 },
	{ date: new Date('09-04-2025'), lesson_completion: 477 },
	{ date: new Date('10-04-2025'), lesson_completion: 505 },
	{ date: new Date('11-04-2025'), lesson_completion: 394 },
	{ date: new Date('12-04-2025'), lesson_completion: 758 },
	{ date: new Date('13-04-2025'), lesson_completion: 402 },
	{ date: new Date('14-04-2025'), lesson_completion: 516 },
	{ date: new Date('15-04-2025'), lesson_completion: 477 },
	{ date: new Date('16-04-2025'), lesson_completion: 416 },
	{ date: new Date('17-04-2025'), lesson_completion: 488 },
	{ date: new Date('18-04-2025'), lesson_completion: 447 },
	{ date: new Date('19-04-2025'), lesson_completion: 312 },
	{ date: new Date('20-04-2025'), lesson_completion: 192 },
	{ date: new Date('21-04-2025'), lesson_completion: 373 },
	{ date: new Date('22-04-2025'), lesson_completion: 383 },
	{ date: new Date('23-04-2025'), lesson_completion: 0 },
]

const courseCompletion = createResource({
	url: 'lms.lms.utils.get_course_completion_data',
	auto: true,
	cache: ['courseCompletion'],
})

const courseData = [
	{ label: 'Completed', value: 16316 },
	{ label: 'In Progress', value: 84207 },
]

usePageMeta(() => {
	return {
		title: __('Statistics'),
		icon: brand.favicon,
	}
})
</script>
