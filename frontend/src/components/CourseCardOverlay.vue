<template>
	<div
		class="w-full max-w-sm overflow-hidden rounded-6 border border-outline-gray-2 bg-surface-base"
	>
		<!-- Inset like the editor's card, so media and content share one edge. -->
		<VideoPreview
			class="mx-5 mt-5 !w-auto !rounded-5"
			:video-link="course.data?.video_link"
			:fallback-image="course.data?.image"
		/>
		<div class="p-5">
			<div class="text-3xl-semibold text-ink-gray-9 mb-4">
				{{ priceLabel }}
			</div>
			<div v-if="!readOnlyMode">
				<div v-if="membership" class="space-y-2 mb-8">
					<ProgressBar :progress="progress" :label="__('Course progress')" />
					<div v-if="lessonCounts.total" class="text-p-sm text-ink-gray-7">
						{{ lessonsCompletedLabel }}
					</div>
					<Button
						variant="solid"
						size="md"
						class="w-full"
						:route="{
							name: 'Lesson',
							params: {
								courseName: course.data?.name,
								chapterNumber: course?.data?.current_lesson
									? course?.data?.current_lesson.split('-')[0]
									: 1,
								lessonNumber: course?.data?.current_lesson
									? course?.data?.current_lesson.split('-')[1]
									: 1,
							},
							query: studentViewQuery(preview ?? null),
						}"
					>
						<template #prefix>
							<span class="lucide-book-text size-4" />
						</template>
						<span>
							{{ progress ? __('Continue Learning') : __('Start Learning') }}
						</span>
					</Button>
					<CertificationLinks
						v-if="!preview"
						:courseName="course.data.name"
						class="w-full"
					/>
				</div>
				<Button
					v-else-if="course.data?.paid_course && actsAsLearner"
					variant="solid"
					size="md"
					class="w-full mb-8 text-p-base-medium"
					:route="{
						name: 'Billing',
						params: { type: 'course', name: course.data.name },
						query: studentViewQuery(preview ?? null),
					}"
				>
					<template #prefix>
						<span class="lucide-credit-card size-4" />
					</template>
					<span>
						{{ __('Buy this course') }}
					</span>
				</Button>
				<Alert
					v-else-if="course.data?.disable_self_learning && actsAsLearner"
					class="mb-4"
					:icon="false"
					:description="
						__('Contact the Administrator to enroll for this course')
					"
				/>
				<Button
					v-else-if="actsAsLearner"
					:loading="enrolling"
					@click="preview ? emit('enroll') : enrollStudent()"
					variant="solid"
					class="w-full mb-8"
					size="md"
				>
					<template #prefix>
						<span class="lucide-book-text size-4" />
					</template>
					<span>
						{{ __('Enroll Now') }}
					</span>
				</Button>
				<Button
					v-if="canGetCertificate && !preview"
					:loading="certificate.loading"
					@click="fetchCertificate()"
					variant="subtle"
					class="w-full mt-2"
					size="md"
				>
					<template #prefix>
						<span class="lucide-graduation-cap size-4" />
					</template>
					{{ __('Get Certificate') }}
				</Button>
			</div>
			<CourseIncludes
				:enrollments="course.data?.enrollments"
				:lessons="course.data?.lessons"
				:quizzes="course.data?.quiz_count"
				:hasVideo="Boolean(course.data?.video_link)"
				:certificate="certificateKind"
			/>
		</div>
	</div>
</template>
<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { Alert, Button, call, createResource, toast } from 'frappe-ui'
import type { FrappeResourceError } from 'frappe-ui'
import { resourceErrorMessage } from '@/utils/resource'
import { useRouter } from 'vue-router'
import CertificationLinks from '@/components/CertificationLinks.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import VideoPreview from '@/components/VideoPreview.vue'
import CourseIncludes from '@/components/Courses/CourseIncludes.vue'
import { redirectToLogin } from '@/utils/login'
import { openExternal } from '@/utils/openExternal'
import { studentViewQuery } from '@/composables/useStudentView'
import type { CourseDetails, Resource, SessionUser } from '@/types'
import { isInstructorOf } from '@/utils/instructors'

const router = useRouter()
const user = inject<SessionUser>('$user')!
const readOnlyMode = (window as Window & { read_only_mode?: boolean })
	.read_only_mode

