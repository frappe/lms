<template>
	<div class="grid grid-cols-1 md:grid-cols-[70%,30%] flex-1 min-h-0">
		<div class="flex flex-col overflow-hidden">
			<div class="overflow-y-auto h-full">
				<SkeletonLoader
					v-if="outline.loading && !outline.data"
					variant="editor-content"
				/>
				<div
					v-else-if="!selected"
					class="flex flex-col items-center justify-center h-full text-ink-gray-5"
				>
					<BookOpen class="size-8 stroke-1.5" />
					<div>
						{{ __('Select a lesson on the right to start editing.') }}
					</div>
				</div>
				<LessonForm
					v-else-if="mode === 'edit'"
					ref="lessonFormRef"
					:key="`edit-${selected.number}`"
					:courseName="props.course.data.name"
					:chapterNumber="selected.chapterNumber"
					:lessonNumber="selected.lessonNumber"
				/>
				<Lesson
					v-else
					ref="lessonViewRef"
					:key="`preview-${selected.number}`"
					:courseName="props.course.data.name"
					:chapterNumber="selected.chapterNumber"
					:lessonNumber="selected.lessonNumber"
					:embedded="true"
					@select-lesson="onSelectLesson"
					@lesson-completed="onLessonCompleted"
					@progress-updated="onProgressUpdated"
				/>
			</div>
		</div>

		<aside class="border-s overflow-y-auto">
			<SkeletonLoader
				v-if="outline.loading && !outline.data"
				variant="editor-sidebar"
			/>
			<StudentLessonSidebar
				v-else-if="mode === 'preview' && props.course?.data"
				:courseName="props.course.data.name"
				:courseTitle="props.course.data.title"
				:progress="progressPercent"
				:selectedLessonNumber="selected?.number"
				:completedLesson="completedLesson"
				:inlineSelect="true"
				@select-lesson="onSelectLesson"
			/>
			<CourseOutline
				v-else-if="props.course?.data"
				ref="courseOutlineRef"
				:courseName="props.course.data.name"
				:title="__('Chapters')"
				:allowEdit="true"
				:hideHeader="true"
				:inlineSelect="true"
				:selectedLessonNumber="selected?.number"
				@select-lesson="onSelectLesson"
			/>
		</aside>
	</div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createResource } from 'frappe-ui'
import { BookOpen } from 'lucide-vue-next'
import CourseOutline from '@/components/CourseOutline.vue'
import StudentLessonSidebar from '@/components/StudentLessonSidebar.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import LessonForm from '@/pages/LessonForm.vue'
import Lesson from '@/pages/Lesson.vue'

const props = defineProps({
	course: { type: Object, required: true },
})

const selected = defineModel('selected', { default: null })
const mode = defineModel('mode', { default: 'edit' })
const route = useRoute()
const router = useRouter()

// Keep ?editLesson + ?lessonMode in sync with what's selected so a refresh,
// tab-switch round-trip, or shared URL lands on the same lesson in the same
// mode. Guard against route-watcher → selected-watcher loops by comparing
// values before replacing.
function syncSelectedToUrl(number) {
	if (!number) return
	const nextLessonMode = mode.value
	if (
		route.query.editLesson === number &&
		route.query.lessonMode === nextLessonMode
	)
		return
	router.replace({
		query: { ...route.query, editLesson: number, lessonMode: nextLessonMode },
		hash: route.hash || '#course editor',
	})
}

function syncModeToUrl(newMode) {
	if (!selected.value || !newMode) return
	if (route.query.lessonMode === newMode) return
	router.replace({
		query: { ...route.query, lessonMode: newMode },
		hash: route.hash || '#course editor',
	})
}

const STORAGE_KEY = 'lms-course-editor-last-lesson'

function lessonExists(chapters, number) {
	return !!(
		number && chapters?.some((c) => c.lessons?.some((l) => l.number === number))
	)
}

function getStoredLesson(courseName) {
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw) return null
		const map = JSON.parse(raw)
		return map?.[courseName] || null
	} catch {
		return null
	}
}

function storeLesson(courseName, number) {
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		const map = raw ? JSON.parse(raw) : {}
		map[courseName] = number
		localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
	} catch {
		/* ignore */
	}
}

function setSelectedFromNumber(number) {
	const [chapterNumber, lessonNumber] = number.split('-')
	if (!chapterNumber || !lessonNumber) return
	selected.value = {
		chapterNumber,
		lessonNumber,
		number,
		title: '',
	}
	syncSelectedToUrl(number)
}

function onSelectLesson({ chapterNumber, lessonNumber }) {
	const number = `${chapterNumber}-${lessonNumber}`
	selected.value = { chapterNumber, lessonNumber, number, title: '' }
	if (props.course?.data?.name) {
		storeLesson(props.course.data.name, number)
	}
	syncSelectedToUrl(number)
}

