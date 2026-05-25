<template>
	<SkeletonLoader v-if="!course.data" variant="course-page" />
	<div v-else>
		<LayoutHeader>
			<template #left-header>
				<Breadcrumbs class="h-7" :items="breadcrumbs" />
				<Badge v-if="course.data.published" theme="green">
					{{ __('Published') }}
				</Badge>
			</template>
			<template #right-header>
				<template v-if="tabIndex === 3 && courseFormRef">
					<Badge v-if="courseFormRef.isDirty" theme="orange">
						{{ __('Not Saved') }}
					</Badge>
					<Dropdown
						:options="courseFormRef.courseMenu"
						:button="{ icon: 'lucide-ellipsis', variant: 'ghost' }"
						side="bottom"
						align="end"
					/>
					<Tooltip
						:text="courseFormRef.isDirty ? '' : __('No changes to save')"
						:hoverDelay="0.1"
					>
						<Button
							variant="solid"
							:disabled="!courseFormRef.isDirty"
							@click="courseFormRef.submitCourse()"
						>
							{{ __('Save') }}
						</Button>
					</Tooltip>
				</template>
				<template v-if="tabIndex === 2 && editorSelected">
					<template v-if="editorMode === 'edit'">
						<Badge v-if="courseEditorRef?.isDirty" theme="orange">
							{{ __('Not Saved') }}
						</Badge>
						<Tooltip
							:text="courseEditorRef?.isDirty ? '' : __('No changes to save')"
							:hoverDelay="0.1"
						>
							<Button
								variant="solid"
								:disabled="!courseEditorRef?.isDirty"
								@click="courseEditorRef?.saveSelectedLesson()"
							>
								{{ __('Save') }}
							</Button>
						</Tooltip>
					</template>
					<template v-else-if="editorMode === 'preview'">
						<Tooltip v-if="courseEditorRef?.canGoZen" :text="__('Zen Mode')">
							<Button @click="courseEditorRef?.previewZen()">
								<template #icon>
									<Focus class="size-4 stroke-2" />
								</template>
							</Button>
						</Tooltip>
						<Button
							v-if="courseEditorRef?.hasPrev"
							@click="courseEditorRef?.previewPrev()"
						>
							<template #prefix>
								<ChevronLeft class="size-4 stroke-1.5" />
							</template>
							{{ __('Previous') }}
						</Button>
						<Button
							v-if="courseEditorRef?.hasNext"
							@click="courseEditorRef?.previewNext()"
						>
							<template #suffix>
								<ChevronRight class="size-4 stroke-1.5" />
							</template>
							{{ __('Next') }}
						</Button>
					</template>
					<Button
						variant="outline"
						@click="editorMode = editorMode === 'preview' ? 'edit' : 'preview'"
					>
						<template #prefix>
							<X v-if="editorMode === 'preview'" class="size-4 stroke-1.5" />
							<Eye v-else class="size-4 stroke-1.5" />
						</template>
						{{ editorMode === 'preview' ? __('Close preview') : __('Preview') }}
					</Button>
				</template>
				<Button
					v-if="user.data?.is_moderator"
					:variant="course.data.published ? 'subtle' : 'solid'"
					:theme="course.data.published ? 'red' : 'gray'"
					:loading="publishToggle.loading"
					@click="togglePublishCourse"
				>
					{{ course.data.published ? __('Unpublish') : __('Publish') }}
				</Button>
			</template>
		</LayoutHeader>

		<CourseOverview v-if="!isAdmin" :course="course" />
		<div v-else>
			<Tabs :tabs="tabs" v-model="tabIndex">
				<template #tab-panel="{ tab }">
					<CourseEditor
						v-if="tab.component === CourseEditor"
						ref="courseEditorRef"
						:course="course"
						v-model:selected="editorSelected"
						v-model:mode="editorMode"
					/>
					<CourseForm
						v-else-if="tab.component === CourseForm"
						ref="courseFormRef"
						:course="course"
					/>
					<component v-else :is="tab.component" :course="course" />
				</template>
			</Tabs>
		</div>
	</div>
