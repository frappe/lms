<template>
	<div class="shadow rounded-md min-w-80">
		<iframe
			v-if="course.data.video_link"
			:src="video_link"
			class="rounded-t-md min-h-56 w-full"
		/>
		<div class="p-5">
			<div v-if="course.data.price" class="text-2xl font-semibold mb-3">
				{{ course.data.price }}
			</div>
			<router-link
				v-if="course.data.membership"
				:to="{
					name: 'Lesson',
					params: {
						courseName: course.name,
						chapterNumber: course.data.current_lesson
							? course.data.current_lesson.split('-')[0]
							: 1,
						lessonNumber: course.data.current_lesson
							? course.data.current_lesson.split('-')[1]
							: 1,
					},
				}"
			>
				<Button variant="solid" size="md" class="w-full">
					<span>
						{{ __('Continue Learning') }}
					</span>
				</Button>
			</router-link>
			<router-link
				v-else-if="course.data.paid_course"
				:to="{
					name: 'Billing',
					params: {
						type: 'course',
						name: course.data.name,
					},
				}"
			>
				<Button variant="solid" size="md" class="w-full">
					<span>
						{{ __('Buy this course') }}
					</span>
				</Button>
			</router-link>
			<div
				v-else-if="course.data.disable_self_learning"
				class="bg-blue-100 text-blue-900 text-sm rounded-md py-1 px-3"
			>
				{{ __('Contact the Administrator to enroll for this course.') }}
			</div>
			<Button
				v-else
				@click="enrollStudent()"
				variant="solid"
				class="w-full"
				size="md"
			>
				<span>
					{{ __('Start Learning') }}
				</span>
			</Button>
			<Button
				v-if="canGetCertificate"
				@click="fetchCertificate()"
				variant="subtle"
				class="w-full mt-2"
				size="md"
			>
				{{ __('Get Certificate') }}
			</Button>
			<router-link
				v-if="user?.data?.is_moderator || is_instructor()"
				:to="{
					name: 'CreateCourse',
					params: {
						courseName: course.data.name,
					},
				}"
			>
				<Button variant="subtle" class="w-full mt-2" size="md">
					<span>
						{{ __('Edit') }}
					</span>
				</Button>
			</router-link>
			<div class="mt-8 mb-4 font-medium">
				{{ __('This course has:') }}
			</div>
			<div class="flex items-center mb-3">
				<BookOpen class="h-5 w-5 stroke-1.5 text-gray-600" />
				<span class="ml-2">
					{{ course.data.lesson_count }} {{ __('Lessons') }}
				</span>
			</div>
			<div class="flex items-center mb-3">
				<Users class="h-5 w-5 stroke-1.5 text-gray-600" />
				<span class="ml-2">
					{{ course.data.enrollment_count_formatted }}
					{{ __('Enrolled Students') }}
				</span>
			</div>
			<div class="flex items-center">
				<Star class="h-5 w-5 stroke-1.5 fill-orange-500 text-gray-50" />
				<span class="ml-2">
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
		}, 2000)
	} else {
		const enrollStudentResource = createResource({
			url: 'lms.lms.doctype.lms_enrollment.lms_enrollment.create_membership',
		})
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

const is_instructor = () => {
	let user_is_instructor = false
	props.course.data.instructors.forEach((instructor) => {
		if (!user_is_instructor && instructor.name == user.data?.name) {
			user_is_instructor = true
		}
	})
	return user_is_instructor
}

const canGetCertificate = computed(() => {
	if (
		props.course.data?.enable_certification &&
		props.course.data?.membership?.progress == 100
	) {
		return true
	}
	return false
})

const certificate = createResource({
	url: 'lms.lms.doctype.lms_certificate.lms_certificate.create_certificate',
	makeParams(values) {
		return {
			course: values.course,
		}
	},
	onSuccess(data) {
		console.log(data)
		window.open(
			`/api/method/frappe.utils.print_format.download_pdf?doctype=LMS+Certificate&name=${
				data.name
			}&format=${encodeURIComponent(data.template)}`,
			'_blank'
		)
	},
})

const fetchCertificate = () => {
	certificate.submit({
		course: props.course.data?.name,
		member: user.data?.name,
	})
}
</script>
