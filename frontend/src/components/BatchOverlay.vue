<template>
	<div v-if="batch.data" class="border-2 rounded-md p-5 lg:w-72">
		<div
			v-if="batch.data.seat_count && seats_left > 0"
			class="text-sm bg-green-100 text-green-700 px-2 py-1 rounded-md"
			:class="
				batch.data.amount || batch.data.courses.length
					? 'float-right'
					: 'w-fit mb-4'
			"
		>
			{{ seats_left }}
			<span v-if="seats_left > 1">
				{{ __('Seats Left') }}
			</span>
			<span v-else-if="seats_left == 1">
				{{ __('Seat Left') }}
			</span>
		</div>
		<div
			v-else-if="batch.data.seat_count && seats_left <= 0"
			class="text-xs bg-red-100 text-red-700 float-right px-2 py-0.5 rounded-md"
		>
			{{ __('Sold Out') }}
		</div>
		<div
			v-if="batch.data.amount"
			class="text-lg font-semibold mb-3 text-ink-gray-9"
		>
			{{ formatNumberIntoCurrency(batch.data.amount, batch.data.currency) }}
		</div>
		<div
			v-if="batch.data.courses.length"
			class="flex items-center mb-3 text-ink-gray-7"
		>
			<BookOpen class="h-4 w-4 stroke-1.5 mr-2" />
			<span> {{ batch.data.courses.length }} {{ __('Courses') }} </span>
		</div>
		<DateRange
			:startDate="batch.data.start_date"
			:endDate="batch.data.end_date"
			class="mb-3"
		/>
		<div class="flex items-center mb-3 text-ink-gray-7">
			<Clock class="h-4 w-4 stroke-1.5 mr-2" />
			<span>
				{{ formatTime(batch.data.start_time) }} -
				{{ formatTime(batch.data.end_time) }}
			</span>
		</div>
		<div v-if="batch.data.timezone" class="flex items-center text-ink-gray-7">
			<Globe class="h-4 w-4 stroke-1.5 mr-2" />
			<span>
				{{ batch.data.timezone }}
			</span>
		</div>
		<div v-if="!readOnlyMode">
			<router-link
				v-if="isModerator || isStudent"
				:to="{
					name: 'Batch',
					params: {
						batchName: batch.data.name,
					},
				}"
			>
				<Button variant="solid" class="w-full mt-4">
					<span>
						{{ isModerator ? __('Manage Batch') : __('Visit Batch') }}
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
				v-else-if="
					batch.data.paid_batch &&
					batch.data.seats_left > 0 &&
					batch.data.accept_enrollments
				"
			>
				<Button v-if="!isStudent" class="w-full mt-4" variant="solid">
					<span>
						{{ __('Register Now') }}
					</span>
				</Button>
			</router-link>
			<Button
				variant="solid"
				class="w-full mt-2"
				v-else-if="
					batch.data.allow_self_enrollment &&
					batch.data.seats_left &&
					batch.data.accept_enrollments
				"
				@click="enrollInBatch()"
			>
				{{ __('Enroll Now') }}
			</Button>
			<router-link
				v-if="isModerator"
				:to="{
					name: 'BatchForm',
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
	</div>
</template>
<script setup>
import { inject, computed } from 'vue'
import { Badge, Button, createResource, toast } from 'frappe-ui'
import { BookOpen, Clock, Globe } from 'lucide-vue-next'
import { formatNumberIntoCurrency, formatTime } from '@/utils'
import DateRange from '@/components/Common/DateRange.vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const user = inject('$user')
const readOnlyMode = window.read_only_mode

const props = defineProps({
	batch: {
		type: Object,
		default: null,
	},
})

const enroll = createResource({
	url: 'lms.lms.utils.enroll_in_batch',
	makeParams(values) {
		return {
			batch: props.batch.data.name,
		}
	},
})

const enrollInBatch = () => {
	if (!user.data) {
		window.location.href = `/login?redirect-to=/batches/details/${props.batch.data.name}`
	}
	enroll.submit(
		{},
		{
			onSuccess(data) {
				toast.success(__('You have been enrolled in this batch'))
				router.push({
					name: 'Batch',
					params: {
						batchName: props.batch.data.name,
					},
				})
			},
		}
	)
}

const seats_left = computed(() => {
	if (props.batch.data?.seat_count) {
		return props.batch.data?.seat_count - props.batch.data?.students?.length
	}
	return null
})

const isStudent = computed(() => {
	return props.batch.data?.students?.includes(user.data?.name)
})

const isModerator = computed(() => {
	return user.data?.is_moderator
})
</script>
