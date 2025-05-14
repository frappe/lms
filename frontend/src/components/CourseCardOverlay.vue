<template>
	<div class="border-2 rounded-md min-w-80">
		<iframe
			v-if="course.data.video_link"
			:src="video_link"
			class="rounded-t-md min-h-56 w-full"
		/>
		<div class="p-5">
			<div v-if="course.data.paid_course" class="text-2xl font-semibold mb-3">
				{{ course.data.price }}
			</div>
			<div v-if="!readOnlyMode">
				<div v-if="course.data.membership" class="space-y-2">
					<router-link
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
					<CertificationLinks :courseName="course.data.name" class="w-full" />
				</div>
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
				<Badge
					v-else-if="course.data.disable_self_learning"
					theme="blue"
					size="lg"
				>
					{{ __('Contact the Administrator to enroll for this course.') }}
				</Badge>
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
						name: 'CourseForm',
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
			</div>
			<div class="space-y-4">
				<div
					class="font-medium text-ink-gray-9"
					:class="{ 'mt-8': !readOnlyMode }"
				>
					{{ __('This course has:') }}
				</div>
				<div class="flex items-center text-ink-gray-9">
					<BookOpen class="h-4 w-4 stroke-1.5" />
					<span class="ml-2">
						{{ course.data.lessons }} {{ __('Lessons') }}
					</span>
				</div>
				<div class="flex items-center text-ink-gray-9">
					<Users class="h-4 w-4 stroke-1.5" />
					<span class="ml-2">
						{{ formatAmount(course.data.enrollments) }}
						{{ __('Enrolled Students') }}
					</span>
				</div>
				<div
					v-if="parseInt(course.data.rating) > 0"
					class="flex items-center text-ink-gray-9"
				>
					<Star class="h-4 w-4 stroke-1.5 fill-orange-500 text-gray-50" />
					<span class="ml-2">
						{{ course.data.rating }} {{ __('Rating') }}
					</span>
				</div>
				<div
					v-if="course.data.enable_certification"
					class="flex items-center font-semibold text-ink-gray-9"
				>
					<GraduationCap class="h-4 w-4 stroke-2" />
					<span class="ml-2">
						{{ __('Certificate of Completion') }}
					</span>
				</div>
				<div
					v-if="course.data.paid_certificate"
					class="flex items-center font-semibold text-ink-gray-9"
				>
					<GraduationCap class="h-4 w-4 stroke-2" />
					<span class="ml-2">
						{{ __('Paid Certificate after Evaluation') }}
					</span>
				</div>
			</div>
		</div>
	</div>
</template>
<script setup>
import { BookOpen, Users, Star, GraduationCap } from 'lucide-vue-next'
import { computed, inject } from 'vue'
import { Badge, Button, createResource, toast } from 'frappe-ui'
import { formatAmount } from '@/utils/'
import { capture } from '@/telemetry'
import { useRouter } from 'vue-router'
import CertificationLinks from '@/components/CertificationLinks.vue'

const router = useRouter()
const user = inject('$user')
const readOnlyMode = window.read_only_mode

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
		toast.success(__('You need to login first to enroll for this course'))
		setTimeout(() => {
			window.location.href = `/login?redirect-to=${window.location.pathname}`
		}, 1000)
	} else {
		const enrollStudentResource = createResource({
			url: 'lms.lms.doctype.lms_enrollment.lms_enrollment.create_membership',
		})
		enrollStudentResource
			.submit({
				course: props.course.data.name,
			})
			.then(() => {
				capture('enrolled_in_course', {
					course: props.course.data.name,
				})
				toast.success(__('You have been enrolled in this course'))
				setTimeout(() => {
					router.push({
						name: 'Lesson',
						params: {
							courseName: props.course.data.name,
							chapterNumber: 1,
							lessonNumber: 1,
						},
					})
				}, 2000)
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