</template>
<script setup lang="ts">
import { computed, inject, markRaw, onMounted, ref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import type { RouteLocationNormalizedLoadedGeneric, Router } from 'vue-router'
import {
	Badge,
	Breadcrumbs,
	Button,
	createResource,
	Dropdown,
	Tabs,
	Tooltip,
	toast,
	usePageMeta,
} from 'frappe-ui'
import { ChevronLeft, ChevronRight, Eye, Focus, X } from 'lucide-vue-next'
import { sessionStore } from '@/stores/session'
import LayoutHeader from '@/components/Layouts/LayoutHeader.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import CourseOverview from '@/pages/Courses/CourseOverview.vue'
import CourseDashboard from '@/pages/Courses/CourseDashboard.vue'
import CourseEditor from '@/pages/Courses/CourseEditor.vue'
import CourseForm from '@/pages/Courses/CourseForm.vue'
import type {
	CourseDetails,
	CourseInstructorInfo,
	Resource,
	SessionUser,
} from '@/types/api'

type Brand = { name?: string; logo?: string; favicon?: string }
interface TabDef {
	label: string
	component: ReturnType<typeof markRaw>
	icon: string
}

const { brand } = sessionStore() as { brand: Brand }
const router: Router = useRouter()
const route: RouteLocationNormalizedLoadedGeneric = useRoute()
const user = inject<SessionUser>('$user')!
const tabIndex: Ref<number> = ref(0)

interface EditorSelection {
	chapterNumber: string
	lessonNumber: string
	number: string
	title?: string
}

const editorSelected = ref<EditorSelection | null>(null)
const editorMode = ref<'edit' | 'preview'>('edit')

// Settings tab (CourseForm) exposes the API the LayoutHeader actions need.
type CourseMenuItem = {
	label: string
	icon: string
	theme?: string
	onClick: () => void
}
// `isDirty` is exposed as a Ref (defineExpose doesn't unwrap); `courseMenu`
// is a ComputedRef. Templates auto-unwrap both, but script-side access needs
// the wrapped types so callers don't accidentally truth-check a Ref object.
type CourseFormApi = {
	isDirty: Ref<boolean>
	submitCourse: () => void
	trashCourse: () => void
	courseMenu: ComputedRef<CourseMenuItem[]>
}
const courseFormRef = ref<CourseFormApi | null>(null)

type CourseEditorApi = {
	saveSelectedLesson: () => void
	isDirty: ComputedRef<boolean>
	hasPrev: ComputedRef<boolean>
	hasNext: ComputedRef<boolean>
	canGoZen: ComputedRef<boolean>
	previewPrev: () => void
	previewNext: () => void
	previewZen: () => void
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

function togglePublishCourse() {
	publishToggle.submit()
}

const props = defineProps<{
	courseName: string
}>()

onMounted(() => {
	updateTabIndex()
})

const updateTabIndex = () => {
	const hash = route.hash
	if (hash) {
		tabs.value.forEach((tab, index) => {
			if (tab.label?.toLowerCase() === hash.replace('#', '')) {
				tabIndex.value = index
			}
		})
	}
}

watch(tabIndex, () => {
	const tab = tabs.value[tabIndex.value]
	if (tab.label != route.hash.replace('#', '')) {
		router.push({ ...route, hash: `#${tab.label.toLowerCase()}` })
	}
})

// Switch tabs when the hash is changed programmatically (e.g. deep-links).
watch(() => route.hash, updateTabIndex)

const course = createResource({
	url: 'lms.lms.utils.get_course_details',
	cache: ['course', props.courseName],
	makeParams() {
		return {
			course: props.courseName,
		}
	},
	auto: true,
}) as Resource<CourseDetails | undefined>

const tabs = ref<TabDef[]>([
	{
		label: __('Overview'),
		component: markRaw(CourseOverview),
		icon: 'lucide-list',
	},
	{
		label: __('Dashboard'),
		component: markRaw(CourseDashboard),
		icon: 'lucide-trending-up',
	},
	{
		label: __('Course editor'),
		component: markRaw(CourseEditor),
		icon: 'lucide-book-open',
	},
	{
		label: __('Settings'),
		component: markRaw(CourseForm),
		icon: 'lucide-settings-2',
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
