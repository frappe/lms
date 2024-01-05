<template>
	<div class="shadow rounded-md" style="width: 300px">
		<iframe
			v-if="course.data.video_link"
			:src="video_link"
			class="rounded-t-md"
		/>
		<div class="p-5">
			<router-link
				v-if="course.data.membership"
				:to="{
					name: 'Lesson',
					params: {
						courseName: course.name,
						chapterNumber: course.data.current_lesson
							? course.data.current_lesson.split('.')[0]
							: 1,
						lessonNumber: course.data.current_lesson
							? course.data.current_lesson.split('.')[1]
							: 1,
					},
				}"
			>
				<Button variant="solid" class="w-full mb-3">
					<span>
						{{ __('Continue Learning') }}
					</span>
				</Button>
			</router-link>
			<Button
				v-else
				@click="enrollStudent()"
				variant="solid"
				class="w-full mb-3"
			>
				<span>
					{{ __('Start Learning') }}
				</span>
			</Button>
			<Button
				v-if="user?.data?.is_moderator"
				variant="subtle"
				class="w-full mb-3"
			>
				<span>
					{{ __('Edit') }}
				</span>
			</Button>
			<div class="flex items-center mb-3">
				<Users class="h-4 w-4 text-gray-700" />
				<span class="ml-1">
					{{ course.data.enrollment_count_formatted }} {{ __('Enrolled') }}
				</span>
			</div>
			<div class="flex items-center mb-3">
				<BookOpen class="h-4 w-4 text-gray-700" />
				<span class="ml-1">
					{{ course.data.lesson_count }} {{ __('Lessons') }}
				</span>
			</div>
			<div class="flex items-center">
				<Star class="h-4 w-4 fill-orange-500 text-gray-100" />
				<span class="ml-1">
					{{ course.data.avg_rating }} {{ __('Rating') }}
				</span>
			</div>
		</div>
	</div>
</template>
<script setup>
import { BookOpen, Users, Star } from 'lucide-vue-next'
import { computed, inject } from 'vue'
import { Button, createResource } from 'frappe-ui'
import { createToast } from '@/utils/'
import { useRouter } from 'vue-router'
const router = useRouter()

const user = inject('$user')

const props = defineProps({
	course: {
		type: Object,
		default: null,
	},
})

const video_link = computed(() => {
	if (props.course.data.video_link) {
		return 'https://www.youtube.com/embed/' + props.course.data.video_link
	}
	return null
})

function enrollStudent() {
	if (!user.data) {
		createToast({
			title: 'Please Login',
			icon: 'alert-circle',
			iconClasses: 'text-yellow-600 bg-yellow-100',
		})
		setTimeout(() => {
			window.location.href = `/login?redirect-to=${window.location.pathname}`
		}, 3000)
	} else {
		const enrollStudentResource = createResource({
			url: 'lms.lms.doctype.lms_enrollment.lms_enrollment.create_membership',
		})
		console.log(props.course)
		enrollStudentResource
			.submit({
				course: props.course.data.name,
			})
			.then(() => {
				createToast({
					title: 'Enrolled Successfully',
					icon: 'check',
					iconClasses: 'text-green-600 bg-green-100',
				})
				setTimeout(() => {
					router.push({
						name: 'Lesson',
						params: {
							courseName: props.course.data.name,
							chapterNumber: 1,
							lessonNumber: 1,
						},
					})
				}, 3000)
			})
	}
}
</script>
