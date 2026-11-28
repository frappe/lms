<template>
	<ul class="space-y-2.5 text-p-base text-ink-gray-8">
		<li
			v-for="fact in facts"
			:key="fact.icon"
			class="flex items-center gap-2.5"
		>
			<span class="size-4 shrink-0 text-ink-gray-5" :class="fact.icon" />
			<span :dir="fact.dir">{{ fact.text }}</span>
		</li>
	</ul>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatTime, getFormattedDateRange } from '@/utils'
import { formatTimezone, nextOccurrence } from '@/utils/timezone'

interface Fact {
	icon: string
	text: string
	dir?: string
}

/** The enrol card's facts as learners read them. */
const props = defineProps<{ batch: Record<string, any> }>()

const plural = (count: number | undefined, one: string, many: string) => {
	if (!count) return ''
	return count === 1 ? one : many.format(count)
}

const schedule = (batch: Record<string, any>): Fact[] => [
	{
		icon: 'lucide-calendar',
		text: getFormattedDateRange(batch.start_date, batch.end_date),
	},
	{
		icon: 'lucide-clock',
		text: `${formatTime(batch.start_time)} – ${formatTime(batch.end_time)}`,
		dir: 'auto',
	},
	{
		icon: 'lucide-globe',
		text: batch.timezone
			? formatTimezone(
					batch.timezone,
					nextOccurrence(batch.start_date, batch.end_date)
			  )
			: '',
	},
	{
		icon: batch.medium === 'Offline' ? 'lucide-map-pin' : 'lucide-video',
		text: batch.medium === 'Offline' ? __('In person') : __('Online'),
	},
]

const extras = (batch: Record<string, any>): Fact[] => [
	{
		icon: 'lucide-book-open',
		text: plural(batch.courses?.length, __('1 course'), __('{0} courses')),
	},
	{
		icon: 'lucide-armchair',
		text: plural(batch.seat_count, __('1 seat'), __('{0} seats')),
	},
	{
		icon: 'lucide-badge-check',
		text: batch.certification ? __('Certificate') : '',
	},
	{
		icon: 'lucide-user-check',
		text: batch.evaluation ? __('1-on-1 evaluation') : '',
	},
]

const facts = computed<Fact[]>(() =>
	[...schedule(props.batch), ...extras(props.batch)].filter((fact) => fact.text)
)
</script>
