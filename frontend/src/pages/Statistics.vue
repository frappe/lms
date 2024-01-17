<template>
	<div class="h-screen text-base">
		<header
			class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs class="h-7" :items="breadcrumbs" />
		</header>
		<div class="p-5">
			<div class="grid grid-cols-5 gap-5">
				<div class="flex items-center border py-2 px-3 rounded-md">
					<div class="p-2 rounded-md bg-gray-100 mr-3">
						<BookOpen class="w-18 h-18 stroke-1.5 text-gray-700" />
					</div>
					<div>
						<div class="text-xl font-semibold mb-1">
							{{ courseCount.data?.toLocaleString() }}
						</div>
						<div class="text-gray-700">
							{{ __('Published Courses') }}
						</div>
					</div>
				</div>
				<div class="flex items-center border py-2 px-3 rounded-md">
					<div class="p-2 rounded-md bg-gray-100 mr-3">
						<LogIn class="w-18 h-18 stroke-1.5 text-gray-700" />
					</div>
					<div>
						<div class="text-xl font-semibold mb-1">
							{{ userCount.data?.toLocaleString() }}
						</div>
						<div class="text-gray-700">
							{{ __('Total Signups') }}
						</div>
					</div>
				</div>
				<div class="flex items-center border py-2 px-3 rounded-md">
					<div class="p-2 rounded-md bg-gray-100 mr-3">
						<BookOpenCheck class="w-18 h-18 stroke-1.5 text-gray-700" />
					</div>
					<div>
						<div class="text-xl font-semibold mb-1">
							{{ enrollmentCount.data?.toLocaleString() }}
						</div>
						<div class="text-gray-700">
							{{ __('Enrolled Users') }}
						</div>
					</div>
				</div>
				<div class="flex items-center border py-2 px-3 rounded-md">
					<div class="p-2 rounded-md bg-gray-100 mr-3">
						<FileCheck class="w-18 h-18 stroke-1.5 text-gray-700" />
					</div>
					<div>
						<div class="text-xl font-semibold mb-1">
							{{ coursesCompleted.data?.toLocaleString() }}
						</div>
						<div class="text-gray-700">
							{{ __('Courses Completed') }}
						</div>
					</div>
				</div>
				<div class="flex items-center border py-2 px-3 rounded-md">
					<div class="p-2 rounded-md bg-gray-100 mr-3">
						<FileCheck2 class="w-18 h-18 stroke-1.5 text-gray-700" />
					</div>
					<div>
						<div class="text-xl font-semibold mb-1">
							{{ lessonsCompleted.data?.toLocaleString() }}
						</div>
						<div class="text-gray-700">
							{{ __('Lessons Completed') }}
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
<script setup>
import { createResource, Breadcrumbs } from 'frappe-ui'
import { computed, inject } from 'vue'
import { Line } from 'vue-chartjs'
import {
	BookOpen,
	LogIn,
	FileCheck,
	FileCheck2,
	BookOpenCheck,
} from 'lucide-vue-next'

const dayjs = inject('dayjs')

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

const enrollmentCount = createResource({
	url: 'frappe.client.get_count',
	params: {
		doctype: 'LMS Enrollment',
	},
	auto: true,
	cache: ['enrollment_count'],
})

const courseCount = createResource({
	url: 'frappe.client.get_count',
	params: {
		doctype: 'LMS Course',
		filters: {
			published: 1,
			upcoming: 0,
		},
	},
	auto: true,
	cache: ['course_count'],
})

const userCount = createResource({
	url: 'frappe.client.get_count',
	params: {
		doctype: 'User',
		filters: {
			enabled: 1,
		},
	},
	auto: true,
	cache: ['user_count'],
})

const coursesCompleted = createResource({
	url: 'frappe.client.get_count',
	params: {
		doctype: 'LMS Enrollment',
		filters: {
			progress: ['like', '%100%'],
		},
	},
	auto: true,
	cache: ['courses_completed'],
})

const lessonsCompleted = createResource({
	url: 'frappe.client.get_count',
	params: {
		doctype: 'LMS Course Progress',
	},
	auto: true,
	cache: ['lessons_completed'],
})

const generateGraph = () => {
	createResource({
		url: 'lms.lms.utils.get_chart_data',
		params: {
			chart_name: chartName,
			timespan: 'Select Date Range',
			timegrain: 'Daily',
			from_date: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
			to_date: dayjs().format('YYYY-MM-DD'),
		},
		onSuccess(data) {
			renderChart(data.message, chartName, chartElement, chartType)
		},
	})
}
</script>
