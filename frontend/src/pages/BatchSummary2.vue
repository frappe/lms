<template>
	<div class="min-h-screen">
		<!-- Header Breadcrumb -->
		<header class="bg-surface-white px-5 pt-4 pb-2">
			<CourseBreadcrumb :items="breadcrumbs" />
		</header>

		<div class="px-5 py-6">
			<!-- Batch Summary Card -->
			<div class="bg-white rounded-lg border p-5 mb-8">
				<div class="flex items-start justify-between">
					<div class="flex items-start space-x-4">
						<!-- Batch Image -->
						<img
							:src="batch.image"
							:alt="batch.title"
							class="w-28 h-20 rounded-lg object-cover flex-shrink-0"
						/>

						<!-- Batch Info -->
						<div>
							<h1 class="text-lg font-semibold text-ink-gray-9 mb-1">
								{{ batch.title }}
							</h1>
							<div class="text-sm text-teal-600 mb-3">
								{{ batch.status }}
							</div>
							<div class="flex items-center space-x-6 text-sm text-ink-gray-5">
								<div class="flex items-center">
									<Calendar class="h-4 w-4 mr-1.5" />
									<span>{{ batch.dateRange }} • {{ batch.mode }}</span>
								</div>
								<div class="flex items-center">
									<Clock class="h-4 w-4 mr-1.5" />
									<span>{{ batch.timeRange }}</span>
								</div>
							</div>
						</div>
					</div>

					<!-- Visit Batches Button -->
					<Button variant="solid" class="!bg-teal-500 hover:!bg-teal-600">
						{{ __('Visit Batches') }}
					</Button>
				</div>
			</div>

			<!-- Related Courses Section -->
			<section>
				<h2 class="text-xl font-semibold text-ink-gray-9 mb-6">
					{{ __('Related Courses') }}
				</h2>

				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					<div
						v-for="course in relatedCourses"
						:key="course.id"
						class="bg-white rounded-lg border overflow-hidden"
					>
						<!-- Course Image -->
						<div class="relative">
							<img
								:src="course.image"
								:alt="course.title"
								class="w-full h-44 object-cover"
							/>
							<span
								v-if="course.hasCertification"
								class="absolute top-3 left-3 bg-teal-500 text-white text-xs font-medium px-2.5 py-1 rounded"
							>
								Certification
							</span>
						</div>

						<!-- Course Content -->
						<div class="p-4">
							<h3
								class="font-semibold text-ink-gray-9 mb-3 line-clamp-2 min-h-[48px]"
							>
								{{ course.title }}
							</h3>

							<!-- Stats -->
							<div class="space-y-1.5 text-sm text-ink-gray-5 mb-3">
								<div class="flex items-center">
									<BookOpen class="h-4 w-4 mr-2" />
									<span
										><span class="font-medium text-ink-gray-9">{{
											course.lessons
										}}</span>
										lessons</span
									>
								</div>
								<div class="flex items-center">
									<Users class="h-4 w-4 mr-2" />
									<span
										><span class="font-medium text-ink-gray-9">{{
											course.students
										}}</span>
										Enrolled Students</span
									>
								</div>
								<div class="flex items-center">
									<Star class="h-4 w-4 mr-2 fill-yellow-400 text-yellow-400" />
									<span
										><span class="font-medium text-ink-gray-9">{{
											course.rating
										}}</span>
										({{ course.reviews }} reviews)</span
									>
								</div>
							</div>

							<!-- Instructors -->
							<div class="flex items-center mb-4">
								<div class="flex -space-x-2 mr-2">
									<img
										v-for="instructor in course.instructors"
										:key="instructor.name"
										:src="instructor.avatar"
										:alt="instructor.name"
										class="w-6 h-6 rounded-full border-2 border-white"
									/>
								</div>
								<span class="text-sm text-ink-gray-5">
									{{ course.instructors.map((i) => i.name).join(', ') }}, and
									others
								</span>
							</div>

							<!-- Progress -->
							<div class="mb-4">
								<div class="flex justify-between text-sm mb-1">
									<span class="text-ink-gray-5">Course progress</span>
									<span class="font-medium text-ink-gray-9"
										>{{ course.progress }}%</span
									>
								</div>
								<div class="h-1.5 bg-gray-200 rounded-full overflow-hidden">
									<div
										class="h-full bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full transition-all"
										:style="{ width: course.progress + '%' }"
									></div>
								</div>
							</div>

							<!-- View Course Button -->
							<Button
								variant="outline"
								class="w-full !border-teal-500 !text-teal-500 hover:!bg-teal-50"
							>
								{{ __('View Course') }}
							</Button>
						</div>
					</div>
				</div>
			</section>
		</div>
	</div>
</template>

<script setup>
import { ref } from 'vue'
import { Button } from 'frappe-ui'
import { BookOpen, Calendar, Clock, Star, Users } from 'lucide-vue-next'
import CourseBreadcrumb from '@/components/CourseBreadcrumb.vue'

// Dummy batch data
const batch = ref({
	title: 'Intensive Learning Intermediate (Batch 1)',
	status: 'Course Completed',
	image:
		'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?w=400&h=300&fit=crop',
	dateRange: '01 Oct 2025 - 25 Dec 2025',
	mode: 'Online',
	timeRange: '12:00 AM - 10:00 PM',
})

// Dummy related courses
const relatedCourses = ref([
	{
		id: 1,
		title: 'K1-1. Konsep Dasar Perubahan Iklim dan Keberlanjutan',
		image:
			'https://images.unsplash.com/photo-1532601224476-15c79f2f7a51?w=600&h=400&fit=crop',
		hasCertification: true,
		lessons: 16,
		students: 200,
		rating: 4.5,
		reviews: '451.444',
		instructors: [
			{
				name: 'Aggraeni Purwanti',
				avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
			},
			{
				name: 'Rizka Putri',
				avatar: 'https://randomuser.me/api/portraits/women/68.jpg',
			},
		],
		progress: 50,
	},
	{
		id: 2,
		title: 'K1-1. Konsep Dasar Perubahan Iklim dan Keberlanjutan',
		image:
			'https://images.unsplash.com/photo-1532601224476-15c79f2f7a51?w=600&h=400&fit=crop',
		hasCertification: false,
		lessons: 16,
		students: 200,
		rating: 4.5,
		reviews: '451.444',
		instructors: [
			{
				name: 'Aggraeni Purwanti',
				avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
			},
			{
				name: 'Rizka Putri',
				avatar: 'https://randomuser.me/api/portraits/women/68.jpg',
			},
		],
		progress: 0,
	},
	{
		id: 3,
		title: 'K1-1. Konsep Dasar Perubahan Iklim dan Keberlanjutan',
		image:
			'https://images.unsplash.com/photo-1532601224476-15c79f2f7a51?w=600&h=400&fit=crop',
		hasCertification: true,
		lessons: 16,
		students: 200,
		rating: 4.5,
		reviews: '451.444',
		instructors: [
			{
				name: 'Aggraeni Purwanti',
				avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
			},
			{
				name: 'Rizka Putri',
				avatar: 'https://randomuser.me/api/portraits/women/68.jpg',
			},
		],
		progress: 50,
	},
])

// Dummy breadcrumbs
const breadcrumbs = ref([
	{ label: 'Batches', route: { name: 'Batches' } },
	{
		label: 'Intensive Learning Intermediate (Batch 1)',
		route: { name: 'BatchDetail' },
	},
])
</script>

<style scoped>
.line-clamp-2 {
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}
</style>
