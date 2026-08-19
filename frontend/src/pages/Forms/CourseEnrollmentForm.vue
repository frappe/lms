<template>
	<FormShell :title="__('Enroll a Student')" size="xl" @close="close">
		<template #default>
			<div v-if="loadingCourse" class="p-4 text-base text-ink-gray-6">
				{{ __('Loading...') }}
			</div>
			<div v-else-if="refusal" class="p-4 text-base text-ink-gray-6">
				{{ refusal }}
			</div>
			<div v-else data-testid="course-enrollment-fields" class="space-y-4">
				<FormControl
					type="checkbox"
					:label="__('Purchased Certificate')"
					v-model="purchasedCertificate"
				/>
				<Link
					doctype="User"
					:label="__('Student')"
					placeholder=" "
					v-model="student"
					:required="true"
					:onCreate="openMemberSettings"
				/>
				<Link
					v-if="purchasedCertificate"
					doctype="LMS Payment"
					:label="__('Payment')"
					placeholder=" "
					v-model="payment"
					:onCreate="openPaymentSettings"
				/>
			</div>
		</template>
		<template #actions>
			<div
				v-if="!refusal && !loadingCourse"
				class="flex items-center justify-end"
			>
				<HeaderButton
					data-testid="course-enrollment-save"
					:label="__('Save')"
					variant="solid"
					:loading="enrollment.loading"
					@click="enrollStudent()"
				/>
			</div>
		</template>
	</FormShell>
</template>
<script setup lang="ts">
import {
	createResource,
	FormControl,
	getCachedListResource,
	toast,
} from 'frappe-ui'
import { computed, inject, ref } from 'vue'
import { useRoute } from 'vue-router'
import { openSettings } from '@/utils'
import Link from '@/components/Controls/Link.vue'
import FormShell from '@/components/FormShell.vue'
import HeaderButton from '@/components/HeaderButton.vue'
import { useFormRoute } from '@/composables/useFormRoute'
import type {
	CourseDetails,
	CourseInstructorInfo,
	Resource,
	SessionUser,
} from '@/types'
import { resourceErrorMessage, submitResource } from '@/utils/resource'

const props = defineProps<{
	courseName: string
}>()

const user = inject<SessionUser>('$user')!
const route = useRoute()
const readOnlyMode = (window as Window & { read_only_mode?: boolean })
	.read_only_mode

const student = ref<string | null>(null)
const payment = ref<string | null>(null)
const purchasedCertificate = ref<boolean>(false)

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
const { close, saveAndReplace } = useFormRoute(parent)

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
	(course.data?.instructors ?? []).some(
		(instructor: CourseInstructorInfo) => instructor.name === user.data?.name
	)
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

// This form's own insert. The modal reached the dashboard's list resource
// through `:students` and reloaded it directly; a routed page has no parent to
// receive that from, and a deep link has no dashboard tab mounted at all.
// A plain createResource rather than a list resource, so a save does not also
// fire frappe-ui's unfiltered follow-up list fetch.
const enrollment = createResource({
	url: 'frappe.client.insert',
	makeParams() {
		return {
			doc: {
				doctype: 'LMS Enrollment',
				course: props.courseName,
				member: student.value,
				payment: purchasedCertificate.value ? payment.value : null,
				purchased_certificate: purchasedCertificate.value,
			},
		}
	},
}) as unknown as Resource<unknown>

// The list this page inserted into lives on the tab behind it. Null on a deep
// link, where that tab was never mounted — correct, since it fetches on mount.
const reloadStudents = () => {
	getCachedListResource(['courseProgress', props.courseName])?.reload()
}

// Link calls these with one argument unless it is in `inlineCreate` mode, which
// neither field is — it closes its own dropdown first, so there is no second
// close callback to invoke here.
//
// Leaving the form to open Settings is the modal's behaviour kept intact: the
// settings drawer would otherwise sit under a full-screen form on a phone.
const openMemberSettings = () => {
	if (openSettings('Members')) close()
}

const openPaymentSettings = () => {
	if (openSettings('Transactions')) close()
}

const validateData = (): boolean => {
	if (!student.value) {
		toast.error(__('Please select a student to enroll.'))
		return false
	}
	if (purchasedCertificate.value && !payment.value) {
		toast.error(__('Please select a payment for the purchased certificate.'))
		return false
	}
	return true
}

const enrollStudent = () => {
	if (refusal.value) return
	if (!validateData()) return
	submitResource(
		enrollment,
		{},
		{
			onSuccess() {
				reloadStudents()
				toast.success(__('Student enrolled successfully'))
				saveAndReplace(parent)
			},
			onError(err: unknown) {
				toast.error(resourceErrorMessage(err, __('Error')))
			},
		}
	)
}
</script>
