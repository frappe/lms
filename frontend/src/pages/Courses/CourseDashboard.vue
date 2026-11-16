<template>
	<div class="flex flex-col p-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
		<LoadError v-if="statsError" :error="statsError" @retry="retryStats" />
		<DashboardEmptyState
			v-else-if="showStudentsEmptyState"
			:description="
				__('Enrolled students and their progress will show up here.')
			"
			@enroll="openEnroll"
		/>
		<div
			v-else
			class="grid grid-cols-1 gap-5 lg:min-h-[30rem] lg:flex-1 lg:grid-cols-[minmax(0,1fr)_22rem] min-[1400px]:grid-cols-[minmax(0,1fr)_26rem] 2xl:grid-cols-[minmax(0,1fr)_30rem]"
		>
			<div class="flex min-w-0 flex-col gap-5 lg:min-h-0">
				<DashboardKpiCards :kpis="kpis" :loading="!stats.data" />
				<div class="flex min-w-0 flex-1 flex-col lg:min-h-0">
					<CourseStudentsPanel
						v-model:stage="stage"
						:paid="isPaid"
						:course-name="courseName"
						:total-lessons="totalLessons"
						@view-progress="openProgress"
						@unenrolled="reloadAfterUnenroll"
					/>
				</div>
			</div>
			<div class="flex min-w-0 flex-col gap-5 lg:min-h-0 lg:overflow-y-auto">
				<CourseFeedbackPanel
					class="lg:min-h-0"
					:course-name="courseName"
					:feedback="stats.data?.feedback ?? null"
				/>
				<CourseFunnelPanel
					class="h-60 lg:h-auto lg:min-h-[12rem] lg:flex-1"
					:stats="stats.data"
					:show-lessons="Boolean(lessonProgress.data?.length)"
					:lessons="lessonProgress.data ?? []"
					:active-filter="stage"
					@select-stage="selectStage"
				/>
				<CourseActivityPanel
					class="h-80 lg:h-auto lg:min-h-[13rem] lg:flex-[1.4]"
					:weekly="stats.data?.weekly ?? null"
				/>
			</div>
		</div>
	</div>
	<CourseStudentSheet
		v-if="showProgressModal && currentStudent"
		v-model="showProgressModal"
		:course-name="courseName"
		:enrollment="currentStudent.enrollment"
		@unenrolled="reloadAfterSheetChange"
		@certified="reloadAfterSheetChange"
	/>
</template>
<script setup lang="ts">
import { createResource, getCachedResource } from 'frappe-ui'
import type { NumberCardSparkline } from 'frappe-ui/charts'
import { computed, ref } from 'vue'
import DashboardKpiCards from '@/components/Dashboard/DashboardKpiCards.vue'
import DashboardEmptyState from '@/components/Dashboard/DashboardEmptyState.vue'
import LoadError from '@/components/LoadError.vue'
import { openFormRoute } from '@/composables/useFormRoute'
import { syncDashboardState } from '@/composables/dashboard/useDashboard'
import router from '@/router'
import CourseActivityPanel from '@/pages/Courses/components/CourseActivityPanel.vue'
import CourseFeedbackPanel from '@/pages/Courses/components/CourseFeedbackPanel.vue'
import CourseStudentSheet from '@/pages/Courses/components/CourseStudentSheet.vue'
import CourseFunnelPanel from '@/pages/Courses/components/CourseFunnelPanel.vue'
import CourseStudentsPanel from '@/pages/Courses/components/CourseStudentsPanel.vue'
import {
	percentChange,
	pointChange,
	sparklineOf,
	toggleFilter,
} from '@/utils/dashboard/charts'
import { FILTER_GROUPS, groupOf } from '@/utils/dashboard/filters'
import { firstLoadError } from '@/utils/loadError'
import type {
	CourseDashboardStats,
	CourseDetails,
	DashboardKpi as Kpi,
	CourseStudentRow,
	CourseWeeklyTrends,
	LessonCompletionRow,
	Resource,
	StudentFilter,
} from '@/types'

type WeeklySeries = Exclude<keyof CourseWeeklyTrends, 'weeks'>

const props = defineProps<{
	course: Resource<CourseDetails | null>
}>()

const courseName = props.course.data?.name ?? ''
const stage = ref<StudentFilter | null>(null)
const showProgressModal = ref<boolean>(false)
const currentStudent = ref<CourseStudentRow | null>(null)

// `courseDashboardStats` lets CourseEnrollmentForm refresh the counts too.
const stats = createResource<CourseDashboardStats>({
	url: 'lms.lms.dashboard.course.get_course_dashboard_stats',
	params: { course: courseName },
	cache: ['courseDashboardStats', courseName],
	auto: true,
})

