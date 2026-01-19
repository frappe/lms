<template>
	<div class="">
		<header class="sticky top-0 z-10 flex items-center justify-between bg-surface-white px-3 py-2.5 sm:px-5">
			<Breadcrumbs :items="breadcrumbs" />
		</header>
		<div v-if="chartDetails.data" class="p-5">
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
				<Tooltip :text="__('Published Courses')">
					<!-- <NumberChart class="border rounded-xl"
						:config="{ title: 'Courses', value: chartDetails.data.courses }" /> -->
					<div class="border rounded-xl p-4 flex items-center gap-4">
						<div class="bg-primary-50 w-12 h-12 rounded-full flex items-center justify-center">
							<BookIcon class="text-primary-500 w-6 h-6" />
						</div>
						<div class="flex-1">
							<div class="text-xl text-gray-900 font-semibold">{{ chartDetails.data.courses }}</div>
							<div class="text-sm text-gray-700">Courses</div>
						</div>
						<div class="flex items-start h-12">
							<div class="text-primary-500 text-sm font-medium flex items-center gap-1">
								<ArrowUpIcon class="w-4 h-4" />
								1.2%
							</div>
						</div>
					</div>
				</Tooltip>
				<Tooltip :text="__('Active Members')">
					<!-- <NumberChart class="border rounded-xl"
						:config="{ title: 'Signups', value: chartDetails.data.users }" /> -->
					<div class="border rounded-xl p-4 flex items-center gap-4">
						<div class="bg-primary-50 w-12 h-12 rounded-full flex items-center justify-center">
							<UserCircleAddIcon class="text-primary-500 w-6 h-6" />
						</div>
						<div class="flex-1">
							<div class="text-xl text-gray-900 font-semibold">{{ chartDetails.data.users }}</div>
							<div class="text-sm text-gray-700">Signups</div>
						</div>
						<div class="flex items-start h-12">
							<div class="text-primary-500 text-sm font-medium flex items-center gap-1">
								<ArrowUpIcon class="w-4 h-4" />
								2.5%
							</div>
						</div>
					</div>
				</Tooltip>
				<Tooltip :text="__('Course Enrollments')">
					<!-- <NumberChart class="border rounded-xl" :config="{
						title: 'Enrollments',
						value: chartDetails.data.enrollments,
					}" /> -->
					<div class="border rounded-xl p-4 flex items-center gap-4">
						<div class="bg-primary-50 w-12 h-12 rounded-full flex items-center justify-center">
							<ClipboardIcon class="text-primary-500 w-6 h-6" />
						</div>
						<div class="flex-1">
							<div class="text-xl text-gray-900 font-semibold">{{ chartDetails.data.enrollments }}</div>
							<div class="text-sm text-gray-700">Enrollments</div>
						</div>
						<div class="flex items-start h-12">
							<div class="text-error-500 text-sm font-medium flex items-center gap-1">
								<ArrowDownIcon class="w-4 h-4" />
								1.7%
							</div>
						</div>
					</div>
				</Tooltip>
				<Tooltip :text="__('Course Completions')">
					<!-- <NumberChart class="border rounded-xl" :config="{
						title: 'Completions',
						value: chartDetails.data.completions,
					}" /> -->
					<div class="border rounded-xl p-4 flex items-center gap-4">
						<div class="bg-primary-50 w-12 h-12 rounded-full flex items-center justify-center">
							<TickCircleIcon class="text-primary-500 w-6 h-6" />
						</div>
						<div class="flex-1">
							<div class="text-xl text-gray-900 font-semibold">{{ chartDetails.data.completions }}</div>
							<div class="text-sm text-gray-700">Completions</div>
						</div>
						<div class="flex items-start h-12">
							<div class="text-primary-500 text-sm font-medium flex items-center gap-1">
								<ArrowUpIcon class="w-4 h-4" />
								2.5%
							</div>
						</div>
					</div>
				</Tooltip>
				<Tooltip :text="__('Certified Members')">
					<!-- <NumberChart class="border rounded-xl" :config="{
						title: 'Certifications',
						value: chartDetails.data.certifications,
					}" /> -->
					<div class="border rounded-xl p-4 flex items-center gap-4">
						<div class="bg-primary-50 w-12 h-12 rounded-full flex items-center justify-center">
							<AwardIcon class="text-primary-500 w-6 h-6" />
						</div>
						<div class="flex-1">
							<div class="text-xl text-gray-900 font-semibold">{{ chartDetails.data.certifications }}
							</div>
							<div class="text-sm text-gray-700">Certifications</div>
						</div>
						<div class="flex items-start h-12">
							<div class="text-gray-500 text-sm font-medium flex items-center gap-1">
								<ArrowUpIcon class="w-4 h-4" />
								0%
							</div>
						</div>
					</div>
				</Tooltip>
			</div>
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
				<div class="border rounded-xl min-h-72">
					<AxisChart v-if="signupsChart.data" :config="{
						data: signupsChart.data,
						title: 'Signups',
						subtitle: 'Signups per day',
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
					}" />
				</div>
				<div class="border rounded-xl min-h-72">
					<AxisChart v-if="enrollmentChart.data" :config="{
						data: enrollmentChart.data,
						title: 'Enrollments',
						subtitle: 'Enrollments per day',
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
					}" />
				</div>
				<div class="border rounded-xl">
					<AxisChart v-if="certification.data" :config="{
						data: certification.data,
						title: 'Certifications',
						subtitle: 'Certifications per day',
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
					}" />
				</div>
				<div class="border rounded-xl">
					<DonutChart v-if="courseCompletion.data" :config="{
						data: courseCompletion.data,
						title: 'Completions',
						subtitle: 'Course Completion',
						categoryColumn: 'label',
						valueColumn: 'value',
					}" />
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
import { ArrowUpIcon, ArrowDownIcon } from 'lucide-vue-next'
import BookIcon from '@/components/Icons/BookIcon.vue'
import UserCircleAddIcon from '@/components/Icons/UserCircleAddIcon.vue'
import ClipboardIcon from "@/components/icons/ClipboardIcon.vue"
import TickCircleIcon from '@/components/icons/TickCircleIcon.vue'
import AwardIcon from '@/components/icons/AwardIcon.vue'

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