const props = defineProps<{
	course: Resource<CourseDetails | null>
	/** Student view: shows the card as a learner in that state would. */
	preview?: 'not-enrolled' | 'enrolled' | null
}>()

const emit = defineEmits<{ enroll: [] }>()

// The server answers a preview as a learner in that mode; an enrolled preview
// shows as enrolled while its own enrollment is still being created.
const membership = computed(() => {
	if (props.preview === 'enrolled') {
		return props.course.data?.membership ?? { progress: 0 }
	}
	return props.course.data?.membership ?? null
})

const enrolling = ref(false)

function enrollStudent() {
	if (enrolling.value) return
	if (!user.data) {
		toast.warning(__('You need to login first to enroll for this course'))
		setTimeout(() => {
			redirectToLogin()
		}, 500)
		return
	}
	const courseName = props.course.data?.name
	if (!courseName) return
	enrolling.value = true
	call('frappe.client.insert', {
		doc: {
			doctype: 'LMS Enrollment',
			course: courseName,
			member: user.data.name,
		},
	})
		.then(() => {
			toast.success(__('You have been enrolled in this course'))
			setTimeout(() => {
				router.push({
					name: 'Lesson',
					params: {
						courseName,
						chapterNumber: 1,
						lessonNumber: 1,
					},
				})
			}, 1000)
		})
		.catch((err: FrappeResourceError) => {
			// Reset only on failure: success redirects after a delay.
			enrolling.value = false
			const msg = resourceErrorMessage(err, 'Error')
			toast.warning(__(msg))
			console.error(err)
		})
}

const is_instructor = (): boolean =>
	isInstructorOf(props.course.data?.instructors, user.data?.username)

const priceLabel = computed<string>(() => {
	if (props.course.data?.paid_course) return props.course.data?.price || ''
	return __('Free')
})

const certificateKind = computed<'free' | 'paid' | null>(() => {
	if (props.course.data?.paid_certificate) return 'paid'
	return props.course.data?.enable_certification ? 'free' : null
})

const progress = computed<number>(() => membership.value?.progress ?? 0)

// The stored progress lags lesson edits, so count the outline's completed flags.
const outline = createResource({
	url: 'lms.lms.utils.get_course_outline',
	cache: [
		'course_outline_student',
		props.course.data?.name,
		'progress',
		props.preview ?? null,
	],
	makeParams() {
		return {
			course: props.course.data?.name,
			progress: true,
			student_view: props.preview ?? null,
		}
	},
}) as Resource<{ lessons?: { is_complete?: boolean }[] }[] | null>

watch(
	() => props.course.data?.membership && props.course.data.name,
	(name) => {
		if (name) outline.reload()
	},
	{ immediate: true }
)

const lessonCounts = computed(() => {
	const lessons = (outline.data || []).flatMap((c) => c.lessons || [])
	return {
		total: lessons.length,
		completed: lessons.filter((l) => l.is_complete).length,
	}
})

const lessonsCompletedLabel = computed<string>(() =>
	__('{0} of {1} lessons completed').format(
		lessonCounts.value.completed,
		lessonCounts.value.total
	)
)

const canGetCertificate = computed<boolean>(() => {
	return Boolean(
		props.course.data?.enable_certification &&
			(props.course.data?.membership?.progress ?? 0) >= 100
	)
})

const certificate = createResource({
	url: 'lms.lms.doctype.lms_certificate.lms_certificate.create_certificate',
	makeParams(values: { course?: string }) {
		return {
			course: values.course,
		}
	},
	onSuccess(data: { name: string; template: string }) {
		openExternal(
			`/api/method/frappe.utils.print_format.download_pdf?doctype=LMS+Certificate&name=${
				data.name
			}&format=${encodeURIComponent(data.template)}&no_letterhead=1`
		)
	},
}) as Resource<{ name: string; template: string } | null>

const fetchCertificate = () => {
	if (certificate.loading) return
	certificate.submit({
		course: props.course.data?.name,
		member: user.data?.name,
	})
}

const isAdmin = computed<boolean>(() => {
	return Boolean(user.data?.is_moderator) || is_instructor()
})

const actsAsLearner = computed<boolean>(
	() => Boolean(props.preview) || !isAdmin.value
)
</script>