const lessonProgress = createResource<LessonCompletionRow[]>({
	url: 'lms.lms.api.get_lesson_completion_stats',
	params: { course: courseName },
	auto: true,
})

const totalLessons = computed<number>(() => stats.data?.total_lessons ?? 0)

// A failed reload keeps the stats on screen; only a first load fails the body.
const statsError = computed(() => firstLoadError(stats))

const showStudentsEmptyState = computed<boolean>(
	() => stats.data?.enrolled === 0
)

syncDashboardState(() => {
	if (statsError.value) return 'failed'
	if (!stats.data) return 'loading'
	return showStudentsEmptyState.value ? 'empty' : 'ready'
})

const openEnroll = (): void => {
	openFormRoute(router, {
		name: 'NewCourseEnrollment',
		params: { courseName },
		hash: router.currentRoute.value.hash,
		query: { ...router.currentRoute.value.query },
	})
}

const isPaid = computed<boolean>(() =>
	Boolean(props.course.data?.paid_course || props.course.data?.paid_certificate)
)

const percentOf = (part: number, whole: number): number =>
	whole ? Math.round((part / whole) * 100) : 0

const oneDecimal = (value: number): string => value.toFixed(1)

const sparkline = (
	series: WeeklySeries,
	type: NumberCardSparkline['type']
): NumberCardSparkline | undefined =>
	sparklineOf(stats.data?.weekly[series], type)

// A card filters the student list to the students it counts and stays pressed
// while the list shows any filter of its group; pressing it again clears the
// filter. Enrolled counts everyone, so it only clears.
const filterBy = (filter: StudentFilter | null, label: string) => {
	const pressed =
		filter !== null &&
		stage.value !== null &&
		groupOf(FILTER_GROUPS, filter).includes(stage.value)
	return {
		label,
		pressed,
		onSelect: () => (stage.value = pressed ? null : filter),
	}
}

// The card titles, which the cards also show while they load.
const KPI_TITLES = () => ({
	enrolled: __('Enrolled'),
	active: __('Active (7 days)'),
	completion: __('Completion rate'),
	certified: __('Certified'),
})

const countKpis = (data: CourseDashboardStats): Kpi[] => [
	{
		key: 'enrolled',
		title: KPI_TITLES().enrolled,
		value: data.enrolled,
		delta: percentChange(data.deltas.enrollments),
		deltaSuffix: '%',
		fallbackCaption: __('None last month'),
		sparkline: sparkline('enrollments', 'bar'),
		select: filterBy(null, __('Show all students')),
	},
	{
		key: 'active',
		title: KPI_TITLES().active,
		value: data.active_7d,
		delta: percentChange(data.deltas.active),
		deltaSuffix: '%',
		fallbackCaption: __('{0}% of enrolled').format(
			String(percentOf(data.active_7d, data.enrolled))
		),
		sparkline: sparkline('active', 'area'),
		select: filterBy('active', __('Show active students')),
	},
	{
		key: 'completion',
		title: KPI_TITLES().completion,
		value: percentOf(data.completed, data.enrolled),
		suffix: '%',
		delta: pointChange(data.deltas.completion_rate),
		deltaSuffix: ' ' + __('pts'),
		deltaFormat: oneDecimal,
		fallbackCaption: __('{0} finished').format(data.completed.toLocaleString()),
		sparkline: sparkline('completion_rate', 'line'),
		select: filterBy('finished', __('Show students who finished')),
	},
	{
		key: 'certified',
		title: KPI_TITLES().certified,
		value: data.certified,
		delta: percentChange(data.deltas.certificates),
		deltaSuffix: '%',
		fallbackCaption: __('{0}% of finishers').format(
			String(percentOf(data.certified, data.completed))
		),
		sparkline: sparkline('certificates', 'bar'),
		select: filterBy('certified', __('Show certified students')),
	},
]

const kpis = computed<Kpi[]>(() => {
	const data = stats.data
	if (!data)
		return Object.values(KPI_TITLES()).map((title) => ({
			key: title,
			title,
			value: null,
			delta: null,
			fallbackCaption: '',
		}))
	return countKpis(data)
})

const selectStage = (value: StudentFilter | null): void => {
	stage.value = toggleFilter(stage.value, value)
}

const openProgress = (student: CourseStudentRow): void => {
	currentStudent.value = student
	showProgressModal.value = true
}

// The student list remounts with the body, which loads it again.
const retryStats = (): void => {
	stats.reload()
	lessonProgress.reload()
}

const reloadAfterUnenroll = (): void => {
	stats.reload()
	lessonProgress.reload()
	props.course.reload()
}

const reloadAfterSheetChange = (): void => {
	reloadAfterUnenroll()
	getCachedResource(['courseProgress', courseName])?.reload()
}
</script>
