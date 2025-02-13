<template>
	<div
		class="flex flex-col border-2 hover:bg-surface-gray-2 rounded-md p-4 h-full"
		style="min-height: 150px"
	>
		<div class="text-lg leading-5 font-semibold mb-2 text-ink-gray-9">
			{{ batch.title }}
		</div>
		<div
			v-if="batch.seat_count && batch.seats_left > 0"
			class="text-xs bg-green-100 text-green-700 self-start px-2 py-0.5 rounded-md"
		>
			{{ batch.seats_left }}
			<span v-if="batch.seats_left > 1">
				{{ __('Seats Left') }}
			</span>
			<span v-else-if="batch.seats_left == 1">
				{{ __('Seat Left') }}
			</span>
		</div>
		<div
			v-else-if="batch.seat_count && batch.seats_left <= 0"
			class="text-xs bg-red-100 text-red-700 self-start px-2 py-0.5 rounded-md"
		>
			{{ __('Sold Out') }}
		</div>
		<div class="short-introduction text-sm text-ink-gray-7">
			{{ batch.description }}
		</div>
		<div v-if="batch.amount" class="font-semibold text-ink-gray-9 mb-4">
			{{ batch.price }}
		</div>
		<div class="flex flex-col space-y-2 mt-auto">
			<DateRange
				:startDate="batch.start_date"
				:endDate="batch.end_date"
				class="text-sm text-ink-gray-7"
			/>
			<div class="flex items-center text-sm text-ink-gray-7">
				<Clock class="h-4 w-4 stroke-1.5 mr-2 text-ink-gray-7" />
				<span>
					{{ formatTime(batch.start_time) }} - {{ formatTime(batch.end_time) }}
				</span>
			</div>
			<div
				v-if="batch.timezone"
				class="flex items-center text-sm text-ink-gray-7"
			>
				<Globe class="h-4 w-4 stroke-1.5 mr-2 text-ink-gray-5" />
				<span>
					{{ batch.timezone }}
				</span>
			</div>
		</div>
		<div
			v-if="batch.instructors?.length"
			class="flex avatar-group overlap mt-4"
		>
			<div
				class="h-6 mr-1"
				:class="{ 'avatar-group overlap': batch.instructors.length > 1 }"
			>
				<UserAvatar
					v-for="instructor in batch.instructors"
					:user="instructor"
				/>
			</div>
			<CourseInstructors :instructors="batch.instructors" />
		</div>
	</div>
</template>
<script setup>
import { Badge } from 'frappe-ui'
import { formatTime } from '../utils'
import { Clock, BookOpen, Globe } from 'lucide-vue-next'
import DateRange from '@/components/Common/DateRange.vue'
import CourseInstructors from '@/components/CourseInstructors.vue'
import UserAvatar from '@/components/UserAvatar.vue'

const props = defineProps({
	batch: {
		type: Object,
		default: null,
	},
})
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
	margin-left: calc(-8px);
}
</style>
