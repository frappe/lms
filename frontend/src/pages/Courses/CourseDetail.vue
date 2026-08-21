<template>
	<TabbedDetailPage
		ref="page"
		:tabs="tabs"
		:breadcrumbs="breadcrumbs"
		:published="Boolean(course.data?.published)"
		:loading="!course.data"
		:doc="course"
		doc-prop="course"
	>
		<template #actions="{ tab }">
			<template v-if="tab?.key === 'settings' && courseFormRef">
				<Badge v-if="courseFormRef.isDirty" theme="orange">
					{{ __('Not Saved') }}
				</Badge>
				<Dropdown
					:options="courseOptions"
					:button="{
						icon: 'lucide-ellipsis',
						variant: 'ghost',
						label: __('Course options'),
					}"
					side="bottom"
					align="end"
				/>
				<Tooltip
					v-if="!courseFormRef.isDirty"
					:text="__('No changes to save')"
					:hoverDelay="0.1"
				>
					<HeaderButton :label="__('Save')" variant="solid" disabled />
				</Tooltip>
				<ShortcutTooltip v-else :label="__('Save')" combo="Mod+S">
					<HeaderButton
						:label="__('Save')"
						variant="solid"
						@click="courseFormRef.submitCourse()"
					/>
				</ShortcutTooltip>
			</template>
			<template v-if="tab?.key === 'editor' && editorSelected">
				<Tooltip
					v-if="courseEditorRef?.lessonHasVideo"
					:text="__('Video Statistics')"
				>
					<Button
						variant="ghost"
						:label="__('Video Statistics')"
						:class="isMobile ? '!size-9' : ''"
						@click="courseEditorRef?.openVideoStats()"
					>
						<template #icon>
							<span class="lucide-trending-up size-4" />
						</template>
					</Button>
				</Tooltip>
				<Tooltip v-if="!isMobile" :text="__('How to edit a lesson')">
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
				<router-link
					:to="{
						name: 'Lesson',
						params: {
							courseName: props.courseName,
							chapterNumber: editorSelected.chapterNumber,
							lessonNumber: editorSelected.lessonNumber,
						},
						query: { studentView: 1 },
					}"
				>
					<Tooltip v-if="isMobile" :text="__('Student View')">
						<Button variant="outline" class="!size-9">
							<template #icon>
								<span class="lucide-eye size-4" />
							</template>
						</Button>
					</Tooltip>
					<Button v-else variant="outline">
						<template #prefix>
							<span class="lucide-eye size-4" />
						</template>
						{{ __('Student View') }}
					</Button>
				</router-link>
			</template>
			<Button
				v-if="tab?.key === 'dashboard' && course.data && isMobile"
				variant="outline"
				class="!size-9"
				:tooltip="__('Enroll')"
				@click="openEnrollForm()"
			>
				<template #icon>
					<span class="lucide-plus size-4" />
				</template>
			</Button>
			<Button
				v-else-if="tab?.key === 'dashboard' && course.data"
				variant="outline"
				@click="openEnrollForm()"
			>
				<template #prefix>
					<span class="lucide-plus size-4" />
				</template>
				{{ __('Enroll') }}
			</Button>
			<Button
				v-if="tab?.key === 'settings' && user.data?.is_moderator && !isMobile"
				:variant="course.data?.published ? 'outline' : 'solid'"
				:theme="course.data?.published ? 'red' : 'gray'"
				:loading="publishToggle.loading"
				@click="togglePublishCourse"
			>
				{{ course.data?.published ? __('Unpublish') : __('Publish') }}
			</Button>
		</template>

		<template #solo>
			<CourseOverview v-if="course.data" :course="course" />
			<SkeletonLoader v-else variant="course-page" />
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
						<span class="lucide-chevron-left size-4" />
					</template>
				</Button>
				<div
					class="min-w-0 flex-1 text-center text-p-xs font-medium tabular-nums text-ink-gray-5"
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
						<span class="lucide-chevron-right size-4" />
					</template>
				</Button>
			</div>
			<CourseEditor
				ref="courseEditorRef"
				:course="course"
				v-model:selected="editorSelected"
			/>
		</template>

		<template #overlay="{ tab }">
			<Button
				v-if="isMobile && tab?.key === 'editor'"
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

			<div
				v-if="tab?.key === 'editor' && course.data"
				class="pointer-events-none absolute inset-x-0 top-0 z-10 hidden md:flex"
			>
				<div class="w-[70%]" />
				<div
					class="pointer-events-auto flex w-[30%] items-center justify-between gap-x-2 border-s border-b bg-surface-base p-1 px-5"
				>
					<div class="py-2.5 text-p-base-medium text-ink-gray-9">
						{{ __('Chapters') }}
					</div>
					<Button size="sm" @click="courseEditorRef?.openAddChapter()">
						<template #prefix>
							<span class="lucide-plus size-4" />
						</template>
						{{ __('Add') }}
					</Button>
				</div>
			</div>
		</template>
	</TabbedDetailPage>
	<LessonHelp v-model="showLessonHelp" />

	<router-view />
