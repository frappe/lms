<template>
	<PageHeader :breadcrumbs="breadcrumbs" />
	<div v-if="isLocked" class="sm:border-e">
		<LockedLessonNotice
			:redirect="!!currentLessonNumber"
			@done="goToCurrentLesson()"
		/>
	</div>
	<div v-else-if="readyToRender && launchFile">
		<iframe
			:src="launchFile"
			:title="playback.data?.title || __('Lesson content')"
			class="w-full h-[calc(100vh-3.00rem)]"
		/>
	</div>
	<div v-else-if="hasNoLesson" class="text-center pt-10 px-5 md:px-0 pb-10">
		{{ __('This chapter has no lesson to play yet.') }}
	</div>
	<div v-else-if="isNotEntitled" class="text-center pt-10 px-5 md:px-0 pb-10">
		<div class="mb-4">
			{{
				__(
					'You are not enrolled in this course. Please enroll to access this lesson.'
				)
			}}
		</div>
		<Button variant="solid" @click="enrollStudent()">
			{{ __('Start Learning') }}
		</Button>
	</div>
	<div v-else-if="hasNoPackage" class="text-center pt-10 px-5 md:px-0 pb-10">
		{{ __('This lesson has no content to play yet.') }}
	</div>
</template>
<script setup>
import { Button, call, createResource, toast, usePageMeta } from 'frappe-ui'
import { computed, inject, onBeforeMount, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/Layouts/pages/PageHeader.vue'
import LockedLessonNotice from '@/components/LockedLessonNotice.vue'
import { useSidebar } from '@/stores/sidebar'
import { sessionStore } from '../stores/session'
import { safeUrl } from '@/utils/safeUrl'

const router = useRouter()
const { brand } = sessionStore()
const sidebarStore = useSidebar()
const user = inject('$user')
const readyToRender = ref(false)
const isSuccessfullyCompleted = ref(false)

// If courseRestartOnFailure is true, student has to restart the whole course if failed.
// Otherwise, student could retake the final quiz portion.
// Ideally, this should be configurable along with `Number of failures before course should restart`.
const courseRestartOnFailure = false

const props = defineProps({
	courseName: {
		type: String,
		required: true,
	},
	chapterName: {
		type: String,
		required: true,
	},
})

onBeforeMount(() => {
	sidebarStore.isSidebarCollapsed = true
	setupSCORMAPI()
})

// `launch_file` is permlevel 1, so the Course Chapter read this page used to make no
// longer carries it. The server answers instead, on the same rule that refuses the
// package bytes, so a URL arriving here is one this site will then serve.
const playback = createResource({
	url: 'lms.lms.doctype.course_chapter.course_chapter.get_scorm_playback',
	makeParams() {
		return { chapter: props.chapterName }
	},
	auto: true,
	onSuccess(data) {
		if (data?.locked) outline.fetch()
		else if (data?.launch_file) progress.submit()
	},
	// `/learn/:chapterName` also matches a lesson URL with no lesson number, so a
	// mistyped or tampered address resolves to a chapter that does not exist. Without
	// this the page renders nothing at all.
	onError() {
		leaveForCourse()
	},
})

// Four states, and only the server tells them apart: locked, not entitled, no lesson,
// playing. The page renders what it is told and derives none of them itself.
const isLocked = computed(() => !!playback.data?.locked)

// delete_lesson drops the Lesson Reference and leaves the chapter standing. The server
// refuses the package, but that refusal is not a missing enrolment: offered as one it
// asks the course's own instructor to enrol in their own course.
const hasNoLesson = computed(() => !!playback.data && !playback.data.lesson)

const isNotEntitled = computed(
	() => !!playback.data && !hasNoLesson.value && !playback.data.can_access
)

// Sanitised here rather than at the binding, so a URL the allowlist rejects falls
// through to hasNoPackage instead of mounting an iframe with no src.
const launchFile = computed(() => safeUrl(playback.data?.launch_file))

// A chapter the student may play whose package never finished uploading. Saying so
// beats the blank frame an empty iframe src leaves behind.
const hasNoPackage = computed(
	() =>
		!!playback.data &&
		!isLocked.value &&
		!hasNoLesson.value &&
		!isNotEntitled.value &&
		!launchFile.value
)

const leaveForCourse = () => {
	router.replace({
		name: 'CourseDetail',
		params: { courseName: props.courseName },
	})
}

// Fetched only on the locked branch, and only to name the lesson to resume at.
// Nothing here decides whether the package may play; the server already did.
const outline = createResource({
	url: 'lms.lms.utils.get_course_outline',
	cache: ['course_outline_student', props.courseName, 'progress'],
	makeParams() {
		return {
			course: props.courseName,
			progress: true,
		}
	},
})

const outlineLessons = computed(() =>
	(outline.data ?? []).flatMap((chapter) => chapter.lessons ?? [])
)

// The rule leaves exactly one incomplete lesson open: the one to resume at.
const currentLessonNumber = computed(
	() =>
		outlineLessons.value.find((lesson) => !lesson.locked && !lesson.is_complete)
			?.number
)

const goToCurrentLesson = () => {
	if (!currentLessonNumber.value) return
	const [chapterNumber, lessonNumber] = currentLessonNumber.value.split('-')
	router.replace({
		name: 'Lesson',
		params: {
			courseName: props.courseName,
			chapterNumber,
			lessonNumber,
		},
	})
}

// An insert and nothing else, the shape Lesson.vue enrols with. A list resource read no
// row here — get_scorm_playback says who may play — and frappe-ui refetches it on
// insert.onSuccess, so enrolling issued an unfiltered LMS Enrollment read on the way out.
const enrollment = createResource({
	url: 'frappe.client.insert',
	makeParams() {
		return {
			doc: {
				doctype: 'LMS Enrollment',
				course: props.courseName,
				member: user.data?.name,
			},
		}
	},
})

const getDataFromLMS = (key) => {
	if (key === 'cmi.core.lesson_status') {
		return progress.data?.status === 'Complete' ? 'passed' : 'incomplete'
	} else if (key === 'cmi.launch_data') {
		return progress.data?.scorm_content || ''
	} else if (key === 'cmi.suspend_data') {
		return progress.data?.scorm_content || ''
	}
	return ''
}

let saveTimeout = null
const debouncedSaveProgress = (scormDetails) => {
	if (isSuccessfullyCompleted.value) return
	clearTimeout(saveTimeout)
	saveTimeout = setTimeout(() => {
		if (!isSuccessfullyCompleted.value) saveProgress(scormDetails)
	}, 300)
}

const saveDataToLMS = (key, value) => {
	const isLessonStatus = key === 'cmi.core.lesson_status' && value === 'passed'
	const isCompletionStatus =
		key === 'cmi.completion_status' && value === 'completed'
	const shouldRestart =
		(key === 'cmi.core.lesson_status' && value === 'failed') ||
		(key === 'cmi.completion_status' && value === 'incomplete')

	if (isLessonStatus || isCompletionStatus) {
		if (isSuccessfullyCompleted.value) return
		isSuccessfullyCompleted.value = true
	}

	if (
		isLessonStatus ||
		isCompletionStatus ||
		(shouldRestart && courseRestartOnFailure)
	) {
		saveProgress({
			is_complete: isSuccessfullyCompleted.value,
			scorm_content: '',
		})
		return
	}

	if (key === 'cmi.suspend_data' && !isSuccessfullyCompleted.value) {
		debouncedSaveProgress({
			is_complete: false,
			scorm_content: value,
		})
	}
}

const saveProgress = (scormDetails = null) => {
	call('lms.lms.doctype.course_lesson.course_lesson.save_progress', {
		lesson: playback.data?.lesson,
		course: props.courseName,
		scorm_details: scormDetails,
	})
}

const progress = createResource({
	url: 'frappe.client.get_value',
	makeParams(values) {
		return {
			doctype: 'LMS Course Progress',
			fieldname: ['status', 'scorm_content'],
			filters: {
				member: user.data?.name,
				lesson: playback.data?.lesson,
				chapter: playback.data?.chapter,
				course: playback.data?.course,
			},
		}
	},
	onSuccess(data) {
		readyToRender.value = true
	},
	// The resume point is a convenience, not a gate, so a failure here must not hold the
	// frame back — without this the page had a fifth state no branch could render. It is
	// said out loud because what is lost is cmi.suspend_data: a long package restarts.
	onError() {
		readyToRender.value = true
		toast.error(__('Could not load your saved progress'), {
			description: __(
				'This lesson will start from the beginning. Reload the page to try resuming where you left off.'
			),
		})
	},
})

const enrollStudent = () => {
	enrollment.submit(
		{},
		{
			onSuccess() {
				window.location.reload()
			},
			onError(err) {
				toast.error(__(err.messages?.[0] || err))
				console.error(err)
			},
		}
	)
}

const setupSCORMAPI = () => {
	window.API_1484_11 = {
		Initialize: () => 'true',
		Terminate: () => 'true',
		GetValue: (key) => {
			console.log(`GET: ${key}`)
			return getDataFromLMS(key)
		},
		SetValue: (key, value) => {
			console.log(`SET: ${key} to value: ${value}`)

			saveDataToLMS(key, value)
			return 'true'
		},
		Commit: () => 'true',
		GetLastError: () => '0',
		GetErrorString: () => '',
		GetDiagnostic: () => '',
	}
	window.API = {
		LMSInitialize: () => 'true',
		LMSFinish: () => 'true',
		LMSGetValue: (key) => {
			console.log(`GET: ${key}`)
			return getDataFromLMS(key)
		},
		LMSSetValue: (key, value) => {
			console.log(`SET: ${key} to value: ${value}`)
			saveDataToLMS(key, value)
			return 'true'
		},
		LMSCommit: () => 'true',
		LMSGetLastError: () => '0',
		LMSGetErrorString: () => '',
		LMSGetDiagnostic: () => '',
	}
}

const breadcrumbs = computed(() => {
	return [
		{
			label: __('Courses'),
			route: { name: 'Courses' },
		},
		{
			label: playback.data?.course_title,
			route: { name: 'CourseDetail', params: { courseName: props.courseName } },
		},
		{
			label: playback.data?.title,
		},
	]
})

usePageMeta(() => {
	return {
		title: playback.data?.title,
		icon: brand.favicon,
	}
})
</script>
