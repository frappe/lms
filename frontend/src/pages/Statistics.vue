<template>
	<div class="">
		<header
			class="sticky top-0 z-10 flex items-center justify-between border-b bg-surface-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs class="h-7" :items="breadcrumbs" />
		</header>
		<div v-if="chartDetails.data" class="p-5">
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
				<Tooltip :text="__('Published Courses')">
					<NumberChart
						class="border rounded-md"
						:config="{ title: 'Courses', value: chartDetails.data.courses }"
					/>
				</Tooltip>
				<Tooltip :text="__('Active Members')">
					<NumberChart
						class="border rounded-md"
						:config="{ title: 'Signups', value: chartDetails.data.users }"
					/>
				</Tooltip>
				<Tooltip :text="__('Course Enrollments')">
					<NumberChart
						class="border rounded-md"
						:config="{
							title: 'Enrollments',
							value: chartDetails.data.enrollments,
						}"
					/>
				</Tooltip>
				<Tooltip :text="__('Course Completions')">
					<NumberChart
						class="border rounded-md"
						:config="{
							title: 'Completions',
							value: chartDetails.data.completions,
						}"
					/>
				</Tooltip>
				<Tooltip :text="__('Certified Members')">
					<NumberChart
						class="border rounded-md"
						:config="{
							title: 'Certifications',
							value: chartDetails.data.certifications,
						}"
					/>
				</Tooltip>
			</div>
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
				<div class="border rounded-md min-h-72">
					<AxisChart
						v-if="signupsChart.data"
						:config="{
							data: signupsChart.data,
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
						v-if="enrollmentChart.data"
						:config="{
							data: enrollmentChart.data,
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
						v-if="certification.data"
						:config="{
							data: certification.data,
							title: 'Certifications',
							subtitle: 'Certifications per month',
							xAxis: {
								key: 'date',
								type: 'time',
								title: 'Date',
								timeGrain: 'day',
							},
							yAxis: {
								title: 'Certifications',
							},
							series: [
								{
									name: 'certifications',
									type: 'line',
									showDataPoints: true,
								},
							],
						}"
					/>
				</div>
				<div class="border rounded-md">
					<DonutChart
						v-if="courseCompletion.data"
						:config="{
							data: courseCompletion.data,
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
	Tooltip,
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

const signupsChart = createResource({
	url: 'lms.lms.utils.get_chart_data',
	params: {
		chart_name: 'New Signups',
	},
	auto: true,
	transform(data) {
		return data.map((item) => {
			return {
				date: new Date(item.date),
				signups: item.count,
			}
		})
	},
})

const enrollmentChart = createResource({
	url: 'lms.lms.utils.get_chart_data',
	cache: ['enrollments'],
	params: {
		chart_name: 'Course Enrollments',
	},
	auto: true,
	transform(data) {
		return data.map((item) => {
			return {
				date: new Date(item.date),
				enrollments: item.count,
			}
		})
	},
})

const certification = createResource({
	url: 'lms.lms.utils.get_chart_data',
	cache: ['certifications'],
	params: {
		chart_name: 'Certification',
	},
	auto: true,
	transform(data) {
		return data.map((item) => {
			return {
				date: new Date(item.date),
				certifications: item.count,
			}
		})
	},
})

const courseCompletion = createResource({
	url: 'lms.lms.utils.get_course_completion_data',
	auto: true,
	cache: ['courseCompletion'],
})

usePageMeta(() => {
	return {
		title: __('Statistics'),
		icon: brand.favicon,
	}
})
</script>
