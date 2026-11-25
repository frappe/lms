<template>
	<div
		v-if="batch?.data"
		class="flex flex-col p-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
	>
		<LoadError v-if="statsError" :error="statsError" @retry="stats.reload()" />
		<DashboardEmptyState
			v-else-if="showStudentsEmptyState"
			:description="
				__(
					'Enrolled students, their progress and attendance will show up here.'
				)
			"
			@enroll="openEnroll"
		/>
		<div
			v-else
			class="grid grid-cols-1 gap-5 lg:min-h-[30rem] lg:flex-1 lg:grid-cols-[minmax(0,1fr)_22rem] min-[1400px]:grid-cols-[minmax(0,1fr)_26rem] 2xl:grid-cols-[minmax(0,1fr)_30rem]"
		>
			<div class="flex min-w-0 flex-col gap-5 lg:min-h-0">
				<DashboardKpiCards :kpis="kpis" :loading="!stats.data">
					<template #empty-on_track>
						<span class="text-3xl-semibold text-ink-gray-4">—</span>
						<span class="text-sm text-ink-gray-6">{{ startsText }}</span>
					</template>
				</DashboardKpiCards>
				<div class="flex min-w-0 flex-1 flex-col lg:min-h-0">
					<BatchStudentsPanel
						v-model:stage="stage"
						v-model:class-filter="classFilter"
						:batch-name="batchName"
						@view-progress="openProgress"
						@removed="reloadAfterRemoval"
					/>
				</div>
			</div>
			<div class="flex min-w-0 flex-col gap-5 lg:min-h-0 lg:overflow-y-auto">
				<BatchFeedbackPanel
					class="lg:min-h-0"
					:batch-name="batchName"
					:feedback="stats.data?.feedback ?? null"
				/>
				<BatchFunnelPanel
					class="h-60 lg:h-auto lg:min-h-[12rem] lg:flex-1"
					:funnel="stats.data?.funnel ?? null"
					:active-filter="stage"
					@select-stage="selectStage"
				/>
				<BatchAttendancePanel
					v-if="!stats.data || stats.data.attendance.held"
					class="h-80 lg:h-auto lg:min-h-[13rem] lg:flex-[1.4]"
					:attendance="stats.data?.attendance ?? null"
					:enrolled="stats.data?.enrolled ?? 0"
					:active="classFilter"
					@select="selectClass"
				/>
			</div>
		</div>
	</div>
	<BatchStudentSheet
		v-if="showProgressModal && stats.data"
		v-model="showProgressModal"
		:batch-name="batchName"
		:enrollment="currentStudent"
		:state="stats.data.timeline.state"
		:start-date="stats.data.timeline.start_date"
		@removed="reloadAfterSheetRemoval"
	/>
</template>
<script setup lang="ts">
import { createResource, getCachedResource } from 'frappe-ui'
import { computed, inject, ref } from 'vue'
import type dayjsType from 'dayjs'
import DashboardKpiCards from '@/components/Dashboard/DashboardKpiCards.vue'
import DashboardEmptyState from '@/components/Dashboard/DashboardEmptyState.vue'
import LoadError from '@/components/LoadError.vue'
import { openBatchForm } from '@/composables/useBatchForms'
import { syncDashboardState } from '@/composables/dashboard/useDashboard'
import router from '@/router'
import BatchAttendancePanel from '@/pages/Batches/components/BatchAttendancePanel.vue'
import BatchFunnelPanel from '@/pages/Batches/components/BatchFunnelPanel.vue'
import BatchStudentsPanel from '@/pages/Batches/components/BatchStudentsPanel.vue'
import BatchFeedbackPanel from '@/pages/Batches/components/BatchFeedbackPanel.vue'
import BatchStudentSheet from '@/pages/Batches/components/BatchStudentSheet.vue'
import {
	percentChange,
	sparklineOf,
	toggleFilter,
} from '@/utils/dashboard/charts'
import { BATCH_FILTER_GROUPS, groupOf } from '@/utils/dashboard/filters'
import { firstLoadError } from '@/utils/loadError'
import type {
	BatchDashboardStats,
	BatchFilter,
	BatchStudentRow,
	ClassAttendanceFilter,
	DashboardKpi as Kpi,
} from '@/types'

const props = defineProps<{
	batch: {
		data: Record<string, any> | null
		reload: () => void
	} | null
}>()

const dayjs = inject<typeof dayjsType>('$dayjs')!
const reloadBatchDetails = inject<(() => void) | null>(
	'reloadBatchDetails',
	null
)

const batchName: string = props.batch?.data?.name ?? ''
const stage = ref<BatchFilter | null>(null)
const classFilter = ref<ClassAttendanceFilter | null>(null)
const showProgressModal = ref<boolean>(false)
const currentStudent = ref<string>('')

// `batchDashboardStats` lets BatchStudentForm refresh the counts too.
const stats = createResource<BatchDashboardStats>({
	url: 'lms.lms.dashboard.batch.get_batch_dashboard_stats',
	params: { batch: batchName },
	cache: ['batchDashboardStats', batchName],
	auto: true,
})

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
	openBatchForm(
		router,
		'NewBatchStudent',
		batchName,
		router.currentRoute.value.hash
	)
}

const percentOf = (part: number, whole: number): number =>
	whole ? Math.round((part / whole) * 100) : 0

// A card filters the student list to the students it counts and stays pressed
// while the list shows any filter of its group; pressing it again clears the
// filter. Students counts everyone, so it only clears.
const filterBy = (filter: BatchFilter | null, label: string) => {
	const pressed =
		filter !== null &&
		stage.value !== null &&
		groupOf(BATCH_FILTER_GROUPS, filter).includes(stage.value)
	return {
		label,
		pressed,
		onSelect: () => {
			classFilter.value = null
			stage.value = pressed ? null : filter
		},
	}
}

