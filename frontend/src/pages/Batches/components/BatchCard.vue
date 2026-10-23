<template>
	<div
		class="relative isolate flex flex-col border hover:border-outline-gray-3 rounded-5 p-4 h-full"
		style="min-height: 150px"
	>
		<div class="text-lg-semibold leading-5 mb-2 text-ink-gray-9">
			<CardLink :to="to">{{ batch.title }}</CardLink>
		</div>
		<Badge
			v-if="batch.seat_count && batch.seats_left > 0"
			variant="subtle"
			theme="green"
			size="md"
			class="self-start"
			:label="
				batch.seats_left +
				' ' +
				(batch.seats_left > 1 ? __('Seats Left') : __('Seat Left'))
			"
		/>
		<Badge
			v-else-if="batch.seat_count && batch.seats_left <= 0"
			variant="subtle"
			theme="red"
			size="md"
			class="self-start"
			:label="__('Sold Out')"
		/>
		<div class="short-introduction text-sm text-ink-gray-7">
			{{ batch.description }}
		</div>
		<div v-if="batch.amount" class="font-semibold text-ink-gray-9 mb-4">
			{{ batch.price }}
		</div>
		<div class="flex flex-col space-y-2 mt-auto">
			<div class="flex items-center text-sm text-ink-gray-7">
				<span class="lucide-calendar h-4 w-4 me-2" />
				<span>{{
					getFormattedDateRange(batch.start_date, batch.end_date)
				}}</span>
			</div>
			<div class="flex items-center text-sm text-ink-gray-7">
				<span class="lucide-clock h-4 w-4 me-2 text-ink-gray-7" />
				<span dir="ltr">
					{{ formatTime(batch.start_time) }} - {{ formatTime(batch.end_time) }}
				</span>
			</div>
			<div
				v-if="batch.timezone"
				class="flex items-center text-sm text-ink-gray-7"
			>
				<span class="lucide-globe h-4 w-4 me-2 text-ink-gray-5" />
				<span>
					{{
						formatTimezone(
							batch.timezone,
							nextOccurrence(batch.start_date, batch.end_date)
						)
					}}
				</span>
			</div>
		</div>
		<Tooltip v-if="batch.progress != null" :disabled="!breakdown.length">
			<div
				class="relative z-10 flex flex-col gap-1.5 mt-4 rounded-4 outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-5"
				:tabindex="breakdown.length ? 0 : undefined"
			>
				<div class="flex items-center justify-between text-sm">
					<span class="text-ink-gray-7">{{ __('Progress') }}</span>
					<span class="font-medium tabular-nums text-ink-gray-9">
						{{ percent(batch.progress) }}
					</span>
				</div>
				<ProgressBar
					:progress="batch.progress"
					:label="__('Batch progress')"
					:tooltip="false"
				/>
			</div>
			<template #content>
				<div class="flex flex-col gap-1 py-0.5">
					<div
						v-for="(part, index) in breakdown"
						:key="index"
						class="flex items-center gap-4"
					>
						<span class="max-w-[200px] truncate">{{ part.title }}</span>
						<span class="w-9 shrink-0 ms-auto text-end tabular-nums">
							{{ percent(part.progress) }}
						</span>
					</div>
				</div>
			</template>
		</Tooltip>
		<div
			v-if="batch.instructors?.length"
			class="flex avatar-group overlap mt-4"
		>
			<div
				class="relative z-10 h-6 me-1"
				:class="{ 'avatar-group overlap': batch.instructors.length > 1 }"
			>
				<UserAvatar
					v-for="instructor in batch.instructors"
					:key="instructor.username"
					:user="instructor"
				/>
			</div>
			<CourseInstructors :instructors="batch.instructors" />
		</div>
	</div>
</template>
<script setup>
import { computed } from 'vue'
import { Badge, Tooltip } from 'frappe-ui'
import { formatTime, getFormattedDateRange } from '@/utils'
import { formatTimezone, nextOccurrence } from '@/utils/timezone'
import CardLink from '@/components/CardLink.vue'
import CourseInstructors from '@/components/CourseInstructors.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import ProgressBar from '@/components/ProgressBar.vue'

const props = defineProps({
	batch: {
		type: Object,
		default: null,
	},
	to: {
		type: [Object, String],
		default: null,
	},
})

const breakdown = computed(() => props.batch.progress_breakdown || [])

const percent = (value) => `${Math.round(value)}%`
</script>
<style>
.short-introduction {
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	text-overflow: ellipsis;
	width: 100%;
	overflow: hidden;
	margin: 0.25rem 0 1rem;
	line-height: 1.5;
}

.avatar-group {
	display: inline-flex;
	align-items: center;
}

.avatar-group .avatar {
	transition: margin 0.1s ease-in-out;
}

.avatar-group.overlap .avatar + .avatar {
	margin-inline-start: calc(-8px);
}
</style>
