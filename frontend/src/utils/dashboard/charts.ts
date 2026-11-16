import { paletteColors } from 'frappe-ui/charts'
import type { ChartTokens, NumberCardSparkline } from 'frappe-ui/charts'
import type {
	BatchFilter,
	BatchFunnel,
	CourseFunnel,
	LessonCompletionRow,
	PeriodCounts,
	StudentFilter,
} from '@/types'

// A click on the step already applied takes the filter off again.
export const toggleFilter = <Filter extends string>(
	current: Filter | null,
	picked: Filter | null
): Filter | null => (current === picked ? null : picked)

// Each funnel step filters the students to everyone who reached it; a step
// mapped to null is everyone, so it clears the filter.
export const funnelFilters = <Step extends string, Filter extends string>(
	steps: Step[],
	filters: Record<Step, Filter | null>
) => ({
	filterForStep: (step: Step): Filter | null => filters[step],
	stepForFilter: (filter: Filter | null): Step | null =>
		filter ? steps.find((step) => filters[step] === filter) ?? null : null,
})

// The funnel's own ramp, palest first; with a step applied as the filter, the
// other steps fade to the gridline gray so the applied one stands out.
export const funnelPalette = <Step extends string>(
	steps: Step[],
	active: Step | null,
	tokens: ChartTokens
): string[] | undefined => {
	if (!active) return undefined
	const ramp = paletteColors('sequential', tokens, steps.length)
		.slice()
		.reverse()
	return steps.map((step, index) =>
		step === active ? ramp[index]! : tokens.gridline
	)
}

export type BatchFunnelStep = keyof BatchFunnel

export const BATCH_FUNNEL_STEPS: BatchFunnelStep[] = [
	'enrolled',
	'started',
	'completed',
	'evaluation_requested',
	'certified',
]

export const {
	filterForStep: batchFilterForStep,
	stepForFilter: batchStepForFilter,
} = funnelFilters<BatchFunnelStep, BatchFilter>(BATCH_FUNNEL_STEPS, {
	enrolled: null,
	started: 'started',
	completed: 'completed',
	evaluation_requested: 'evaluation_requested',
	certified: 'certified',
})

export type FunnelStep = keyof CourseFunnel

export const FUNNEL_STEPS: FunnelStep[] = [
	'enrolled',
	'started',
	'halfway',
	'finished',
	'evaluation_requested',
	'certified',
]

export const { filterForStep, stepForFilter } = funnelFilters<
	FunnelStep,
	StudentFilter
>(FUNNEL_STEPS, {
	enrolled: null,
	started: 'started',
	halfway: 'halfway',
	finished: 'finished',
	evaluation_requested: 'evaluation_requested',
	certified: 'certified',
})

// A course without certification by evaluation goes from finishing straight
// to the certificate, so its funnel has no request step.
export const funnelSteps = (hasEvaluation: boolean): FunnelStep[] =>
	hasEvaluation
		? FUNNEL_STEPS
		: FUNNEL_STEPS.filter((step) => step !== 'evaluation_requested')

// Change against the previous window as a percentage of it. No previous
// reading, or a zero one, has no ratio to give.
export const percentChange = ({
	current,
	previous,
}: PeriodCounts): number | null => {
	if (current === null || !previous) return null
	return Math.round(((current - previous) / previous) * 100)
}

// Change in a reading that is already a percentage or a score: the difference
// itself, to one decimal, so a rate moving from 40% to 50% reads +10, not +25%.
export const pointChange = ({
	current,
	previous,
}: PeriodCounts): number | null => {
	if (current === null || previous === null) return null
	return Math.round((current - previous) * 10) / 10
}

// A trend that never moves, all zeros included, draws as a flat line or a row
// of equal bars: a trend that is not there.
export const sparklineOf = (
	data: (number | null)[] | undefined,
	type: NumberCardSparkline['type']
): NumberCardSparkline | undefined => {
	const readings = new Set(data?.filter((value) => value !== null))
	return data && readings.size > 1 ? { data, type } : undefined
}

export interface LessonShare {
	key: string
	number: string
	title: string
	share: number
	// Points lost from the previous lesson's share; null for the first lesson.
	drop: number | null
	isLargestDrop: boolean
	watchSeconds: number | null
}

// Each lesson's share of the enrolled students who completed it, and where
// the share fell furthest from one lesson to the next.
export const lessonShares = (
	lessons: LessonCompletionRow[],
	enrolled: number
): LessonShare[] => {
	const shareOf = (count: number): number =>
		enrolled ? Math.round((count / enrolled) * 100) : 0
	const shares = lessons.map((lesson) => shareOf(lesson.completion_count))
	const drops = shares.map((share, index) =>
		index ? shares[index - 1]! - share : null
	)
	const largest = Math.max(
		0,
		...drops.filter((drop): drop is number => drop !== null)
	)
	return lessons.map((lesson, index) => {
		const drop = drops[index] ?? null
		return {
			key: lesson.lesson_name,
			number: `${lesson.chapter_idx}.${lesson.idx}`,
			title: lesson.title,
			share: shares[index]!,
			drop,
			isLargestDrop: drop !== null && drop > 0 && drop === largest,
			watchSeconds: lesson.watch_seconds ?? null,
		}
	})
}

export const NO_READING = '—'

// Points lost from the previous lesson's share; a gain shows with a plus.
export const formatChange = (drop: number | null): string => {
	if (drop === null) return NO_READING
	if (drop === 0) return '0'
	return `${drop > 0 ? '−' : '+'}${Math.abs(drop)}`
}

export const formatWatch = (seconds: number | null | undefined): string => {
	if (seconds === null || seconds === undefined) return NO_READING
	const minutes = Math.floor(seconds / 60)
	const rest = String(Math.round(seconds % 60)).padStart(2, '0')
	return minutes ? `${minutes}m ${rest}s` : `${rest}s`
}
