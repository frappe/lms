<template>
	<EnrollStudentsForm
		:target="target"
		:refusal="refusal"
		:loading="loadingCourse"
		@close="close"
		@enrolled="onEnrolled"
	/>
</template>
<script setup lang="ts">
import { createResource, getCachedListResource } from 'frappe-ui'
import { computed, inject } from 'vue'
import { useRoute } from 'vue-router'
import EnrollStudentsForm from '@/components/Enrollment/EnrollStudentsForm.vue'
import { paidKindForCourse } from '@/components/Enrollment/enrollment'
import { useFormRoute } from '@/composables/useFormRoute'
import type {
	BulkEnrollResult,
	CourseDetails,
	EnrollTarget,
	Resource,
	SessionUser,
} from '@/types'
import { isInstructorOf } from '@/utils/instructors'

const props = defineProps<{
	courseName: string
}>()

const user = inject<SessionUser>('$user')!
const route = useRoute()
const readOnlyMode = (window as Window & { read_only_mode?: boolean })
	.read_only_mode

// The course page keeps its active tab in route.hash and CourseEditor keeps the
// open lesson in route.query, so both have to travel back with us — closing to a
// hash-less CourseDetail would flip the parent to tab 0 behind the form. Same
// reasoning as ChapterForm.vue, the other form this page hosts.
const parent = {
	name: 'CourseDetail',
	params: { courseName: props.courseName },
	hash: route.hash,
	query: { ...route.query },
}
const { close } = useFormRoute(parent)

// Parent context a URL cannot carry: the Enroll button only existed on the
// Dashboard tab, which CourseDetail shows to moderators and to the course's own
// instructors — and instructor-ness is a walk over course.data.instructors.
//
// Its own fetch, NOT CourseDetail's instance: that resource deliberately carries
// no cache key (CourseDetail.vue), because the router reuses the page when you
// jump straight from one course to another, so getCachedResource has nothing to
// hand back and adding a key to get one would reintroduce that bug.
const course = createResource({
	url: 'lms.lms.utils.get_course_details',
	makeParams() {
		return { course: props.courseName }
	},
	auto: true,
}) as unknown as Resource<CourseDetails | null>

const loadingCourse = computed(() => !course.data && course.loading)

const isInstructor = computed(() =>
	isInstructorOf(course.data?.instructors, user.data?.username)
)

// Copied from CourseDetail.vue's isAdmin(), which gated the Dashboard tab the
// Enroll button lived on. A URL does not go through a button.
//
// UX gate, not an authorization boundary — LMS Enrollment's before_insert hooks
// are, and enforce_server_managed_fields reverts purchased_certificate for
// anyone not entitled to set it.
const refusal = computed(() => {
	if (readOnlyMode) return __('This site is in read-only mode.')
	if (!user.data?.is_moderator && !isInstructor.value)
		return __('You do not have permission to enroll students in this course.')
	return ''
})

const target = computed<EnrollTarget | null>(() => {
	const details = course.data
	if (!details?.name) return null
	return {
		doctype: 'LMS Course',
		name: props.courseName,
		paidKind: paidKindForCourse(details),
		priceLabel: details.price ?? null,
	}
})

// The list the enrollments land in lives on the tab behind this form. Null on a deep
// link, where that tab was never mounted — correct, since it fetches on mount.
const reloadStudents = () => {
	getCachedListResource(['courseProgress', props.courseName])?.reload()
}

// The dashboard's Enrolled stat reads CourseDetail's course resource, which has
// no cache key (see above), so CourseDetail hands its reload down instead.
// Null on a deep link outside CourseDetail.
const reloadCourseDetails = inject<(() => void) | null>(
	'reloadCourseDetails',
	null
)

const onEnrolled = (result: BulkEnrollResult) => {
	reloadStudents()
	if (result.added.length) reloadCourseDetails?.()
}
</script>
