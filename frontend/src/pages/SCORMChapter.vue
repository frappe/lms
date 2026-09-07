<template>
	<PageHeader :breadcrumbs="breadcrumbs" />
	<div v-if="isLocked" class="sm:border-e">
		<LockedLessonNotice
			:redirect="!!currentLessonNumber"
			@done="goToCurrentLesson()"
		/>
	</div>
	<div
		v-else-if="
			readyToRender &&
			outlineSettled &&
			(enrollment.data?.length ||
				user.data?.is_moderator ||
				user.data?.is_instructor)
		"
	>
		<iframe
			:src="safeUrl(chapter.doc.launch_file)"
			:title="chapter.doc?.title || __('Lesson content')"
			class="w-full h-[calc(100vh-3.00rem)]"
		/>
	</div>
	<div v-else-if="!enrollment.data?.length">
		<div class="text-center pt-10 px-5 md:px-0 pb-10">
			<div class="text-center">
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
		</div>
	</div>
</template>
<script setup>
import {
	Button,
	call,
	createDocumentResource,
	createListResource,
	createResource,
	usePageMeta,
} from 'frappe-ui'
import { computed, inject, onBeforeMount, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/Layouts/PageHeader.vue'
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

const chapter = createDocumentResource({
	doctype: 'Course Chapter',
	name: props.chapterName,
	auto: true,
	cache: ['chapter', props.chapterName],
	onSuccess(data) {
		progress.submit()
	},
	// `/learn/:chapterName` also matches a lesson URL with no lesson number, so a
	// mistyped or tampered address resolves to a chapter that does not exist. Without
	// this the page renders nothing at all.
	onError() {
		leaveForCourse()
	},
})

const leaveForCourse = () => {
	router.replace({
		name: 'CourseDetail',
		params: { courseName: props.courseName },
	})
}

// This page reads the Course Chapter doc straight from the DB and iframes its
// launch file; it never calls get_lesson, so without the outline it is a route
// around the sequential-completion gate. The server refuses the SCORM bytes
// either way (SCORMRenderer._check_permission), this turns that refusal into the
// same locked treatment the lesson page shows.
const outline = createResource({
	url: 'lms.lms.utils.get_course_outline',
	cache: ['course_outline_student', props.courseName, 'progress'],
	makeParams() {
		return {
			course: props.courseName,
			progress: true,
		}
	},
	auto: true,
})

const outlineLessons = computed(() =>
	(outline.data ?? []).flatMap((chapter) => chapter.lessons ?? [])
)

// The chapter doc and its progress resolve on a chain of their own, so without
// this the iframe can mount before the outline has said whether the chapter is
// locked — and the student reads the server's 403 page for the package before the
// locked notice replaces it. An outline that errors still settles: the bytes are
// refused server side either way, and waiting forever would leave a blank page.
const outlineSettled = computed(
	() => Array.isArray(outline.data) || !!outline.error
)

const isLocked = computed(() => {
	const chapter = (outline.data ?? []).find(
		(item) => item.name === props.chapterName
	)
	const lessons = chapter?.lessons ?? []
	return lessons.length > 0 && lessons.every((lesson) => lesson.locked)
})

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

const enrollment = createListResource({
	doctype: 'LMS Enrollment',
	fields: ['member', 'course'],
	filters: {
		course: props.courseName,
		member: user.data?.name,
	},
	auto: true,
	cache: ['enrollments', props.courseName, user.data?.name],
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
		lesson: chapter.doc.lessons[0].lesson,
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
				lesson: chapter.doc.lessons[0].lesson,
				chapter: chapter.doc.name,
				course: chapter.doc?.course,
			},
		}
	},
	onSuccess(data) {
		readyToRender.value = true
	},
})

const enrollStudent = () => {
	enrollment.insert.submit(
		{
			course: props.courseName,
			member: user.data?.name,
		},
		{
			onSuccess(data) {
				window.location.reload()
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
			label: chapter.doc?.course_title,
			route: { name: 'CourseDetail', params: { courseName: props.courseName } },
		},
		{
			label: chapter.doc?.title,
		},
	]
})

usePageMeta(() => {
	return {
		title: chapter.doc?.title,
		icon: brand.favicon,
	}
})
</script>
