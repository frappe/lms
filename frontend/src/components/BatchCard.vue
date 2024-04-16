<template>
	<div
		class="flex flex-col border border-gray-200 rounded-md p-4 h-full"
		style="min-height: 150px"
	>
		<Badge
			v-if="batch.seat_count && batch.seats_left > 0"
			theme="green"
			class="self-start mb-2"
		>
			{{ batch.seats_left }} {{ __('Seat Left') }}
		</Badge>
		<Badge
			v-else-if="batch.seat_count && batch.seats_left <= 0"
			theme="red"
			class="self-start mb-2"
		>
			{{ __('Sold Out') }}
		</Badge>
		<div class="text-xl font-semibold mb-1">
			{{ batch.title }}
		</div>
		<div class="short-introduction">
			{{ batch.description }}
		</div>
		<div class="mt-auto">
			<div v-if="batch.amount" class="font-semibold text-lg mb-4">
				{{ batch.price }}
			</div>
			<div class="flex items-center mb-3">
				<BookOpen class="h-4 w-4 stroke-1.5 mr-2 text-gray-700" />
				<span> {{ batch.courses.length }} {{ __('Courses') }} </span>
			</div>
			<DateRange
				:startDate="batch.start_date"
				:endDate="batch.end_date"
				class="mb-3"
			/>
			<div class="flex items-center">
				<Clock class="h-4 w-4 stroke-1.5 mr-2 text-gray-700" />
				<span>
					{{ formatTime(batch.start_time) }} - {{ formatTime(batch.end_time) }}
				</span>
			</div>
		</div>
	</div>
</template>
<script setup>
import { Badge } from 'frappe-ui'
import { formatTime } from '../utils'
import { Clock, BookOpen } from 'lucide-vue-next'
import DateRange from '@/components/Common/DateRange.vue'

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
	margin: 0.25rem 0 1.25rem;
	line-height: 1.5;
}
</style>
