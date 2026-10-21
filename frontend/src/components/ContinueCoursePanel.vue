<template>
	<!--
		z-[1]: dialogLayering stacks dialogs from z-index 2 up, so the panel
		stays above the page (an isolated layer) and below any open dialog.
	-->
	<aside
		v-if="course"
		:aria-label="__('Continue your course')"
		class="fixed z-[1] w-80 rounded-6 border bg-surface-base p-4 text-base text-ink-gray-9 shadow-sm"
		:class="[
			besideHelp ? 'end-[22.25rem]' : 'end-5',
			// Clear the tab bar the mobile layout keeps at the bottom.
			isMobile ? 'bottom-20' : 'bottom-5',
		]"
	>
		<div class="flex items-center justify-between gap-2">
			<div class="flex items-center gap-2 font-medium">
				<span
					class="lucide-book-open size-4 text-ink-gray-7"
					aria-hidden="true"
				/>
				<span>{{ __('Continue your course') }}</span>
			</div>
			<Button
				variant="ghost"
				size="sm"
				:aria-label="__('Close')"
				@click="close"
			>
				<template #icon>
					<span class="lucide-x size-4" />
				</template>
			</Button>
		</div>

		<div class="mt-3 min-w-0">
			<div class="truncate font-medium">{{ course.title }}</div>
			<div class="text-sm text-ink-gray-6">
				{{ __('Unpublished') }} · {{ editedLabel }}
			</div>
		</div>

		<div class="mt-3">
			<ProgressBar
				:progress="(doneCount / course.steps.length) * 100"
				:label="__('Steps to publish')"
			/>
			<div class="mt-1.5 text-sm text-ink-gray-6">
				{{ stepsLabel }}
			</div>
		</div>

		<ul class="mt-3 space-y-1.5 text-sm">
			<li
				v-for="step in steps"
				:key="step.name"
				class="flex items-center gap-2"
			>
				<template v-if="step.done">
					<span
						class="lucide-circle-check size-4 text-ink-gray-5"
						aria-hidden="true"
					/>
					<span class="text-ink-gray-6">{{ step.label }}</span>
				</template>
				<button
					v-else
					type="button"
					class="flex items-center gap-2 rounded text-ink-gray-9 hover:underline focus:outline-none focus:focus-ring"
					@click="goTo(step)"
				>
					<span
						class="lucide-circle size-4 text-ink-gray-4"
						aria-hidden="true"
					/>
					<span>{{ step.label }}</span>
				</button>
			</li>
		</ul>

		<div class="mt-4">
			<Button variant="subtle" :label="__('Continue editing')" @click="open" />
		</div>
	</aside>
</template>

<script setup lang="ts">
import { Button, createResource } from 'frappe-ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTelemetry } from '@framework/ui/telemetry/index'
import { serverTime } from '@/utils/dayjs'
import { useScreenSize } from '@/utils/composables'
import { continuePanelClosedKey } from '@/utils/continuePanel'
import ProgressBar from '@/components/ProgressBar.vue'

type Step = { name: 'chapter' | 'lesson' | 'publish'; done: boolean }
type CourseToContinue = {
	course: string
	title: string
	last_edited: string
	lesson: string | null
	steps: Step[]
}
// `done` is the server saying the site has a published course of its own:
// nothing to show, now or later in this session.
type Answer = CourseToContinue | { done: true } | null

const props = defineProps<{
	// The signed-in user. The closed flag is kept per user, since a shared
	// tab outlives a sign-out.
	user: string
	// The Getting started help panel sits in the same corner. When it is open
	// this panel moves beside it instead of under it.
	besideHelp?: boolean
}>()

const route = useRoute()
const router = useRouter()
const { capture } = useTelemetry()
const { isMobile } = useScreenSize()

const STEP_LABELS: Record<Step['name'], string> = {
	chapter: __('Add a chapter'),
	lesson: __('Add a lesson with content'),
	publish: __('Publish the course'),
}

// Closing hides the panel until the next sign-in: sessionStorage ends with
// the browser session, so a draft left for days comes back on the next visit,
// and the sign-out clears the flag for a sign-in in the same tab.
const closedKey = continuePanelClosedKey(props.user)
const closed = ref(readClosed())

