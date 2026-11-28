<template>
	<CourseStudentView
		v-if="studentView"
		v-model="studentView"
		:course="course"
		:breadcrumbs="breadcrumbs"
		@exit="studentView = null"
	/>
	<TabbedDetailPage
		v-else
		:tabs="tabs"
		:breadcrumbs="breadcrumbs"
		:published="Boolean(course.data?.published)"
		:loading="!course.data"
		:doc="course"
		doc-prop="course"
	>
		<template #status>
			<template v-if="isAdmin">
				<Badge :theme="course.data?.published ? 'green' : 'amber'">
					{{ course.data?.published ? __('Published') : __('Draft') }}
				</Badge>
			</template>
			<Badge v-else-if="course.data?.published" theme="green">
				{{ __('Published') }}
			</Badge>
		</template>
		<template #actions="{ tab }">
			<template v-if="isFormTab(tab?.key)">
				<CourseHeaderActions
					:course="course"
					:actions="actions"
					:canPublish="Boolean(user.data?.is_moderator)"
					@studentView="openStudentView"
				/>
				<CourseSaveButton v-if="isMobile" :form="form" />
			</template>
			<template v-if="tab?.key === 'editor' && editorSelected">
				<Tooltip
					v-if="isMobile && courseEditorRef?.lessonHasVideo"
					:text="__('Video Statistics')"
				>
					<Button
						variant="ghost"
						:label="__('Video Statistics')"
						class="!size-9"
						@click="courseEditorRef?.openVideoStats()"
					>
						<template #icon>
							<span class="lucide-trending-up size-4" />
						</template>
					</Button>
				</Tooltip>
				<Tooltip v-if="studentViewRoute && isMobile" :text="__('Student View')">
					<Button
						variant="outline"
						class="!size-9"
						:label="__('Student View')"
						:route="studentViewRoute"
					>
						<template #icon>
							<span class="lucide-eye size-4" />
						</template>
					</Button>
				</Tooltip>
				<Button
					v-else-if="studentViewRoute"
					variant="outline"
					:route="studentViewRoute"
				>
					<template #prefix>
						<span class="lucide-eye size-4" />
					</template>
					{{ __('Student View') }}
				</Button>
			</template>
			<DashboardTabActions
				v-if="isMobile && hasDashboardActions(tab?.key)"
				@export="exportAnalytics"
				@enroll="openEnrollForm"
			/>
		</template>

		<template #solo>
			<CourseOverview v-if="course.data" :course="course" />
			<SkeletonLoader v-else variant="course-page" />
		</template>

		<template #loading="{ tab }">
			<div
				v-if="tab.key === 'editor'"
				class="flex min-h-0 flex-1"
				data-testid="tab-skeleton"
			>
				<SkeletonLoader variant="editor-content" class="min-w-0 flex-1" />
				<SkeletonLoader
					variant="editor-sidebar"
					class="hidden w-[30%] min-w-72 border-s @2xl:block"
				/>
			</div>
			<SkeletonLoader
				v-else
				:variant="TAB_SKELETONS[tab.key] || 'lines'"
				:class="{
					'flex-1': tab.key === 'settings',
					'p-5': !TAB_SKELETONS[tab.key],
				}"
				data-testid="tab-skeleton"
			/>
		</template>

		<template #tab-body-editor>
			<div
				v-if="isMobile && editorSelected"
				class="flex items-center gap-2 border-b bg-surface-base px-5 py-2.5"
			>
				<Button
					variant="subtle"
					class="!size-9"
					:label="__('Previous lesson')"
					:disabled="!courseEditorRef?.hasPrev"
					@click="courseEditorRef?.goPrev()"
				>
					<template #icon>
						<span class="lucide-chevron-left size-4 rtl:rotate-180" />
					</template>
				</Button>
				<div
					class="min-w-0 flex-1 text-center text-p-xs font-medium tabular-nums text-ink-gray-6"
				>
					<span v-if="courseEditorRef?.lessonTotal">
						{{ courseEditorRef?.lessonIndex }} /
						{{ courseEditorRef?.lessonTotal }}
					</span>
				</div>
				<Button
					variant="subtle"
					class="!size-9"
					:label="__('Next lesson')"
					:disabled="!courseEditorRef?.hasNext"
					@click="courseEditorRef?.goNext()"
				>
					<template #icon>
						<span class="lucide-chevron-right size-4 rtl:rotate-180" />
					</template>
				</Button>
			</div>
			<CourseEditor
				ref="courseEditorRef"
				:course="course"
				v-model:selected="editorSelected"
			/>
		</template>

		<template #tab-row-end="{ tab }">
			<div
				v-if="tab?.key === 'editor' && editorSelected && !isMobile"
				class="flex items-center gap-1"
			>
				<Tooltip
					v-if="courseEditorRef?.lessonHasVideo"
					:text="__('Video Statistics')"
				>
					<Button
						variant="ghost"
						:label="__('Video Statistics')"
						@click="courseEditorRef?.openVideoStats()"
					>
						<template #icon>
							<span class="lucide-trending-up size-4" />
						</template>
					</Button>
				</Tooltip>
				<Tooltip :text="__('How to edit a lesson')">
					<Button
						variant="ghost"
						class="text-p-base-medium"
						:label="__('How to edit a lesson')"
						@click="showLessonHelp = true"
					>
						<template #icon>
							<span class="lucide-info size-4" />
						</template>
					</Button>
				</Tooltip>
			</div>
			<CourseSaveButton v-if="isFormTab(tab?.key) && !isMobile" :form="form" />
			<DashboardTabActions
				v-if="!isMobile && hasDashboardActions(tab?.key)"
				@export="exportAnalytics"
				@enroll="openEnrollForm"
			/>
		</template>

		<template #overlay="{ tab }">
			<Button
				v-if="
					isMobile && tab?.key === 'editor' && courseEditorRef?.outlineVisible
				"
				variant="outline"
				size="md"
				class="absolute bottom-4 end-4 z-10 !h-11 !rounded-full !px-4 !shadow-lg"
				@click="courseEditorRef?.openChapters()"
			>
				<template #prefix>
					<span class="lucide-layers size-4" />
				</template>
				{{ __('Chapters') }}
			</Button>
		</template>
	</TabbedDetailPage>
	<span class="sr-only" role="status">{{ loadingAnnouncement }}</span>
	<LessonHelp v-model="showLessonHelp" />
	<ExportAnalyticsDialog
		v-if="exportMounted"
		v-model:open="showExport"
		kind="course"
		:name="courseName"
	/>
