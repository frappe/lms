<template>
	<div v-if="course.data">
		<header
			class="sticky top-0 z-10 flex items-center justify-between bg-surface-white px-3 py-2.5 sm:px-5"
		>
			<CustomBreadcrumb :items="breadcrumbs" />
		</header>
		<div class="m-5">
			<div class="flex w-full gap-5 flex-col lg:flex-row">
				<div class="lg:w-96 flex-shrink-0">
					<CourseCardOverlay :course="course" />
				</div>
				<div class="flex-1 min-w-0">
					<div class="border-b mb-6">
						<nav class="flex space-x-8">
							<button
								@click="activeTab = 'overview'"
								:class="[
									'pb-3 text-center px-2 border-b-[3px] font-medium transition-colors min-w-40',
									activeTab === 'overview'
										? 'border-primary-500 text-primary-600'
										: 'border-transparent text-ink-gray-5 hover:text-ink-gray-7',
								]"
							>
								{{ __('Overview') }}
							</button>
							<button
								@click="activeTab = 'review'"
								:class="[
									'pb-3 text-center px-2 border-b-[3px] font-medium transition-colors min-w-40',
									activeTab === 'review'
										? 'border-primary-500 text-primary-600'
										: 'border-transparent text-ink-gray-5 hover:text-ink-gray-7',
								]"
							>
								{{ __('Review') }}
							</button>
						</nav>
					</div>
					<section v-show="activeTab === 'overview'" class="space-y-2">
						<!-- <h2 class="text-xl font-semibold text-ink-gray-9 mb-1">
							{{ __('Tentang Kursus') }}
						</h2> -->
						<div
							class="my-3 leading-6 text-ink-gray-7 text-justify"
							:hidden="true"
						>
							{{ course.data.short_introduction }}
						</div>
						<div
							v-html="course.data.description"
							class="ProseMirror text-justify prose prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-outline-gray-2 prose-th:border-outline-gray-2 prose-td:relative prose-th:relative prose-th:bg-surface-gray-2 prose-sm max-w-none !whitespace-normal"
						></div>
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
						<div class="mt-10">
							<CourseOutline
								:title="__('Course Outline')"
								:courseName="course.data.name"
								:showOutline="true"
								:getProgress="course.data.membership ? true : false"
							/>
						</div>
					</section>
					<section v-show="activeTab === 'review'" class="">
						<CourseReviews
							:courseName="course.data.name"
							:avg_rating="course.data.rating"
							:membership="course.data.membership"
						/>
					</section>
				</div>
			</div>
			<RelatedCourses :courseName="course.data.name" />
		</div>
	</div>
</template>
<script setup>
import { createResource, Badge, Tooltip, usePageMeta } from 'frappe-ui'
import { computed, inject, ref, watch } from 'vue'
import { Users, Star } from 'lucide-vue-next'
import { sessionStore } from '@/stores/session'
import { useRouter } from 'vue-router'
import CourseCardOverlay from '@/components/CourseCardOverlay.vue'
import CourseOutline from '@/components/CourseOutline.vue'
import CourseReviews from '@/components/CourseReviews.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import CourseInstructors from '@/components/CourseInstructors.vue'
import RelatedCourses from '@/components/RelatedCourses.vue'
import CustomBreadcrumb from '@/components/ui/CustomBreadcrumb.vue'

const { brand } = sessionStore()
const router = useRouter()
const user = inject('$user')
const activeTab = ref('overview')

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
	},
)

watch(course, () => {
	if (
		!isInstructor() &&
		!user.data?.is_moderator &&
		!course.data?.published &&
		!course.data?.upcoming
	) {
		router.push({
			name: 'Courses',
		})
	}
})

const isInstructor = () => {
	let user_is_instructor = false
	course.data?.instructors.forEach((instructor) => {
		if (!user_is_instructor && instructor.name == user.data?.name) {
			user_is_instructor = true
		}
	})
	return user_is_instructor
}

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