</template>
<script setup lang="ts">
import { computed, inject, markRaw, ref, useTemplateRef, watch } from 'vue'
import type { ComputedRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Router } from 'vue-router'
import {
	Badge,
	Button,
	createResource,
	Dropdown,
	Tooltip,
	toast,
	usePageMeta,
} from 'frappe-ui'
import { sessionStore } from '@/stores/session'
import { useScreenSize } from '@/utils/composables'
import TabbedDetailPage from '@/components/Layouts/TabbedDetailPage.vue'
import type { DetailTab } from '@/components/Layouts/TabbedDetailPage.vue'
import CourseOverview from '@/pages/Courses/CourseOverview.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import CourseDashboard from '@/pages/Courses/CourseDashboard.vue'
import CourseEditor from '@/pages/Courses/CourseEditor.vue'
import CourseForm from '@/pages/Courses/CourseForm.vue'
import LessonHelp from '@/components/LessonHelp.vue'
import ShortcutTooltip from '@/components/ShortcutTooltip.vue'
import HeaderButton from '@/components/HeaderButton.vue'
import { openFormRoute } from '@/composables/useFormRoute'
import type {
	CourseDetails,
	CourseInstructorInfo,
	Resource,
	SessionUser,
} from '@/types'

type Brand = { name?: string; logo?: string; favicon?: string }

const { brand } = sessionStore() as { brand: Brand }
const router: Router = useRouter()
const route = useRoute()
const user = inject<SessionUser>('$user')!
const { isMobile } = useScreenSize()

interface EditorSelection {
	chapterNumber: string
	lessonNumber: string
	number: string
	title?: string
}

const editorSelected = ref<EditorSelection | null>(null)
const showLessonHelp = ref(false)

type CourseMenuItem = {
	label: string
	icon: string
	theme?: string
	onClick: () => void
}
type CourseFormApi = {
	isDirty: boolean
	submitCourse: () => void
	courseMenu: CourseMenuItem[]
}
const page = useTemplateRef('page')

const courseFormRef = computed<CourseFormApi | null>(
	() => (page.value?.instanceFor('settings') ?? null) as CourseFormApi | null
)

type CourseEditorApi = {
	saveSelectedLesson: () => void
	isDirty: ComputedRef<boolean>
	lessonHasVideo: ComputedRef<boolean>
	openVideoStats: () => void
	openAddChapter: () => void
	lessonIndex: ComputedRef<number>
	lessonTotal: ComputedRef<number>
	hasPrev: ComputedRef<boolean>
	hasNext: ComputedRef<boolean>
	goPrev: () => void
	goNext: () => void
	openChapters: () => void
}
const courseEditorRef = ref<CourseEditorApi | null>(null)

const publishToggle = createResource({
	url: 'frappe.client.set_value',
	makeParams() {
		return {
			doctype: 'LMS Course',
			name: course.data?.name,
			fieldname: 'published',
			value: course.data?.published ? 0 : 1,
		}
	},
	onSuccess() {
		toast.success(
			course.data?.published ? __('Course unpublished') : __('Course published')
		)
		course.reload()
	},
	onError(err: { messages?: string[] } | string) {
		const msg =
			typeof err === 'string'
				? err
				: err.messages?.[0] ?? __('Could not update publish status')
		toast.error(msg)
	},
}) as Resource<unknown>

// On a phone the publish toggle joins the ... menu, where it keeps a written
// label. An icon-only globe gave no hint that it publishes the course.
const courseOptions = computed<CourseMenuItem[]>(() => {
	const menu = courseFormRef.value?.courseMenu ?? []
	if (!isMobile.value || !user.data?.is_moderator) return menu
	return [
		{
			label: course.data?.published
				? __('Unpublish course')
				: __('Publish course'),
			icon: course.data?.published ? 'lucide-globe-lock' : 'lucide-globe',
			onClick: () => togglePublishCourse(),
		},
		...menu,
	]
})

function togglePublishCourse() {
	publishToggle.submit()
}

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

const props = defineProps<{
	courseName: string
}>()

// No `cache` key: it would be read once at setup, so the reload below (this
// component is reused when you jump straight from one course to another) would
// file the new course's data under the course you arrived on.
const course = createResource({
	url: 'lms.lms.utils.get_course_details',
	makeParams() {
		return {
			course: props.courseName,
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
	},
	{
		key: 'dashboard',
		label: __('Dashboard'),
		component: markRaw(CourseDashboard),
		icon: 'lucide-trending-up',
		when: isAdmin.value,
	},
	{
		key: 'editor',
		label: __('Course editor'),
		shortLabel: __('Editor'),
		component: markRaw(CourseEditor),
		icon: 'lucide-book-open',
		when: isAdmin.value,
	},
	{
		key: 'settings',
		label: __('Settings'),
		component: markRaw(CourseForm),
		icon: 'lucide-settings-2',
		when: isAdmin.value,
		flow: true,
	},
])

watch(
	() => props.courseName,
	() => {
		course.reload()
	}
)

watch(course, () => {
	if (!isAdmin.value && !course.data?.published && !course.data?.upcoming) {
		router.push({
			name: 'Courses',
		})
	}
})

const isInstructor = (): boolean => {
	let user_is_instructor = false
	course.data?.instructors.forEach((instructor: CourseInstructorInfo) => {
		if (!user_is_instructor && instructor.name == user.data?.name) {
			user_is_instructor = true
		}
	})
	return user_is_instructor
}

const isAdmin = computed<boolean>(() => {
	return Boolean(user.data?.is_moderator) || isInstructor()
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

usePageMeta(() => {
	return {
		title: course.data?.title,
		icon: brand.favicon,
	}
})
</script>
