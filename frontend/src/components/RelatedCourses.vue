<template>
	<div v-if="relatedCourses.data?.length" class="mt-10">
		<div class="flex items-center justify-between mb-6">
			<div class="text-2xl font-semibold text-ink-gray-9">
				{{ __('Related Courses') }}
			</div>
		</div>
		<div
			class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4"
		>
			<router-link
				v-for="course in relatedCourses.data"
				:key="course.name"
				:to="{ name: 'CourseDetail', params: { courseName: course.name } }"
				class="cursor-pointer"
			>
				<CourseCard :course="course" />
			</router-link>
		</div>
	</div>
</template>

<script setup>
import { createResource } from 'frappe-ui'
import { watch } from 'vue'
import CourseCard from '@/components/CourseCard.vue'

const props = defineProps({
	courseName: {
		type: String,
		required: true,
	},
})

const relatedCourses = createResource({
	url: 'lms.lms.utils.get_related_courses',
	cache: ['related_courses', props.courseName],
	makeParams() {
		return {
			course: props.courseName,
		}
	},
	auto: true,
})

watch(
	() => props.courseName,
	() => {
		relatedCourses.reload()
	}
)
</script>
