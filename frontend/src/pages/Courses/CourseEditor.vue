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
					<span class="lucide-book-open size-8" />
					<div>
						{{ __('Select a lesson on the right to start editing.') }}
					</div>
				</div>
				<LessonForm
					v-else
					ref="lessonFormRef"
					:key="`edit-${selected.number}`"
					:courseName="props.course.data.name"
					:chapterNumber="selected.chapterNumber"
					:lessonNumber="selected.lessonNumber"
					@saved="onLessonSaved"
				/>
			</div>
		</div>

		<aside v-if="!isMobile" class="border-s overflow-y-auto">
			<SkeletonLoader
				v-if="outline.loading && !outline.data"
				variant="editor-sidebar"
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
				@lesson-deleted="onLessonDeleted"
				@chapter-deleted="onChapterDeleted"
			/>
		</aside>

		<BottomSheet v-if="isMobile" v-model="showChapters">
			<template #header>
				<div class="text-p-lg-semibold text-ink-gray-9">
					{{ __('Chapters') }}
				</div>
				<Button :label="__('Add chapter')" @click="openAddChapter">
					<template #icon>
						<span class="lucide-plus size-4" />
					</template>
				</Button>
			</template>
			<CourseOutline
				v-if="props.course?.data"
				ref="courseOutlineRef"
				:courseName="props.course.data.name"
				:title="__('Chapters')"
				:allowEdit="true"
				:hideHeader="true"
				:inlineSelect="true"
				:selectedLessonNumber="selected?.number"
				@select-lesson="onSelectLesson"
				@lesson-deleted="onLessonDeleted"
				@chapter-deleted="onChapterDeleted"
			/>
		</BottomSheet>

		<VideoStatistics
			v-model="showStats"
			:lessonName="statsLessonName"
			:lessonTitle="statsLessonTitle"
		/>
	</div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button, createResource } from 'frappe-ui'
import { useSidebar } from '@/stores/sidebar'
import { useScreenSize } from '@/utils/composables'
import CourseOutline from '@/components/CourseOutline.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import LessonForm from '@/pages/LessonForm.vue'
import VideoStatistics from '@/components/Modals/VideoStatistics.vue'
import {
	findLessonNameByNumber,
	lessonExistsByNumber,
	isSelectionStale,
	isLessonInChapter,
} from '@/utils/courseOutline'

const props = defineProps({
	course: { type: Object, required: true },
})

const selected = defineModel('selected', { default: null })
const route = useRoute()
const router = useRouter()
const { isMobile } = useScreenSize()
const showChapters = ref(false)

// Collapse the app sidebar while the lesson editor is open to give the
// editing surface room, then restore it on leaving the tab. Mirrors the
// student-facing Lesson.vue pattern.
const sidebarStore = useSidebar()
onMounted(() => {
	sidebarStore.isSidebarCollapsed = true
})
onBeforeUnmount(() => {
	sidebarStore.isSidebarCollapsed = false
})

// Keep ?editLesson in sync with what's selected so a refresh, tab-switch
// round-trip, or shared URL lands on the same lesson. Guard against
// route-watcher → selected-watcher loops by comparing values before
// replacing.
function syncSelectedToUrl(number) {
	if (!number) return
	if (route.query.editLesson === number) return
	router.replace({
		query: { ...route.query, editLesson: number },
		hash: route.hash || '#editor',
	})
}

const STORAGE_KEY = 'lms-course-editor-last-lesson'

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
		name: findLessonNameByNumber(outline.data, number),
		title: '',
	}
	syncSelectedToUrl(number)
}

// Reflect an autosaved lesson title/preview-flag in the shared outline
// resource. `outline` here is the same cached instance CourseOutline renders,
// so mutating it in place updates the sidebar with no extra request. A brand
// new lesson needs a reload to pull in its outline row.
function onLessonSaved({ name, title, include_in_preview, isNew }) {
	if (isNew) {
		outline.reload()
		return
	}
	for (const chapter of outline.data ?? []) {
		const lesson = chapter.lessons?.find((l) => l.name === name)
		if (lesson) {
			lesson.title = title
			lesson.include_in_preview = include_in_preview ? 1 : 0
			break
		}
	}
}

// The outline reports a specific lesson/chapter delete. If the lesson open in the
// editor is the one removed, tell the form before the stale-selection watcher
// unmounts it, so its teardown flush doesn't set_value the now-deleted document.
// Keyed by docname (not a generic "selection went stale" signal, which is also
// true on a course switch or transient outline) and applied synchronously here,
// so it can't be mis-bound to whichever reload happens to land next.
function onLessonDeleted({ lesson }) {
	if (lessonFormRef.value?.lessonName?.() === lesson) {
		lessonFormRef.value?.markDeleted?.()
	}
}
function onChapterDeleted({ chapter }) {
	// Deleting a chapter takes its lessons too. Resolve membership against the
	// still-current outline (the delete's reload hasn't applied yet).
	const openLesson = lessonFormRef.value?.lessonName?.()
	if (openLesson && isLessonInChapter(outline.data, chapter, openLesson)) {
		lessonFormRef.value?.markDeleted?.()
	}
}

