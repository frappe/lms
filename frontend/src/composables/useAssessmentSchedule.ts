import { computed, onUnmounted, ref, watch } from 'vue'
import { getScheduleBlockReason } from '@/utils/schedule'

export interface ScheduledAssessment {
	enable_scheduling?: 0 | 1
	schedule_start?: string | null
	schedule_start_iso?: string | null
	schedule_end?: string | null
	schedule_end_iso?: string | null
}

type BlockReason = 'not_started' | 'ended' | null

const CLOCK_INTERVAL_MS = 15000

export const formatScheduleDate = (
	value: string | null | undefined
): string => {
	if (!value) return ''
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return String(value)
	return date.toLocaleString()
}

// The clock ticks only while scheduling is on, so an unscheduled card leaves
// no interval behind.
function useScheduleClock(enabled: () => unknown) {
	const now = ref(new Date())
	let clock: ReturnType<typeof setInterval> | null = null

	const stop = () => {
		if (clock) clearInterval(clock)
		clock = null
	}

	watch(enabled, (on) => {
		stop()
		if (!on) return
		now.value = new Date()
		clock = setInterval(() => {
			now.value = new Date()
		}, CLOCK_INTERVAL_MS)
	})
	onUnmounted(stop)
	return now
}

export function useAssessmentSchedule(
	assessment: () => ScheduledAssessment | null | undefined,
	messages: { opensOn: (date: string) => string; ended: () => string }
) {
	const now = useScheduleClock(() => assessment()?.enable_scheduling)
	const start = () =>
		assessment()?.schedule_start_iso || assessment()?.schedule_start

	const scheduleBlockReason = computed<BlockReason>(() =>
		getScheduleBlockReason(
			assessment()?.enable_scheduling,
			start(),
			assessment()?.schedule_end_iso || assessment()?.schedule_end,
			now.value
		)
	)
	const scheduleBlocked = computed(() => !!scheduleBlockReason.value)
	const scheduleMessage = computed(() => {
		if (scheduleBlockReason.value === 'not_started')
			return messages.opensOn(formatScheduleDate(start()))
		if (scheduleBlockReason.value === 'ended') return messages.ended()
		return ''
	})

	return { scheduleBlockReason, scheduleBlocked, scheduleMessage }
}
