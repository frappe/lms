<template>
	<div
		class="flex flex-col"
		:class="flowsWithPage ? 'min-h-full shrink-0' : 'h-full'"
	>
		<LayoutHeader :isLoading="!course.data">
			<template #left-header>
				<!-- Breadcrumbs plus a badge do not fit 390px beside the actions, so
				     a phone gets a single back-link carrying the course title. -->
				<router-link
					v-if="isMobile"
					:to="{ name: 'Courses' }"
					class="flex min-w-0 items-center gap-1 text-ink-gray-9"
				>
					<span class="lucide-chevron-left size-4 shrink-0" />
					<span class="truncate text-p-base-medium">
						{{ course.data?.title }}
					</span>
				</router-link>
				<template v-else>
					<Breadcrumbs class="h-7" :items="breadcrumbs" />
					<Badge v-if="course.data?.published" theme="green">
						{{ __('Published') }}
					</Badge>
				</template>
			</template>
			<template #right-header>
				<template v-if="tabIndex === 3 && courseFormRef">
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
						<Button
							variant="solid"
							:disabled="true"
							:class="isMobile ? '!size-9' : ''"
						>
							<span v-if="isMobile" class="lucide-save size-4" />
							<span v-else>{{ __('Save') }}</span>
						</Button>
					</Tooltip>
					<ShortcutTooltip v-else :label="__('Save')" combo="Mod+S">
						<Button
							variant="solid"
							:class="isMobile ? '!size-9' : ''"
							@click="courseFormRef.submitCourse()"
						>
							<span v-if="isMobile" class="lucide-save size-4" />
							<span v-else>{{ __('Save') }}</span>
						</Button>
					</ShortcutTooltip>
				</template>
				<template v-if="tabIndex === 2 && editorSelected">
					<!-- Edit mode autosaves continuously, so there is no Save
					     button or dirty badge here. -->
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
					<!-- The help affordance is the first thing to go at 390px: the
					     lesson stepper and Student View earn the space instead. -->
					<Tooltip v-if="!isMobile" :text="__('How to edit a lesson')">
						<Button
							variant="ghost"
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
						<!-- Mobile: the label goes, the hit area stays thumb-sized. -->
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
					v-if="tabIndex === 1 && course.data && isMobile"
					variant="outline"
					class="!size-9"
					:tooltip="__('Enroll')"
					@click="courseDashboardRef?.openEnrollModal()"
				>
					<template #icon>
						<span class="lucide-plus size-4" />
					</template>
				</Button>
				<Button
					v-else-if="tabIndex === 1 && course.data"
					variant="outline"
					@click="courseDashboardRef?.openEnrollModal()"
				>
					<template #prefix>
						<span class="lucide-plus size-4" />
					</template>
					{{ __('Enroll') }}
				</Button>
				<!-- On a phone the publish toggle moves into the ... menu beside it,
				     where it keeps a written label: an icon-only globe gives no hint
				     that it publishes the course, and a labelled button does not fit
				     beside Save and the rest at 390px. -->
				<Button
					v-if="tabIndex === 3 && user.data?.is_moderator && !isMobile"
					:variant="course.data?.published ? 'outline' : 'solid'"
					:theme="course.data?.published ? 'red' : 'gray'"
					:loading="publishToggle.loading"
					@click="togglePublishCourse"
				>
					{{ course.data?.published ? __('Unpublish') : __('Publish') }}
				</Button>
			</template>
		</LayoutHeader>
		<LessonHelp v-model="showLessonHelp" />

		<div v-if="!isAdmin" class="flex-1 min-h-0">
			<CourseOverview v-if="course.data" :course="course" />
			<SkeletonLoader v-else variant="course-page" />
		</div>
		<div
			v-else
			class="relative flex flex-1 flex-col"
			:class="{ 'min-h-0': !flowsWithPage }"
		>
			<Tabs
				:tabs="tabs"
				v-model="tabIndex"
				class="course-tabs"
				:class="{ 'page-flow': flowsWithPage }"
			>
				<!-- Mobile: drop the per-tab icon and shorten the editor label so
				     all four tabs fit the viewport without horizontal scroll. -->
				<template #tab-item="{ tab }">
					<button
						class="flex items-center gap-1.5 whitespace-nowrap py-2.5 text-p-base text-ink-gray-5 duration-300 ease-in-out hover:text-ink-gray-9 data-[state=active]:text-ink-gray-9"
					>
						<span
							v-if="
								!isMobile &&
								typeof tab.icon === 'string' &&
								tab.icon.startsWith('lucide-')
							"
							class="size-4"
							:class="tab.icon"
						/>
						{{ tabDisplayLabel(tab.label) }}
					</button>
				</template>
				<template #tab-panel="{ tab }">
					<template v-if="course.data">
						<template v-if="tab.component === CourseEditor">
							<!-- Mobile editor: which lesson you are on, and prev/next.
							     No completion bar — this is the authoring view, where a
							     learner's progress means nothing. -->
							<div
								v-if="isMobile && editorSelected"
								class="flex items-center gap-2 border-b bg-surface-base px-3 py-2"
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
						<CourseForm
							v-else-if="tab.component === CourseForm"
							ref="courseFormRef"
							:course="course"
						/>
						<CourseDashboard
							v-else-if="tab.component === CourseDashboard"
							ref="courseDashboardRef"
							:course="course"
						/>
						<component v-else :is="tab.component" :course="course" />
					</template>
				</template>
			</Tabs>

			<!-- Chapters as a floating pill rather than a header icon: on a phone
			     the outline is the control you reach for most while editing, and
			     the bottom-right corner is where a thumb already is. Uses the
			     ordinary outline Button so it carries espresso's surface, border
			     and ink tokens instead of an ad-hoc dark fill. -->
			<Button
				v-if="isMobile && tabIndex === 2"
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
				v-if="tabIndex === 2 && course.data"
				class="pointer-events-none absolute inset-x-0 top-0 z-10 hidden md:flex"
			>
				<div class="w-[70%]" />
				<div
					class="pointer-events-auto flex w-[30%] items-center justify-between gap-x-2 border-s border-b bg-surface-base p-1 px-5"
				>
					<div class="py-2.5 text-base-medium text-ink-gray-9">
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
import { sessionStore } from '@/stores/session'
import { useScreenSize } from '@/utils/composables'
import LayoutHeader from '@/components/Layouts/LayoutHeader.vue'
import CourseOverview from '@/pages/Courses/CourseOverview.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import CourseDashboard from '@/pages/Courses/CourseDashboard.vue'
import CourseEditor from '@/pages/Courses/CourseEditor.vue'
import CourseForm from '@/pages/Courses/CourseForm.vue'
import LessonHelp from '@/components/LessonHelp.vue'
import ShortcutTooltip from '@/components/ShortcutTooltip.vue'
import type {
	CourseDetails,
	CourseInstructorInfo,
	Resource,
	SessionUser,
} from '@/types'

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
const { isMobile } = useScreenSize()

