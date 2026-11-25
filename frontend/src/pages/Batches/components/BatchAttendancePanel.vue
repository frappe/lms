<template>
	<ChartCard class="flex flex-col">
		<div ref="root" class="min-h-0 flex-1">
			<BarChart
				:data="rows"
				x="label"
				:y="SERIES"
				stacked
				:title="__('Attendance')"
				:subtitle="subtitle"
				:loading="!attendance"
				:series-config="seriesConfig"
				:tooltip-columns="tooltipColumns"
				@select="selectClass"
			>
				<template #loading>
					<PanelSkeleton />
				</template>
			</BarChart>
		</div>
	</ChartCard>
</template>
<script setup lang="ts">
import { BarChart, ChartCard, useChartTokens } from 'frappe-ui/charts'
import type {
	ChartDatapointEvent,
	ChartTooltipColumn,
	SeriesStyle,
} from 'frappe-ui/charts'
import { computed, inject, ref } from 'vue'
import type dayjsType from 'dayjs'
import PanelSkeleton from '@/components/Dashboard/PanelSkeleton.vue'
import type { BatchAttendance, ClassAttendanceFilter } from '@/types'

type Series = 'attended' | 'missed'

interface ClassRow {
	name: string
	label: string
	title: string
	attended: number
	missed: number
}

const SERIES: Series[] = ['attended', 'missed']

// Past this many bars the numbers run into each other; the tooltip still has them.
const MOST_LABELLED_CLASSES = 12

const props = defineProps<{
	attendance: BatchAttendance | null
	enrolled: number
	active: ClassAttendanceFilter | null
}>()

const emit = defineEmits<{
	select: [filter: ClassAttendanceFilter]
}>()

const dayjs = inject<typeof dayjsType>('$dayjs')!
const root = ref<HTMLElement>()
const { tokens } = useChartTokens(root)

// Two classes on one day would share an axis label, so the second carries its
// start time.
const rows = computed<ClassRow[]>(() => {
	const seen = new Set<string>()
	return (props.attendance?.classes ?? []).map((row) => {
		let label = dayjs(row.date).format('D MMM')
		if (seen.has(label) && row.time)
			label = `${label} ${String(row.time).slice(0, 5)}`
		seen.add(label)
		return {
			name: row.name,
			label,
			title: row.title,
			attended: row.attended,
			missed: Math.max(props.enrolled - row.attended, 0),
		}
	})
})

const subtitle = computed<string>(() => {
	const attendance = props.attendance
	if (!attendance) return ''
	return __('{0} held · avg {1}% · select a bar to filter students').format(
		String(attendance.held),
		String(Math.round(attendance.rate ?? 0))
	)
})

// Every bar is the whole batch: attended at the base in the chart's blue,
// missed stacked on top in gray. Hovering a part keeps it and fades the rest,
// so each part reads as its own target to click.
const HOVER = {
	emphasis: { disabled: false, focus: 'self' },
	blur: { itemStyle: { opacity: 0.6 } },
	cursor: 'pointer',
}

// A hex color with an alpha appended; any other notation is left as it is.
const tint = (color: string, alpha: string): string =>
	/^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : color

// Missed sits on top in a faint wash of the palette's red: absence, but still a
// reading with a number on it.
const missedColor = computed<string>(() =>
	tint(tokens.value.categorical[9] ?? tokens.value.axisLine, '73')
)

// With a class picked as the filter, its part of its bar keeps full color and
// every other part pales to a tint of its own, so the pick stands out and every
// label stays on a light fill it can be read against.
const partColor =
	(
		series: Series,
		color: string,
		picked: string,
		active: ClassAttendanceFilter | null
	) =>
	({ dataIndex }: { dataIndex: number }): string => {
		if (!active) return color
		const row = rows.value[dataIndex]
		const isPick =
			row?.name === active.liveClass && active.attendance === series
		return isPick ? picked : tint(picked, '33')
	}

const seriesStyle = (
	series: Series,
	label: string,
	color: string,
	picked: string,
	active: ClassAttendanceFilter | null
) => ({
	label,
	color,
	showDataLabels: rows.value.length <= MOST_LABELLED_CLASSES,
	echartOptions: {
		...HOVER,
		itemStyle: { color: partColor(series, color, picked, active) },
	},
})

const seriesConfig = computed<Record<Series, SeriesStyle>>(() => {
	// Read here, not inside the color callback, so picking a class re-plots.
	const active = props.active
	const blue = tokens.value.categorical[0]!
	const red = tokens.value.categorical[9] ?? missedColor.value
	return {
		attended: seriesStyle('attended', __('Attended'), blue, blue, active),
		missed: seriesStyle('missed', __('Missed'), missedColor.value, red, active),
	}
})

const tooltipColumns = computed<ChartTooltipColumn[]>(() => [
	{ name: 'title', label: __('Class') },
])

const selectClass = (event: ChartDatapointEvent): void => {
	const row = event.row as ClassRow
	emit('select', {
		liveClass: row.name,
		label: `${row.label} · ${row.title}`,
		attendance: event.name === 'missed' ? 'missed' : 'attended',
	})
}
</script>
