<template>
	<div v-if="course.data">
		<header
			class="sticky top-0 z-10 flex items-center justify-between border-b bg-surface-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs class="h-7" :items="breadcrumbs" />
		</header>
		<div class="m-5">
			<div class="flex justify-between w-full space-x-5">
				<div class="md:w-2/3">
					<div class="text-3xl font-semibold text-ink-gray-9">
						{{ course.data.title }}
					</div>
					<div class="my-3 leading-6 text-ink-gray-7">
						{{ course.data.short_introduction }}
					</div>
					<div class="flex items-center">
						<Tooltip
							v-if="parseInt(course.data.rating) > 0"
							:text="__('Average Rating')"
							class="flex items-center"
						>
							<Star class="size-4 text-transparent fill-yellow-500" />
							<span class="ml-1 text-ink-gray-7">
								{{ course.data.rating }}
							</span>
						</Tooltip>
						<span v-if="parseInt(course.data.rating) > 0" class="mx-3"
							>&middot;</span
						>
						<Tooltip
							v-if="course.data.enrollment_count"
							:text="__('Enrolled Students')"
							class="flex items-center"
						>
							<Users class="h-4 w-4 text-ink-gray-7" />
							<span class="ml-1">
								{{ course.data.enrollment_count_formatted }}
							</span>
						</Tooltip>
						<span v-if="course.data.enrollment_count" class="mx-3"
							>&middot;</span
						>
						<div class="flex items-center">
							<span
								class="h-6 mr-1"
								:class="{
									'avatar-group overlap': course.data.instructors.length > 1,
								}"
							>
								<UserAvatar
									v-for="instructor in course.data.instructors"
									:user="instructor"
								/>
							</span>
							<CourseInstructors :instructors="course.data.instructors" />
						</div>
					</div>
					<div v-if="course.data.tags" class="flex my-4 w-fit">
						<Badge
							theme="gray"
							size="lg"
							class="mr-2 text-ink-gray-9"
							v-for="tag in course.data.tags.split(', ')"
						>
							{{ tag }}
						</Badge>
					</div>
					<div class="md:hidden my-4">
						<CourseCardOverlay :course="course" />
					</div>
					<div
						v-html="course.data.description"
						class="ProseMirror prose prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-outline-gray-2 prose-th:border-outline-gray-2 prose-td:relative prose-th:relative prose-th:bg-surface-gray-2 prose-sm max-w-none !whitespace-normal mt-10"
					></div>
					<div class="mt-10">
						<CourseOutline
							:title="__('Course Outline')"
							:courseName="course.data.name"
							:showOutline="true"
							:getProgress="course.data.membership ? true : false"
						/>
					</div>
					<CourseReviews
						:courseName="course.data.name"
						:avg_rating="course.data.rating"
						:membership="course.data.membership"
					/>
				</div>
				<div class="hidden md:block">
					<CourseCardOverlay :course="course" />
				</div>
			</div>
			<RelatedCourses :courseName="course.data.name" />
		</div>
	</div>
</template>
<script setup>
import {
	createResource,
	Breadcrumbs,
	Badge,
	Tooltip,
	usePageMeta,
} from 'frappe-ui'
import { computed, watch } from 'vue'
import { Users, Star } from 'lucide-vue-next'
import { sessionStore } from '@/stores/session'
import CourseCardOverlay from '@/components/CourseCardOverlay.vue'
import CourseOutline from '@/components/CourseOutline.vue'
import CourseReviews from '@/components/CourseReviews.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import CourseInstructors from '@/components/CourseInstructors.vue'
import RelatedCourses from '@/components/RelatedCourses.vue'

const { brand } = sessionStore()

const props = defineProps({
	courseName: {
		type: String,
		required: true,
	},
})

const course = createResource({
	url: 'lms.lms.utils.get_course_details',
	cache: ['course', props.courseName],
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
		course.reload()
	}
)

const breadcrumbs = computed(() => {
	let items = [{ label: 'Courses', route: { name: 'Courses' } }]
	items.push({
		label: course?.data?.title,
		route: { name: 'CourseDetail', params: { courseName: course?.data?.name } },
	})
	return items
})

usePageMeta(() => {
	return {
		title: course?.data?.title,
		icon: brand.favicon,
	}
})
</script>
<style>
.avatar-group {
	display: inline-flex;
	align-items: center;
}

.avatar-group .avatar {
	transition: margin 0.1s ease-in-out;
}
</style>