function onSelectLesson({ chapterNumber, lessonNumber }) {
	const number = `${chapterNumber}-${lessonNumber}`
	selected.value = {
		chapterNumber,
		lessonNumber,
		number,
		name: findLessonNameByNumber(outline.data, number),
		title: '',
	}
	if (props.course?.data?.name) {
		storeLesson(props.course.data.name, number)
	}
	syncSelectedToUrl(number)
	// On mobile the outline lives in a sheet; dismiss it once a lesson is picked.
	showChapters.value = false
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
	// auto:false: the resource fires from the course-name watcher below once
	// the parent's course.data resolves. Auto-firing on mount would call the
	// endpoint with course=undefined when CourseEditor mounts before the
	// parent's course resource has loaded.
	auto: false,
})

// Drive initial selection from outline.data instead of the resource
// onSuccess hook, which runs on every reload and skips cache hits, so a
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
	if (lessonExistsByNumber(chapters, stored)) {
		setSelectedFromNumber(stored)
		return
	}
	const firstLesson = chapters.find((c) => c.lessons?.length)?.lessons?.[0]
	if (firstLesson?.number) {
		setSelectedFromNumber(firstLesson.number)
	}
}

watch(() => outline.data, pickInitialLesson, { immediate: true })

// When the selected lesson disappears from the outline (e.g. it was just
// deleted), drop back to the empty "choose a lesson" state instead of
// editing a lesson that no longer exists.
watch(
	() => outline.data,
	(chapters) => {
		if (isSelectionStale(selected.value, chapters)) {
			selected.value = null
			if (route.query.editLesson) {
				const { editLesson, ...rest } = route.query
				router.replace({
					query: rest,
					hash: route.hash || '#editor',
				})
			}
		}
	}
)

watch(
	() => props.course?.data?.name,
	(name) => {
		if (name) outline.fetch()
	},
	{ immediate: true }
)

// React to a deep-link change while the editor tab is already open.
// Trust the query. A non-existent number means "new lesson", which
// LessonForm renders in create mode.
watch(
	() => route.query.editLesson,
	(number) => {
		if (!number) return
		setSelectedFromNumber(number)
	}
)

// ?lessonMode is a dead param: student view used to be a mode of this editor
// and is now the lesson route. Send an old `preview` link to that route once
// a lesson number is resolvable, and strip any other value so it can't linger
// in the query that syncSelectedToUrl copies forward. One-shot: a redirect
// unmounts us, and the strip must not re-fire on its own replace.
let legacyLessonModeHandled = false
watch(
	[
		() => route.query.lessonMode,
		() => selected.value?.number,
		() => props.course?.data?.name,
	],
	([lessonMode, selectedNumber, courseName]) => {
		if (legacyLessonModeHandled || !lessonMode) return
		if (lessonMode !== 'preview') {
			legacyLessonModeHandled = true
			const { lessonMode: _dropped, ...query } = route.query
			router.replace({ query, hash: route.hash || '#editor' })
			return
		}
		const number = route.query.editLesson || selectedNumber
		if (!courseName || !number) return
		const [chapterNumber, lessonNumber] = String(number).split('-')
		if (!chapterNumber || !lessonNumber) return
		legacyLessonModeHandled = true
		router.replace({
			name: 'Lesson',
			params: { courseName, chapterNumber, lessonNumber },
			query: { studentView: 1 },
		})
	},
	{ immediate: true }
)

const lessonFormRef = ref(null)

function saveSelectedLesson() {
	lessonFormRef.value?.saveLesson?.()
}

const isDirty = computed(() => Boolean(lessonFormRef.value?.isDirty))

// The phone's lesson stepper. Derived from the outline, which is already
// loaded, rather than from the LessonForm child. Otherwise the buttons
// flicker out on every hop while the child remounts and refetches.
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
const lessonTotal = computed(() => flatLessonNumbers.value.length)
const lessonIndex = computed(() =>
	selectedIndex.value >= 0 ? selectedIndex.value + 1 : 0
)

function selectByNumber(number) {
	const [chapterNumber, lessonNumber] = number.split('-')
	onSelectLesson({ chapterNumber, lessonNumber })
}
function goPrev() {
	if (hasPrev.value)
		selectByNumber(flatLessonNumbers.value[selectedIndex.value - 1])
}
function goNext() {
	if (hasNext.value)
		selectByNumber(flatLessonNumbers.value[selectedIndex.value + 1])
}
function openChapters() {
	showChapters.value = true
}

const lessonHasVideo = computed(() =>
	Boolean(lessonFormRef.value?.lessonHasVideo?.())
)
const showStats = ref(false)
const statsLessonName = computed(() => lessonFormRef.value?.lessonName?.())
const statsLessonTitle = computed(() => lessonFormRef.value?.lessonTitle?.())
function openVideoStats() {
	showStats.value = true
}

const courseOutlineRef = ref(null)
function openAddChapter() {
	courseOutlineRef.value?.openChapterForm?.(null)
}

defineExpose({
	saveSelectedLesson,
	isDirty,
	lessonHasVideo,
	openVideoStats,
	openAddChapter,
	lessonIndex,
	lessonTotal,
	hasPrev,
	hasNext,
	goPrev,
	goNext,
	openChapters,
})
</script>
