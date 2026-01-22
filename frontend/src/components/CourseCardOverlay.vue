<template>
	<div
		class="bg-white rounded-xl w-full border border-gray-100 shadow-xl shadow-gray-100 p-5 lg:sticky lg:top-14"
	>
		<div class="rounded-lg aspect-video w-full relative overflow-hidden">
			<iframe
				v-if="course.data.video_link"
				:src="video_link"
				class="w-full h-full"
			/>
			<div
				v-else
				class="bg-cover bg-center rounded-md w-full h-full"
				:class="{ 'default-image': !course.data.image }"
				:style="{
					backgroundImage: 'url(\'' + encodeURI(course.data.image) + '\')',
				}"
			></div>
			<Badge
				v-if="course.data.enable_certification"
				theme="green"
				size="lg"
				class="absolute top-3 left-3 bg-teal-500 text-white font-medium text-sm"
			>
				{{ __('Certification') }}
			</Badge>
		</div>

		<div class="py-4 space-y-4">
			<h1 class="text-lg font-semibold text-ink-gray-9 leading-tight">
				{{ course.data.title }}
			</h1>

			<div v-if="!course.data.paid_course" class="text-xl font-semibold mb-3">
				{{ course.data.price }}
			</div>

			<div class="space-y-2 text-sm text-ink-gray-9">
				<div class="flex items-center">
					<BookIcon class="size-5 mr-2 stroke-1.5" />
					<span class="font-medium text-base">
						{{ course.data.lessons }}
					</span>
					<span class="text-ink-gray-5 ml-1">{{ __('Lessons') }}</span>
				</div>
				<div class="flex items-center text-ink-gray-9">
					<PeopleIcon class="size-5 mr-2 stroke-1.5" />
					<span class="font-medium text-base">{{
						formatAmount(course.data.enrollments)
					}}</span>
					<span class="text-ink-gray-5 ml-1">{{
						__('Enrolled Students')
					}}</span>
				</div>
				<div class="flex items-center text-ink-gray-9">
					<Star
						class="size-5 mr-2 stroke-1 fill-warning-500 text-warning-500"
					/>
					<span class="font-medium text-base">
						{{
							course.data.rating
								? parseFloat(course.data.rating).toFixed(1)
								: '0.0'
						}}
					</span>
					<span class="text-ink-gray-5 ml-1"
						>({{ course.data.review_total || 0 }} reviews)</span
					>
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
			<div class="space-y-3 mt-2">
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

				<div v-if="user && course.data.membership">
					<div class="flex items-center justify-between text-sm mb-1">
						<span class="text-md text-gray-600">Course progress</span>
						<span class="text-md text-gray-600"
							>{{ Math.ceil(course.data.membership.progress) }}%</span
						>
					</div>

					<ProgressBar :progress="course.data.membership.progress" />
				</div>
			</div>

			<div v-if="!readOnlyMode" class="space-y-2 !mt-20">
				<Button
					v-if="user.data?.is_moderator || is_instructor()"
					class="w-full"
					variant="subtle"
					size="md"
					@click="showProgressSummary"
				>
					<span>
						{{ __('Progress Summary') }}
					</span>
				</Button>
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
						<template #prefix>
							<CreditCard class="size-4 stroke-1.5" />
						</template>
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
					v-else-if="!user.data?.is_moderator && !is_instructor()"
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
					variant="outline"
					class="w-full mt-2"
					size="md"
				>
					{{ __('View Certificate') }}
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
					<Button variant="outline" class="w-full mt-2" size="md">
						<span>
							{{ __('Edit') }}
						</span>
					</Button>
				</router-link>
			</div>
		</div>
	</div>
	<CourseProgressSummary
		v-if="user.data?.is_moderator || is_instructor()"
		v-model="showProgressModal"
		:courseName="course.data.name"
		:enrollments="course.data.enrollments"
	/>
</template>
<script setup>
import {
	BookOpen,
	BookText,
	CreditCard,
	GraduationCap,
	Pencil,
	Star,
	TrendingUp,
	Users,
} from 'lucide-vue-next'
import { computed, inject, ref } from 'vue'
import { Badge, call, createResource, toast } from 'frappe-ui'
import { formatAmount } from '@/utils/'
import { capture } from '@/telemetry'
import { useRouter } from 'vue-router'
import CertificationLinks from '@/components/CertificationLinks.vue'
import CourseProgressSummary from '@/components/Modals/CourseProgressSummary.vue'
import Button from '@/components/ui/Button.vue'
import BookIcon from './Icons/BookIcon.vue'
import PeopleIcon from './Icons/PeopleIcon.vue'
const router = useRouter()
const user = inject('$user')
const showProgressModal = ref(false)
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
		}, 500)
	} else {
		call('lms.lms.doctype.lms_enrollment.lms_enrollment.create_membership', {
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
				}, 1000)
			})
			.catch((err) => {
				toast.warning(__(err.messages?.[0] || err))
				console.error(err)
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
			'_blank',
		)
	},
})

const fetchCertificate = () => {
	certificate.submit({
		course: props.course.data?.name,
		member: user.data?.name,
	})
}

const showProgressSummary = () => {
	showProgressModal.value = true
}
</script>