function readClosed(): boolean {
	try {
		return sessionStorage.getItem(closedKey) === '1'
	} catch {
		return false
	}
}

const settled = ref(false)
const toContinue = createResource({
	url: 'lms.lms.api.get_course_to_continue',
	auto: true,
	onSuccess(data: Answer) {
		if (data && 'done' in data) settled.value = true
	},
}) as { data: Answer; loading: boolean; reload: () => void }

// Adding a chapter or lesson, or publishing, changes what the panel says, and
// every one of those ends in a navigation. One light call per route change
// keeps it right without wiring into each editor. A change that lands while a
// call is out is not dropped: it runs once that call is back.
let reloadPending = false
function refresh() {
	if (settled.value) return
	if (toContinue.loading) {
		reloadPending = true
		return
	}
	toContinue.reload()
}
watch(() => route.fullPath, refresh)
watch(
	() => toContinue.loading,
	(loading) => {
		if (loading || !reloadPending) return
		reloadPending = false
		refresh()
	}
)

const draft = computed<CourseToContinue | null>(() => {
	const data = toContinue.data
	return data && 'course' in data ? data : null
})

// Any route about the course counts: the chapter and lesson forms open as
// dialogs over the course page and carry the same courseName param.
const onOwnCourse = computed(
	() =>
		Boolean(route.params.courseName) &&
		route.params.courseName === draft.value?.course
)

// A phone's course page keeps its own floating button in this corner.
const underPhoneCoursePage = computed(
	() => isMobile.value && route.name === 'CourseDetail'
)

const course = computed(() =>
	closed.value || onOwnCourse.value || underPhoneCoursePage.value
		? null
		: draft.value
)

// From the draft, not the visible panel: the closed event reads it after
// the panel is already hidden.
const doneCount = computed(
	() => draft.value?.steps.filter((step) => step.done).length ?? 0
)

// Once per draft per page load, and only when it is actually on screen.
const shownFor = new Set<string>()
watch(
	course,
	(shown) => {
		if (!shown || shownFor.has(shown.course)) return
		shownFor.add(shown.course)
		capture('continue_course_panel_shown', {
			course: shown.course,
			steps_done: doneCount.value,
		})
	},
	{ immediate: true }
)

const steps = computed(() =>
	(course.value?.steps ?? []).map((step) => ({
		...step,
		label: STEP_LABELS[step.name],
	}))
)

const stepsLabel = computed(() =>
	__('{0} of {1} steps to publish').format(
		doneCount.value,
		course.value?.steps.length ?? 0
	)
)

const editedLabel = computed(() =>
	course.value
		? __('edited {0}').format(serverTime(course.value.last_edited).fromNow())
		: ''
)

function close() {
	closed.value = true
	try {
		sessionStorage.setItem(closedKey, '1')
	} catch {
		/* the panel still closes for this page load */
	}
	capture('continue_course_panel_closed', {
		course: draft.value?.course,
		steps_done: doneCount.value,
	})
}

function open() {
	const data = draft.value
	if (!data) return
	capture('continue_course_panel_continued', {
		course: data.course,
		lesson: data.lesson,
	})
	router.push(editorRoute(data))
}

// Each open step leads where it is done: the editor for chapters and lessons,
// Settings for the Publish button.
function goTo(step: Step) {
	const data = draft.value
	if (!data) return
	capture('continue_course_panel_step_clicked', {
		course: data.course,
		step: step.name,
	})
	if (step.name === 'publish') {
		router.push({
			name: 'CourseDetail',
			params: { courseName: data.course },
			hash: '#settings',
		})
		return
	}
	router.push(editorRoute(data, step.name === 'lesson'))
}

// The editor opens the lesson the author left, or the course default when the
// step is about adding a chapter or there is no lesson yet.
function editorRoute(data: CourseToContinue, withLesson = true) {
	return {
		name: 'CourseDetail',
		params: { courseName: data.course },
		hash: '#editor',
		query: withLesson && data.lesson ? { editLessonName: data.lesson } : {},
	}
}
</script>