</template>
<script setup lang="ts">
import { computed, inject, markRaw, provide, ref, watch } from 'vue'
import type { ComputedRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Router } from 'vue-router'
import { Badge, Button, createResource, Tooltip, usePageMeta } from 'frappe-ui'
import { sessionStore } from '@/stores/session'
import { useScreenSize } from '@/utils/composables'
import TabbedDetailPage from '@/components/Layouts/pages/TabbedDetailPage.vue'
import {
	studentViewMode,
	studentViewQuery,
	type StudentViewMode,
} from '@/composables/useStudentView'
import type { DetailTab } from '@/components/Layouts/pages/TabbedDetailPage.vue'
import CourseOverview from '@/pages/Courses/CourseOverview.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import CourseDashboard from '@/pages/Courses/CourseDashboard.vue'
import CourseEditor from '@/pages/Courses/CourseEditor.vue'
import CourseForm from '@/pages/Courses/CourseForm.vue'
import LessonHelp from '@/components/LessonHelp.vue'
import ExportAnalyticsDialog from '@/components/Dashboard/ExportAnalyticsDialog.vue'
import DashboardTabActions from '@/components/Dashboard/DashboardTabActions.vue'
import CourseHeaderActions from '@/components/Courses/CourseHeaderActions.vue'
import CourseSaveButton from '@/components/Courses/CourseSaveButton.vue'
import CourseStudentView from '@/components/Courses/CourseStudentView.vue'
import { openFormRoute } from '@/composables/useFormRoute'
import { provideDashboardState } from '@/composables/dashboard/useDashboard'
import { useCourseForm } from '@/composables/useCourseForm'
import {
	confirmUnsavedChanges,
	useUnsavedChangesGuard,
} from '@/composables/useUnsavedChangesGuard'
import {
	COURSE_ACTIONS,
	useCourseActions,
} from '@/composables/useCourseActions'
import {
	saveShortcut,
	useKeyboardShortcuts,
} from '@/composables/useKeyboardShortcuts'
import type { CourseDetails, Resource, SessionUser } from '@/types'
import { isInstructorOf } from '@/utils/instructors'
import { useLoadingAnnouncement } from '@/utils/a11y'

type Brand = { name?: string; logo?: string; favicon?: string }

const { brand } = sessionStore() as { brand: Brand }
const router: Router = useRouter()
const route = useRoute()
const user = inject<SessionUser>('$user')!
const { isMobile } = useScreenSize()

const dashboardState = provideDashboardState()

interface EditorSelection {
	chapterNumber: string
	lessonNumber: string
	number: string
	title?: string
}

const editorSelected = ref<EditorSelection | null>(null)
const showLessonHelp = ref(false)

// A lesson just created has no position until the outline reload places it.
const studentViewRoute = computed(() =>
	editorSelected.value?.number
		? {
				name: 'Lesson',
				params: {
					courseName: props.courseName,
					chapterNumber: editorSelected.value.chapterNumber,
					lessonNumber: editorSelected.value.lessonNumber,
				},
				query: { studentView: 1 },
		  }
		: null
)

type CourseEditorApi = {
	saveSelectedLesson: () => void
	isDirty: ComputedRef<boolean>
	lessonHasVideo: ComputedRef<boolean>
	openVideoStats: () => void
	outlineVisible: ComputedRef<boolean>
	lessonIndex: ComputedRef<number>
	lessonTotal: ComputedRef<number>
	hasPrev: ComputedRef<boolean>
	hasNext: ComputedRef<boolean>
	goPrev: () => void
	goNext: () => void
	openChapters: () => void
}
const courseEditorRef = ref<CourseEditorApi | null>(null)

