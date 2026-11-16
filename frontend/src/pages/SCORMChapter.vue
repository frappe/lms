<template>
	<PageHeader :breadcrumbs="breadcrumbs" />
	<div
		v-if="isPlaybackPending"
		class="flex items-center justify-center h-[calc(100vh-3.00rem)]"
	>
		<LoadingIndicator class="size-5 text-ink-gray-5" />
	</div>
	<div v-else-if="isLocked" class="sm:border-e">
		<LockedLessonNotice
			:redirect="!!currentLessonNumber"
			@done="goToCurrentLesson()"
		/>
	</div>
	<div v-else-if="launchFile" class="relative">
		<iframe
			ref="frame"
			:src="safeUrl(launchFile)"
			:sandbox="PACKAGE_SANDBOX"
			referrerpolicy="no-referrer"
			:title="playback.data?.title || __('Lesson content')"
			class="w-full h-[calc(100vh-3.00rem)]"
			@load="frameLoading = false"
		/>
		<!-- A large package takes a while to start; until it does the frame is empty. -->
		<div
			v-if="frameLoading"
			class="absolute inset-0 flex items-center justify-center bg-surface-base"
		>
			<LoadingIndicator class="size-5 text-ink-gray-5" />
		</div>
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
		<Button
			variant="solid"
			:loading="enrollment.loading"
			@click="enrollStudent()"
		>
			{{ __('Start Learning') }}
		</Button>
	</div>
	<div v-else-if="hasNoPackage" class="text-center pt-10 px-5 md:px-0 pb-10">
		{{ __('This lesson has no content to play yet.') }}
	</div>
</template>
<script setup>
import {
	Button,
	call,
	createResource,
	LoadingIndicator,
	toast,
	usePageMeta,
} from 'frappe-ui'
import {
	computed,
	inject,
	onBeforeMount,
	onBeforeUnmount,
	ref,
	watch,
} from 'vue'
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
	window.addEventListener('message', onPackageMessage)
})

onBeforeUnmount(() => {
	window.removeEventListener('message', onPackageMessage)
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
// Nothing to show until the server answers; an error leaves for the course instead.
const isPlaybackPending = computed(() => !playback.data && !playback.error)

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

const frameLoading = ref(true)
watch(launchFile, () => (frameLoading.value = true))

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

const enrollStudent = () => {
	if (enrollment.loading) return
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

// The package runs with an opaque origin, so it cannot reach this page or the
// session. The SCORM API lives in its own window (the server inlines it, with the
// learner's saved values) and posts here what the package sets.
const PACKAGE_SANDBOX =
	'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-pointer-lock allow-presentation'

const frame = ref(null)

const isFromPackage = (source) => {
	const packageWindow = frame.value?.contentWindow
	// A package may nest frames of its own; walk up to see whether this one sits
	// inside the player's iframe. parent is readable across origins.
	for (let win = source; win && packageWindow; win = win.parent) {
		if (win === packageWindow) return true
		if (win === win.parent) return false
	}
	return false
}

const onPackageMessage = (event) => {
	const data = event.data
	if (event.origin !== 'null' || data?.source !== 'lms-scorm') return
	if (typeof data.key !== 'string' || typeof data.value !== 'string') return
	if (!isFromPackage(event.source)) return
	saveDataToLMS(data.key, data.value)
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
