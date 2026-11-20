<template>
	<ChartCard class="flex flex-col gap-3">
		<div
			v-if="view === 'funnel' || !showLessons"
			ref="root"
			class="relative min-h-0 flex-1 rounded-4 outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
			tabindex="0"
			role="group"
			:aria-label="
				__('Completion by stage. Use the arrow keys, Enter filters.')
			"
			@keydown="onKeydown"
			@blur="onBlur"
		>
			<FunnelChart
				:data="stages"
				category="label"
				value="students"
				class="!gap-4"
				:title="__('Completion')"
				:loading="!stats"
				:palette="palette"
				@select="selectStage"
			>
				<template #loading>
					<PanelSkeleton />
				</template>
				<template v-if="showLessons" #actions>
					<TabButtons v-model="view" :options="viewOptions" />
				</template>
			</FunnelChart>
			<p class="sr-only" aria-live="polite">{{ cursorText }}</p>
		</div>
		<div v-else class="min-h-0 flex-1">
			<HeatmapChart
				:data="lessonCells"
				x="lesson"
				y="chapter"
				value="share"
				:min="0"
				:max="100"
				show-data-labels
				:format="percent"
				:title="__('Completion')"
				:subtitle="lessonSubtitle"
				:loading="!stats"
				:echart-options="heatmapAxes"
			>
				<template #loading>
					<PanelSkeleton />
				</template>
				<template #actions>
					<TabButtons v-model="view" :options="viewOptions" />
				</template>
				<template #tooltip="{ rows }">
					<div v-if="rows[0]" class="flex min-w-48 flex-col gap-1.5">
						<p class="text-sm-medium text-ink-gray-9">
							{{ rows[0].number }} · {{ rows[0].title }}
						</p>
						<dl class="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-sm">
							<dt class="text-ink-gray-6">{{ __('Completion') }}</dt>
							<dd class="text-end tabular-nums text-ink-gray-9">
								{{ rows[0].share }}%
							</dd>
							<dt class="text-ink-gray-6">{{ __('Change') }}</dt>
							<dd
								class="text-end tabular-nums"
								:class="
									rows[0].isLargestDrop ? 'text-ink-red-7' : 'text-ink-gray-9'
								"
							>
								{{ rows[0].change }}
							</dd>
							<dt class="text-ink-gray-6">{{ __('Watch time') }}</dt>
							<dd class="text-end tabular-nums text-ink-gray-9">
								{{ rows[0].watchTime }}
							</dd>
						</dl>
					</div>
				</template>
			</HeatmapChart>
		</div>
	</ChartCard>
</template>
<script setup lang="ts">
import { TabButtons } from 'frappe-ui'
import {
	ChartCard,
	FunnelChart,
	HeatmapChart,
	useChartTokens,
} from 'frappe-ui/charts'
import type { FunnelStageEvent } from 'frappe-ui/charts'
import { computed, ref, watch } from 'vue'
import PanelSkeleton from '@/components/Dashboard/PanelSkeleton.vue'
import {
	filterForStep,
	formatChange,
	formatWatch,
	funnelPalette,
	funnelSteps,
	lessonShares,
	stepForFilter,
} from '@/utils/dashboard/charts'
import type { FunnelStep } from '@/utils/dashboard/charts'
import { useStepCursor } from '@/composables/dashboard/useDashboard'
import { lessonTitle } from '@/utils/dashboard/studentSheet'
import type {
	CourseDashboardStats,
	LessonCompletionRow,
	StudentFilter,
} from '@/types'

interface FunnelStage {
	key: FunnelStep
	label: string
	students: number
}

const props = defineProps<{
	stats: CourseDashboardStats | null
	showLessons: boolean
	activeFilter: StudentFilter | null
	lessons: LessonCompletionRow[]
}>()

const emit = defineEmits<{
	selectStage: [stage: StudentFilter | null]
}>()

const root = ref<HTMLElement>()
const { tokens } = useChartTokens(root)

const steps = computed<FunnelStep[]>(() =>
	funnelSteps(Boolean(props.stats?.has_evaluation))
)

const stages = computed<FunnelStage[]>(() => {
	const funnel = props.stats?.funnel
	if (!funnel) return []
	const labels: Record<FunnelStep, string> = {
		enrolled: __('Enrolled'),
		started: __('Started'),
		halfway: __('Halfway'),
		finished: __('Finished'),
		evaluation_requested: __('Evaluation'),
		certified: __('Certified'),
	}
	return steps.value.map((key) => ({
		key,
		label: labels[key],
		students: funnel[key],
	}))
})

const { cursor, onKeydown, onBlur } = useStepCursor(
	computed(() => stages.value.length),
	(index) => emit('selectStage', filterForStep(stages.value[index]!.key))
)

// The step under the keyboard cursor lights up the way an applied one does.
const palette = computed<string[] | undefined>(() =>
	funnelPalette(
		steps.value,
		cursor.value === null
			? stepForFilter(props.activeFilter)
			: stages.value[cursor.value]!.key,
		tokens.value
	)
)

const cursorText = computed<string>(() => {
	const stage = cursor.value === null ? null : stages.value[cursor.value]
	return stage
		? __('{0}: {1} students').format(
				stage.label,
				stage.students.toLocaleString()
		  )
		: ''
})

type View = 'funnel' | 'lessons'

// Both read how far students got: by milestone, or lesson by lesson. The choice
// is kept for the next visit.
const VIEW_KEY = 'lms:course-progress-view'
const view = ref<View>(
	localStorage.getItem(VIEW_KEY) === 'lessons' ? 'lessons' : 'funnel'
)
watch(view, (value) => localStorage.setItem(VIEW_KEY, value))

const viewOptions = computed(() => [
	{ label: __('Stages'), value: 'funnel' },
	{ label: __('Lessons'), value: 'lessons' },
])

const percent = (value: number): string => `${Math.round(value)}%`

const shares = computed(() =>
	lessonShares(props.lessons, props.stats?.enrolled ?? 0)
)

// A row per chapter and a column per lesson in it, so each chapter reads left
// to right and the cell where students stop stands out by its color.
const lessonCells = computed(() =>
	shares.value.map((line) => {
		const [chapter, lesson] = line.number.split('.')
		return {
			chapter: chapter ?? '',
			lesson: lesson ?? '',
			share: line.share,
			number: line.number,
			title: lessonTitle(line.title),
			change: formatChange(line.drop),
			watchTime: formatWatch(line.watchSeconds),
			isLargestDrop: line.isLargestDrop,
		}
	})
)

// Both cuts are plain numbers, so each axis says which it counts.
const heatmapAxes = computed(() => {
	const title = {
		nameLocation: 'middle',
		nameTextStyle: { color: tokens.value.axisTitle, fontSize: 12 },
		// Every chapter and lesson number, even where echarts would thin them.
		axisLabel: { interval: 0 },
	}
	return {
		xAxis: { ...title, name: __('Lesson'), nameGap: 26 },
		yAxis: { ...title, name: __('Chapter'), nameGap: 22 },
	}
})

const lessonSubtitle = computed<string>(() => {
	const largest = shares.value.find((line) => line.isLargestDrop)
	return largest
		? __('Biggest drop at {0} (−{1} pts)').format(
				largest.number,
				String(largest.drop)
		  )
		: __('Share of enrolled students')
})

const selectStage = (event: FunnelStageEvent): void => {
	emit('selectStage', filterForStep((event.row as FunnelStage).key))
}
</script>
