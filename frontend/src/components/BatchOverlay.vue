<template>
	<div class="shadow rounded-md p-5" style="width: 300px">
		<Badge
			v-if="batch.doc.seat_count && seats_left > 0"
			theme="green"
			class="self-start mb-2 float-right"
		>
			{{ seats_left }} {{ __('Seat Left') }}
		</Badge>
		<Badge
			v-else-if="batch.doc.seat_count && seats_left <= 0"
			theme="red"
			class="self-start mb-2 float-right"
		>
			{{ __('Sold Out') }}
		</Badge>
		<div v-if="batch.doc.amount" class="text-lg font-semibold mb-3">
			{{ formatNumberIntoCurrency(batch.doc.amount, batch.doc.currency) }}
		</div>
		<div class="flex items-center mb-3">
			<BookOpen class="h-4 w-4 stroke-1.5 mr-2 text-gray-700" />
			<span> {{ batch.doc.courses.length }} {{ __('Courses') }} </span>
		</div>
		<div class="flex items-center mb-3">
			<Calendar class="h-4 w-4 stroke-1.5 mr-2 text-gray-700" />
			<span>
				{{ dayjs(batch.doc.start_date).format('DD MMM YYYY') }} -
				{{ dayjs(batch.doc.end_date).format('DD MMM YYYY') }}
			</span>
		</div>
		<div class="flex items-center">
			<Clock class="h-4 w-4 stroke-1.5 mr-2 text-gray-700" />
			<span>
				{{ formatTime(batch.doc.start_time) }} -
				{{ formatTime(batch.doc.end_time) }}
			</span>
		</div>
		<Button v-if="user?.data?.is_moderator" class="w-full mt-4">
			<span>
				{{ __('Manage Batch') }}
			</span>
		</Button>
		<Button
			v-else-if="batch.doc.paid_batch"
			class="w-full mt-4"
			variant="solid"
		>
			<span>
				{{ __('Register Now') }}
			</span>
		</Button>
		<Button v-if="user?.data?.is_moderator" class="w-full mt-2">
			<span>
				{{ __('Edit') }}
			</span>
		</Button>
	</div>
</template>
<script setup>
import { formatNumberIntoCurrency, formatTime } from '@/utils'
import { BookOpen, Calendar, Clock } from 'lucide-vue-next'
import { inject, computed } from 'vue'
import { Badge, Button } from 'frappe-ui'

const dayjs = inject('$dayjs')
const user = inject('$user')

const props = defineProps({
	batch: {
		type: Object,
		default: null,
	},
})

const seats_left = computed(() => {
	if (props.batch.doc.seat_count) {
		return props.batch.doc.seat_count - props.batch.doc.students.length
	}
	return null
})
</script>
