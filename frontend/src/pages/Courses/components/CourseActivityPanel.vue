<template>
	<ChartCard v-if="isQuiet" class="flex flex-col">
		<ChartContainer :title="__('Activity')" :empty="true" class="min-h-24">
			<template #empty>
				<span class="text-p-sm text-ink-gray-6">
					{{
						__('No enrollments, lessons or certificates in the last 12 weeks.')
					}}
				</span>
			</template>
		</ChartContainer>
	</ChartCard>
	<ChartCard v-else v-bind="$attrs">
		<AreaChart
			:data="rows"
			x="week"
			:y="SERIES"
			:title="__('Activity')"
			:subtitle="__('Per week, last 12 weeks')"
			:loading="!weekly"
			:x-axis="{ type: 'time', timeGrain: 'month' }"
			:y-axis="{ echartOptions: { minInterval: 1 } }"
			:series-config="seriesConfig"
		>
			<template #loading>
				<PanelSkeleton />
			</template>
		</AreaChart>
	</ChartCard>
</template>
<script setup lang="ts">
import { AreaChart, ChartCard, ChartContainer } from 'frappe-ui/charts'
import type { SeriesStyle } from 'frappe-ui/charts'
import { computed } from 'vue'
import PanelSkeleton from '@/components/Dashboard/PanelSkeleton.vue'
import type { CourseWeeklyTrends } from '@/types'

type Series = 'enrollments' | 'lessons_completed' | 'certificates'

interface WeekRow {
	week: string
	enrollments: number
	lessons_completed: number
	certificates: number
}

// Sizing classes from the page are for the chart; the sentence keeps its height.
defineOptions({ inheritAttrs: false })

const SERIES: Series[] = ['enrollments', 'lessons_completed', 'certificates']

const props = defineProps<{
	weekly: CourseWeeklyTrends | null
}>()

const rows = computed<WeekRow[]>(() => {
	const weekly = props.weekly
	if (!weekly) return []
	return weekly.weeks.map((week, index) => ({
		week,
		enrollments: weekly.enrollments[index] ?? 0,
		lessons_completed: weekly.lessons_completed[index] ?? 0,
		certificates: weekly.certificates[index] ?? 0,
	}))
})

// An empty chart is axes with nothing on them: a sentence says it in less.
const isQuiet = computed<boolean>(
	() =>
		Boolean(props.weekly) &&
		rows.value.every(
			(row) => !row.enrollments && !row.lessons_completed && !row.certificates
		)
)

const seriesConfig = computed<Record<Series, SeriesStyle>>(() => ({
	enrollments: { label: __('Enrollments') },
	lessons_completed: { label: __('Lessons') },
	certificates: { label: __('Certificates') },
}))
</script>