// The titles while the batch runs, which the cards also show while they load.
const KPI_TITLES = () => ({
	students: __('Students'),
	onTrack: __('On track'),
	atRisk: __('At risk'),
	certified: __('Certified'),
})

const studentsKpi = (data: BatchDashboardStats): Kpi => ({
	key: 'students',
	title: KPI_TITLES().students,
	value: data.enrolled,
	target: data.seat_count || undefined,
	delta: percentChange(data.deltas.enrollments),
	deltaSuffix: '%',
	fallbackCaption: data.seat_count
		? __('{0} seats left').format(
				Math.max(data.seat_count - data.enrolled, 0).toLocaleString()
		  )
		: __('No signups in the month before'),
	sparkline: sparklineOf(data.weekly.enrollments, 'bar'),
	select: filterBy(null, __('Show all students')),
})

const ended = computed<boolean>(() => stats.data?.timeline.state === 'ended')

// Once the batch is over, being on schedule means having finished, and the
// students still behind are the ones who did not.
const onTrackKpi = (data: BatchDashboardStats): Kpi =>
	ended.value
		? {
				key: 'on_track',
				title: __('Completed'),
				value: percentOf(data.counts.completed, data.enrolled),
				suffix: '%',
				delta: null,
				fallbackCaption: __('{0} finished all courses').format(
					data.counts.completed.toLocaleString()
				),
				select: filterBy('completed', __('Show students who finished')),
				sparkline: sparklineOf(data.weekly.lessons_completed, 'area'),
		  }
		: {
				key: 'on_track',
				title: KPI_TITLES().onTrack,
				value:
					data.timeline.state === 'upcoming'
						? null
						: percentOf(data.counts.on_track, data.enrolled),
				suffix: '%',
				delta: null,
				fallbackCaption: __('{0} behind schedule').format(
					data.counts.behind.toLocaleString()
				),
				select: filterBy('on_track', __('Show students on track')),
				sparkline: sparklineOf(data.weekly.lessons_completed, 'area'),
		  }

const riskFilter = computed<BatchFilter>(() =>
	ended.value ? 'behind' : 'at_risk'
)

const riskFilterLabel = computed<string>(() => {
	if (stage.value === riskFilter.value) return __('Show all students')
	return ended.value
		? __('Show students who did not finish')
		: __('Show students at risk')
})

const atRiskKpi = (data: BatchDashboardStats): Kpi => {
	const value = ended.value ? data.counts.behind : data.counts.at_risk
	return {
		key: 'at_risk',
		title: ended.value ? __('Incomplete') : KPI_TITLES().atRisk,
		value,
		color: value ? 'var(--ink-amber-7)' : undefined,
		delta: null,
		negativeIsBetter: true,
		fallbackCaption: ended.value
			? __('Did not finish all courses')
			: __('Low attendance or idle 14+ days'),
		select: filterBy(riskFilter.value, riskFilterLabel.value),
		sparkline: sparklineOf(data.weekly.idle, 'line'),
	}
}

const startsText = computed<string>(() => {
	const start = stats.data?.timeline.start_date
	return start
		? __('Starts {0}').format(dayjs(start).format('D MMM'))
		: __('The batch has not started')
})

const certifiedCaption = (data: BatchDashboardStats): string => {
	const { passed, scheduled } = data.evaluations
	if (passed || scheduled)
		return __('{0} passed · {1} scheduled').format(
			passed.toLocaleString(),
			scheduled.toLocaleString()
		)
	const close = data.timeline.evaluation_end_date
	if (close && !dayjs(close).isBefore(dayjs(), 'day'))
		return __('Evaluations close {0}').format(dayjs(close).format('D MMM'))
	return __('{0}% of students').format(
		String(percentOf(data.counts.certified, data.enrolled))
	)
}

const certifiedKpi = (data: BatchDashboardStats): Kpi => ({
	key: 'certified',
	title: KPI_TITLES().certified,
	value: data.counts.certified,
	target: data.enrolled,
	delta: percentChange(data.deltas.certificates),
	deltaSuffix: '%',
	fallbackCaption: certifiedCaption(data),
	sparkline: sparklineOf(data.weekly.certificates, 'bar'),
	select: filterBy('certified', __('Show certified students')),
})

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
	return [
		studentsKpi(data),
		onTrackKpi(data),
		atRiskKpi(data),
		certifiedKpi(data),
	]
})

const selectStage = (value: BatchFilter | null): void => {
	classFilter.value = null
	stage.value = toggleFilter(stage.value, value)
}

// One filter at a time: a class picked on the attendance chart replaces the
// stage, and picking the same part of the same bar again clears it.
const selectClass = (filter: ClassAttendanceFilter): void => {
	stage.value = null
	const current = classFilter.value
	classFilter.value =
		current?.liveClass === filter.liveClass &&
		current.attendance === filter.attendance
			? null
			: filter
}

// The enrollment, which get_batch_student_progress resolves within the batch;
// member_username is copied at enrollment and goes stale on a rename.
const openProgress = (student: BatchStudentRow): void => {
	currentStudent.value = student.enrollment
	showProgressModal.value = true
}

const reloadAfterRemoval = (): void => {
	stats.reload()
	reloadBatchDetails?.()
}

const reloadAfterSheetRemoval = (): void => {
	reloadAfterRemoval()
	getCachedResource(['batchDashboardStudents', batchName])?.reload()
}
</script>