// The enrollment form is a child route now, not a modal the dashboard tab owned,
// so the button navigates instead of reaching into the tab instance. Hash and
// query both travel: the hash names the tab this page returns to, and the query
// holds CourseEditor's open lesson.
function openEnrollForm() {
	openFormRoute(router, {
		name: 'NewCourseEnrollment',
		params: { courseName: props.courseName },
		hash: route.hash,
		query: { ...route.query },
	})
}

const showExport = ref(false)
// Mounted on first use: most visits to the dashboard never export.
const exportMounted = ref(false)

function exportAnalytics(): void {
	exportMounted.value = true
	showExport.value = true
}

const hasDashboardActions = (tab?: string): boolean =>
	tab === 'dashboard' && dashboardState.value === 'ready'

const props = defineProps<{
	courseName: string
}>()

// No `cache` key: one course's data would show while the next one loads.
const course = createResource({
	url: 'lms.lms.utils.get_course_details',
	makeParams() {
		return {
			course: props.courseName,
			student_view: studentViewMode(route.query.studentView),
		}
	},
	auto: true,
}) as Resource<CourseDetails | null>

const tabs = computed<DetailTab[]>(() => [
	{
		key: 'overview',
		label: __('Overview'),
		component: markRaw(CourseOverview),
		icon: 'lucide-list',
		when: isAdmin.value,
		flow: true,
		rendersHeading: true,
	},
	{
		key: 'editor',
		label: __('Content'),
		component: markRaw(CourseEditor),
		icon: 'lucide-book-open',
		when: isAdmin.value,
	},
	{
		key: 'dashboard',
		label: __('Dashboard'),
		component: markRaw(CourseDashboard),
		icon: 'lucide-trending-up',
		when: isAdmin.value,
	},
	{
		key: 'settings',
		label: __('Settings'),
		component: markRaw(CourseForm),
		icon: 'lucide-sliders-horizontal',
		when: isAdmin.value,
		flow: true,
	},
])

watch(course, () => {
	if (
		!isAdmin.value &&
		!course.data?.membership &&
		!course.data?.published &&
		!course.data?.upcoming
	) {
		router.push({
			name: 'Courses',
		})
	}
})

const isInstructor = (): boolean =>
	isInstructorOf(course.data?.instructors, user.data?.username)

const isAdmin = computed<boolean>(() => {
	return Boolean(user.data?.is_moderator) || isInstructor()
})

const form = useCourseForm(props.courseName, course, () => isAdmin.value)
useUnsavedChangesGuard({
	isDirty: () => form.isDirty.value,
	isSaving: form.isSaving,
	save: form.submitCourse,
	param: 'courseName',
})
const actions = useCourseActions(course)
provide(COURSE_ACTIONS, actions)

// The URL owns student view, so it survives hops to lessons and back.
const studentView = computed<StudentViewMode | null>({
	get: () => studentViewMode(route.query.studentView),
	set: (mode) =>
		router.replace({
			hash: route.hash,
			query: {
				...route.query,
				studentView: studentViewQuery(mode)?.studentView,
			},
		}),
})

// Student view shows the stored course, so unsaved edits are settled first.
async function openStudentView(): Promise<void> {
	const proceed = await confirmUnsavedChanges({
		isDirty: () => form.isDirty.value,
		isSaving: form.isSaving,
		save: form.submitCourse,
		discard: form.discardChanges,
	})
	if (proceed) studentView.value = 'not-enrolled'
}

// The server answers student view as a learner in that state, so a mode switch refetches.
watch(studentView, () => course.reload())

const isFormTab = (key?: string): boolean =>
	isAdmin.value && (key === 'overview' || key === 'settings')

useKeyboardShortcuts({
	active: () =>
		!studentView.value && isFormTab(route.hash.slice(1) || 'overview'),
	ignoreTyping: false,
	shortcuts: [saveShortcut(() => form.submitCourse())],
})

const breadcrumbs = computed(() => {
	const crumbs: {
		label: string
		route: { name: string; params?: Record<string, string> }
	}[] = [{ label: __('Courses'), route: { name: 'Courses' } }]
	if (course.data) {
		crumbs.push({
			label: course.data.title,
			route: { name: 'CourseDetail', params: { courseName: course.data.name } },
		})
	}
	return crumbs
})

const TAB_SKELETONS: Record<string, 'course-page' | 'form'> = {
	overview: 'course-page',
	settings: 'form',
}

const loadingAnnouncement = useLoadingAnnouncement(
	() => !course.data,
	() => (course.data ? __('{0} loaded').format(course.data.title) : '')
)

// CourseDetail hands this to the enrol form in its <router-view>, so enrolling
// refreshes the dashboard's Enrolled stat; key-less, the form cannot reach it.
defineExpose({ reloadCourse: () => course.reload() })

usePageMeta(() => {
	return {
		title: course.data?.title,
		icon: brand.favicon,
	}
})
</script>
