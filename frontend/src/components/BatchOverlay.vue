<template>
	<div v-if="batch.data" class="shadow rounded-md p-5" style="width: 300px">
		<Badge
			v-if="batch.data.seat_count && seats_left > 0"
			theme="green"
			class="self-start mb-2 float-right"
		>
			{{ seats_left }} {{ __('Seat Left') }}
		</Badge>
		<Badge
			v-else-if="batch.data.seat_count && seats_left <= 0"
			theme="red"
			class="self-start mb-2 float-right"
		>
			{{ __('Sold Out') }}
		</Badge>
		<div v-if="batch.data.amount" class="text-lg font-semibold mb-3">
			{{ formatNumberIntoCurrency(batch.data.amount, batch.data.currency) }}
		</div>
		<div class="flex items-center mb-3">
			<BookOpen class="h-4 w-4 stroke-1.5 mr-2 text-gray-700" />
			<span> {{ batch.data.courses.length }} {{ __('Courses') }} </span>
		</div>
		<div class="flex items-center mb-3">
			<Calendar class="h-4 w-4 stroke-1.5 mr-2 text-gray-700" />
			<span>
				{{ dayjs(batch.data.start_date).format('DD MMM YYYY') }} -
				{{ dayjs(batch.data.end_date).format('DD MMM YYYY') }}
			</span>
		</div>
		<div class="flex items-center">
			<Clock class="h-4 w-4 stroke-1.5 mr-2 text-gray-700" />
			<span>
				{{ formatTime(batch.data.start_time) }} -
				{{ formatTime(batch.data.end_time) }}
			</span>
		</div>
		<router-link
			v-if="user?.data?.is_moderator"
			:to="{
				name: 'Batch',
				params: {
					batchName: batch.data.name,
				},
			}"
		>
			<Button variant="solid" class="w-full mt-4">
				<span>
					{{ __('Manage Batch') }}
				</span>
			</Button>
		</router-link>
		<router-link
			:to="{
				name: 'Billing',
				params: {
					type: 'batch',
					name: batch.data.name,
				},
			}"
			v-else-if="batch.data.paid_batch"
		>
			<Button class="w-full mt-4" variant="solid">
				<span>
					{{ __('Register Now') }}
				</span>
			</Button>
		</router-link>
		<Button
			variant="solid"
			class="w-full mt-2"
			v-else-if="batch.data.allow_self_enrollment"
		>
			{{ __('Enroll Now') }}
		</Button>
		<router-link
			v-if="user?.data?.is_moderator"
			:to="{
				name: 'BatchCreation',
				params: {
					batchName: batch.data.name,
				},
			}"
		>
			<Button class="w-full mt-2">
				<span>
					{{ __('Edit') }}
				</span>
			</Button>
		</router-link>
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
	if (props.batch.data?.seat_count) {
		return props.batch.data?.seat_count - props.batch.data?.students?.length
	}
	return null
})
</script>