interface EditorSelection {
	chapterNumber: string
	lessonNumber: string
	number: string
	title?: string
}

const editorSelected = ref<EditorSelection | null>(null)
const showLessonHelp = ref(false)

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
const courseDashboardRef = ref<{ openEnrollModal: () => void } | null>(null)

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
// label — an icon-only globe gave no hint that it publishes the course.
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
}) as Resource<CourseDetails | null>

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

// Overview and Settings are ordinary documents: on a phone they flow with the
// page so MobileLayout's #scrollContainer stays the only scroller. The editor
// is excluded — its `flex-1 min-h-0` grid needs a bounded panel to fill — and
// so is the dashboard, which renders as it does today.
function tabDisplayLabel(label: string): string {
	if (isMobile.value && label === __('Course editor')) return __('Editor')
	return label
}

const flowsWithPage = computed<boolean>(() => {
	if (!isMobile.value) return false
	const active = tabs.value[tabIndex.value]?.component
	return active === CourseOverview || active === CourseForm
})

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

<style scoped>
/* frappe-ui Tabs: TabsContent has no flex-1, so when the active panel's
   content is intrinsically tall (Course editor with many lessons), the
   flex-col layout shrinks the TabsList strip. Pin it so the strip keeps
   its content height. */
:deep([role='tablist']) {
	flex-shrink: 0;
}

/* frappe-ui TabsContent is `flex flex-col` with no flex-1, so the active
   panel collapses to its content height and the editor's `flex-1 min-h-0`
   grid has no space to fill. Stretch the active panel to fill TabsRoot. */
:deep([role='tabpanel'][data-state='active']) {
	flex: 1 1 0%;
	min-height: 0;
}

/* ...except on the tabs that flow with the page: there the panel must size to
   its content and let the overflow reach MobileLayout's #scrollContainer, so
   both TabsRoot's `overflow-hidden` and TabsContent's `overflow-auto` are
   released too. Without all three the panel stays a nested scroll box and the
   page itself has no scroll range, which is what pins the URL bar open. */
.course-tabs.page-flow {
	overflow: visible;
}

.course-tabs.page-flow :deep([role='tabpanel'][data-state='active']) {
	flex: none;
	min-height: auto;
	overflow: visible;
}

/* Mobile: tighten the tablist gap/padding so all four tabs fit the viewport
   without horizontal scroll. */
@media (max-width: 639px) {
	.course-tabs :deep([role='tablist']) {
		gap: 1rem;
		padding-inline: 0.75rem;
	}
}
</style>
