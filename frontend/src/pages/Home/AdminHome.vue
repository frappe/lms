<template>
	<div>
		<div v-if="createdCourses.data?.length" class="mt-10">
			<div class="flex items-center justify-between mb-3">
				<span class="font-semibold text-lg">
					{{ __('Courses by me') }}
				</span>
				<router-link
					:to="{
						name: 'Courses',
					}"
				>
					<span class="flex items-center space-x-1 text-ink-gray-5 text-xs">
						<span>
							{{ __('See all') }}
						</span>
						<MoveRight class="size-3 stroke-1.5" />
					</span>
				</router-link>
			</div>
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
				<router-link
					v-for="course in createdCourses.data"
					:to="{ name: 'CourseDetail', params: { courseName: course.name } }"
				>
					<CourseCard :course="course" />
				</router-link>
			</div>
		</div>

		<div v-if="createdBatches.data?.length" class="mt-10">
			<div class="flex items-center justify-between mb-3">
				<span class="font-semibold text-lg">
					{{ __('Batches by me') }}
				</span>
				<router-link
					:to="{
						name: 'Batches',
					}"
				>
					<span class="flex items-center space-x-1 text-ink-gray-5 text-xs">
						<span>
							{{ __('See all') }}
						</span>
						<MoveRight class="size-3 stroke-1.5" />
					</span>
				</router-link>
			</div>
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
				<router-link
					v-for="batch in createdBatches.data"
					:to="{ name: 'BatchDetail', params: { batchName: batch.name } }"
				>
					<BatchCard :batch="batch" />
				</router-link>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import { createResource } from 'frappe-ui'
import { MoveRight } from 'lucide-vue-next'
import CourseCard from '@/components/CourseCard.vue'
import BatchCard from '@/components/BatchCard.vue'

const createdCourses = createResource({
	url: 'lms.lms.utils.get_created_courses',
	auto: true,
})

const createdBatches = createResource({
	url: 'lms.lms.utils.get_created_batches',
	auto: true,
})
</script>