const outline = createResource({
	url: 'lms.lms.utils.get_course_outline',
	cache: ['course_outline', props.course?.data?.name],
	makeParams() {
		return {
			course: props.course?.data?.name,
			progress: false,
		}
	},
	// auto:false — the resource fires from the course-name watcher below once
	// the parent's course.data resolves. Auto-firing on mount would call the
	// endpoint with course=undefined when CourseEditor mounts before the
	// parent's course resource has loaded.
	auto: false,
})

// Drive initial selection from outline.data instead of the resource
// onSuccess hook — that runs on every reload and skips cache hits, so a
// deep-link landing on a cached outline never set `selected`.
let initialPickDone = false
function pickInitialLesson() {
	if (initialPickDone) return
	const chapters = outline.data
	if (!chapters?.length) return
	initialPickDone = true
	const routeLesson = route.query.editLesson
	if (routeLesson) {
		setSelectedFromNumber(routeLesson)
		return
	}
	if (selected.value) return
	const courseName = props.course?.data?.name
	const stored = courseName ? getStoredLesson(courseName) : null
	if (lessonExists(chapters, stored)) {
		setSelectedFromNumber(stored)
		return
	}
	const firstLesson = chapters.find((c) => c.lessons?.length)?.lessons?.[0]
	if (firstLesson?.number) {
		setSelectedFromNumber(firstLesson.number)
	}
}

watch(() => outline.data, pickInitialLesson, { immediate: true })

watch(
	() => props.course?.data?.name,
	(name) => {
		if (name) outline.fetch()
	},
	{ immediate: true }
)

// React to a deep-link change while the editor tab is already open.
// Trust the query — a non-existent number means "new lesson", which
// LessonForm renders in create mode. Mode is its own param so clicking
// a lesson in preview keeps the user in preview.
watch(
	() => route.query.editLesson,
	(number) => {
		if (!number) return
		setSelectedFromNumber(number)
	}
)

watch(
	() => route.query.lessonMode,
	(next) => {
		if (next === 'edit' || next === 'preview') mode.value = next
	},
	{ immediate: true }
)

watch(mode, (next) => {
	syncModeToUrl(next)
})

// Live progress posted up from the embedded Lesson preview after a
// save_progress success or a realtime `update_lesson_progress` event.
// Prefer it over the stale `course.data.membership.progress` snapshot,
// which is fetched once and never refreshed in this view.
const liveProgress = ref(null)
const progressPercent = computed(() => {
	const p = liveProgress.value ?? props.course?.data?.membership?.progress
	return p ? Math.ceil(p) : 0
})

const lessonFormRef = ref(null)
const lessonViewRef = ref(null)

// Lesson name that the embedded preview just marked complete — passed to
// StudentLessonSidebar so its green tick flips immediately instead of
// only after a refetch of the outline.
const completedLesson = ref(null)
function onLessonCompleted(name) {
	completedLesson.value = name
}
function onProgressUpdated(value) {
	if (typeof value === 'number') liveProgress.value = value
}

function saveSelectedLesson() {
	lessonFormRef.value?.saveLesson?.()
}

const isDirty = computed(() => Boolean(lessonFormRef.value?.isDirty))

// Preview-mode header controls, surfaced up to CourseDetail's top bar so
// the moderator gets the same Prev / Next / Zen affordances students do.
// hasPrev/hasNext are derived from the outline (already loaded) instead of
// the embedded Lesson child — otherwise the buttons flicker out on every
// navigation while the child remounts and refetches.
const flatLessonNumbers = computed(() =>
	(outline.data ?? []).flatMap((c) => c.lessons?.map((l) => l.number) ?? [])
)
const selectedIndex = computed(() =>
	selected.value?.number
		? flatLessonNumbers.value.indexOf(selected.value.number)
		: -1
)
const hasPrev = computed(() => selectedIndex.value > 0)
const hasNext = computed(
	() =>
		selectedIndex.value >= 0 &&
		selectedIndex.value < flatLessonNumbers.value.length - 1
)
const canGoZen = computed(() => Boolean(lessonViewRef.value?.canGoZen?.()))
function previewPrev() {
	lessonViewRef.value?.switchLesson?.('prev')
}
function previewNext() {
	lessonViewRef.value?.switchLesson?.('next')
}
function previewZen() {
	lessonViewRef.value?.goFullScreen?.()
}

const courseOutlineRef = ref(null)
function openAddChapter() {
	courseOutlineRef.value?.openChapterModal?.(null)
}

defineExpose({
	saveSelectedLesson,
	isDirty,
	hasPrev,
	hasNext,
	canGoZen,
	previewPrev,
	previewNext,
	previewZen,
	openAddChapter,
})
</script>
