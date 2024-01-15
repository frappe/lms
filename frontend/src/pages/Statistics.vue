<template>
	<div class="h-screen">
		<header
			class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs class="h-7" :items="breadcrumbs" />
		</header>
		<div class="p-5">
			<div class="grid grid-cols-5 gap-5">
				<div class="flex items-center border py-2 px-3 rounded-md">
					<div class="p-15 bg-gray-100">
						<BookOpen class="w-18 h-18 stroke-1.5" />
					</div>
					<div>
						<div>
							{{ courseCount.data }}
						</div>
						<div>
							{{ __('Published Courses') }}
						</div>
					</div>
				</div>
				<div class="border py-2 px-3 rounded-md">
					<BookOpenCheck class="w-4 h-4 stroke-1.5" />
					<div>
						{{ enrollmentCount.data }}
					</div>
					<div>
						{{ __('Course Enrollments') }}
					</div>
				</div>
				<div class="border py-2 px-3 rounded-md">
					<LogIn class="w-4 h-4 stroke-1.5" />
					<div>
						{{ userCount.data }}
					</div>
					<div>
						{{ __('Total Signups') }}
					</div>
				</div>
				<div class="border py-2 px-3 rounded-md">
					<FileCheck class="w-4 h-4 stroke-1.5" />
					<div>
						{{ coursesCompleted.data }}
					</div>
					<div>
						{{ __('Courses Completed') }}
					</div>
				</div>
				<div class="border py-2 px-3 rounded-md">
					<FileCheck2 class="w-4 h-4 stroke-1.5" />
					<div>
						{{ lessonsCompleted.data }}
					</div>
					<div>
						{{ __('Lessons Completed') }}
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
<script setup>
import { createResource, Breadcrumbs } from 'frappe-ui'
import { computed } from 'vue'
import {
	BookOpen,
	LogIn,
	FileCheck,
	FileCheck2,
	BookOpenCheck,
} from 'lucide-vue-next'

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
</script>
