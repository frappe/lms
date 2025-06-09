<template>
	<div v-if="relatedCourses.data?.length" class="mt-10">
		<div class="flex items-center justify-between mb-6">
			<div class="text-2xl font-semibold text-ink-gray-9">
				{{ __('Related Courses') }}
			</div>
			<div class="text-sm text-ink-gray-7">
				{{ relatedCourses.data.length }} {{ __('courses') }}
			</div>
		</div>
		<div
			class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4"
		>
			<router-link
				v-for="course in relatedCourses.data"
				:to="{ name: 'CourseDetail', params: { courseName: course.name } }"
				class="cursor-pointer"
			>
				<CourseCard :course="course" />
			</router-link>
		</div>
	</div>
	<div v-else-if="relatedCourses.loading" class="mt-10">
		<div class="text-2xl font-semibold text-ink-gray-9 mb-6">
			{{ __('Related Courses') }}
		</div>
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			<div
				v-for="n in 3"
				:key="n"
				class="animate-pulse bg-gray-200 rounded-md h-80"
			></div>
		</div>
	</div>
</template>

<script setup>
import { createResource } from 'frappe-ui'
import CourseCard from '@/components/CourseCard.vue'
import { useRoute } from 'vue-router'
import { watch } from 'vue'

const route = useRoute()

const props = defineProps({
	courseName: {
		type: String,
		required: true,
	},
})

const relatedCourses = createResource({
	url: 'lms.lms.utils.get_related_courses',
	cache: ['related_courses', props.courseName],
	params: {
		course: props.courseName,
	},
	auto: true,
})

watch(
	() => route.params.courseName,
	(newCourseName, oldCourseName) => {
		if (newCourseName && newCourseName !== oldCourseName) {
			relatedCourses.update({
				cache: ['related_courses', newCourseName],
				params: { course: newCourseName },
			})
			relatedCourses.reload()
		}
	}
)
</script>
