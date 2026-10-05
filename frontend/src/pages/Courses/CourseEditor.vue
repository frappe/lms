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
					class="flex flex-col items-center justify-center h-full text-ink-gray-6"
				>
					<span class="lucide-book-open size-8" />
					<div>
						{{ __('Select a lesson on the right to start editing.') }}
					</div>
				</div>
				<LessonForm
					v-else
					ref="lessonFormRef"
					:key="`edit-${selected.formKey}`"
					:courseName="props.course.data.name"
					:chapterNumber="selected.chapterNumber"
					:lessonNumber="selected.lessonNumber"
					:draftChapter="selected.draftChapter || ''"
					@saved="onLessonSaved"
					@created="onLessonCreated"
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
				@add-lesson="onAddLesson"
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
				@add-lesson="onAddLesson"
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
	SELECTION_PARAMS,
	isLessonInChapter,
	resolveTarget,
	selectionQuery,
	targetFromQuery,
} from '@/utils/courseOutline'

const props = defineProps({
	course: { type: Object, required: true },
})

// Read-only for the parent: the open lesson is derived below.
const selectedModel = defineModel('selected', { default: null })
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

const STORAGE_KEY = 'lms-course-editor-last-lesson'

function getStoredLesson(courseName) {
	if (!courseName) return null
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
	if (!courseName) return
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		const map = raw ? JSON.parse(raw) : {}
		map[courseName] = number
		localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
	} catch {
		/* ignore */
	}
}

// What the editor is asked to open comes from the route or an action here.
// The selection is resolved from it against the outline, again on every
// outline change, so a target the outline doesn't have yet opens once it
// does. One watcher below writes the result back to the URL and the model.
let draftCount = 0
const nextDraftToken = () => `draft-${++draftCount}`
// A URL that names no lesson opens the course default: the stored lesson,
// else the first.
const targetFromRoute = () =>
	targetFromQuery(route.query, nextDraftToken) ?? { kind: 'default' }
const target = ref(targetFromRoute())

const selected = computed(() =>
	resolveTarget(
		target.value,
		outline.data,
		target.value?.kind === 'default'
			? getStoredLesson(props.course?.data?.name)
			: null
	)
)

// "Add Lesson" opens an empty form; LessonForm creates the lesson once it has a
// title.
function onAddLesson({ chapter }) {
	target.value = {
		kind: 'draft',
		chapter: chapter.name,
		token: nextDraftToken(),
	}
	showChapters.value = false
}

// The created lesson keeps the draft's token as its form key, so the form
// isn't remounted and the title keeps its focus and caret. Until the outline
// reload brings the lesson in it has no position: another author may have
// added a lesson meanwhile, so a guessed number could name theirs.
function onLessonCreated({ name, chapter }) {
	const draft = target.value
	if (draft?.kind !== 'draft' || draft.chapter !== chapter) return
	target.value = { kind: 'lesson', name, token: draft.token, chapter }
	outline.reload()
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
// editor is the one removed, tell the form before clearing the target unmounts
// it, so its teardown flush doesn't set_value the now-deleted document.
// Keyed by docname (not a generic "selection went stale" signal, which is also
// true on a course switch or transient outline) and applied synchronously here,
// so it can't be mis-bound to whichever reload happens to land next.
function onLessonDeleted({ lesson }) {
	if (lessonFormRef.value?.lessonName?.() === lesson) {
		lessonFormRef.value?.markDeleted?.()
	}
	if (selected.value?.name === lesson) target.value = null
}
function onChapterDeleted({ chapter }) {
	// Deleting a chapter takes its lessons, and a draft in it must not create
	// its lesson on unmount. Resolve membership against the still-current
	// outline (the delete's reload hasn't applied yet).
	const open = target.value
	const inChapter =
		open?.chapter === chapter ||
		isLessonInChapter(outline.data, chapter, selected.value?.name)
	if (!inChapter) return
	lessonFormRef.value?.markDeleted?.()
	target.value = null
}

function onSelectLesson({ chapterNumber, lessonNumber }) {
	target.value = { kind: 'number', number: `${chapterNumber}-${lessonNumber}` }
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

// Our own URL writes come back through the route watcher; skip those, and
// take anything else as a new target.
const ownWrites = new Set()
const selectionKey = (query) =>
	JSON.stringify(SELECTION_PARAMS.map((key) => query[key] ?? null))

function writeSelectionToUrl(next) {
	if (!next) return
	const key = selectionKey(next)
	if (key === selectionKey(route.query)) return
	ownWrites.add(key)
	const query = Object.fromEntries(
		Object.entries(route.query).filter(
			([param]) => !SELECTION_PARAMS.includes(param)
		)
	)
	router.replace({
		query: { ...query, ...next },
		hash: route.hash || '#editor',
	})
}

watch(
	() => selectionKey(route.query),
	(key) => {
		if (!ownWrites.delete(key)) target.value = targetFromRoute()
	}
)

// Pin a position or the course default to its lesson once resolved, remember
// it, and write what is open back to the model and the URL.
watch(
	selected,
	(selection) => {
		selectedModel.value = selection
		const current = target.value
		if (selection?.name && selection.number) {
			if (current?.kind === 'number' || current?.kind === 'default') {
				target.value = { kind: 'lesson', name: selection.name }
			}
			storeLesson(props.course?.data?.name, selection.number)
		}
		writeSelectionToUrl(selectionQuery(target.value, selection))
	},
	{ immediate: true }
)

watch(
	() => props.course?.data?.name,
	(name, previous) => {
		// A target belongs to its course: re-read it from the route on a switch,
		// and drop the old outline so the default can't resolve against it.
		if (previous && name !== previous) {
			outline.reset()
			target.value = targetFromRoute()
		}
		if (name) outline.fetch()
	},
	{ immediate: true }
)

// ?lessonMode is a dead param: student view used to be a mode of this editor
// and is now the lesson route. Send an old `preview` link to that route once
// a lesson number is resolvable, and strip any other value so it can't linger
// in the query that writeSelectionToUrl copies forward. One-shot: a redirect
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
