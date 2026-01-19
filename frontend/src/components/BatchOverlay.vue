<template>
	<div v-if="batch.data" class="border rounded-xl w-full flex items-center">
		<img v-if="batch.data.meta_image" :src="batch.data.meta_image"
			class="w-32 h-32 object-cover rounded-tl-xl rounded-bl-xl" />
		<div class="p-5 flex-1">
			<!-- <div v-if="batch.data.seat_count && seats_left > 0"
				class="text-sm bg-green-100 text-green-700 px-2 py-1 rounded-md" :class="batch.data.amount || batch.data.courses.length
					? 'float-right'
					: 'w-fit mb-4'
					">
				{{ seats_left }}
				<span v-if="seats_left > 1">
					{{ __('Seats Left') }}
				</span>
				<span v-else-if="seats_left == 1">
					{{ __('Seat Left') }}
				</span>
			</div>
			<div v-else-if="batch.data.seat_count && seats_left <= 0"
				class="text-xs bg-red-100 text-red-700 float-right px-2 py-0.5 rounded-md">
				{{ __('Sold Out') }}
			</div> -->
			<div>
				<div class="text-lg leading-5 font-semibold mb-2 text-gray-900">
					{{ batch.data.title }}
				</div>
				<div class="short-introduction text-sm text-gray-600 !mb-3">
					{{ batch.data.description }}
				</div>
			</div>
			<div v-if="batch.data.amount" class="text-lg font-semibold mb-3 text-ink-gray-9">
				{{ formatNumberIntoCurrency(batch.data.amount, batch.data.currency) }}
			</div>
			<div class="flex items-center space-x-24 text-md">
				<!-- <div v-if="batch.data.courses.length" class="flex items-center mb-3 text-gray-600">
				<BookOpen class="h-4 w-4 stroke-1.5 mr-2" />
				<span> {{ batch.data.courses.length }} {{ __('Courses') }} </span>
			</div> -->
				<div class="flex items-center space-x-2">
					<DateRange :startDate="batch.data.start_date" :endDate="batch.data.end_date" />
					<span class="text-gray-600" v-if="batch.data.medium">• {{ batch.data.medium }}</span>
				</div>

				<div class="flex items-center text-gray-600">
					<ClockIcon class="h-4 w-4 stroke-1.5 mr-2" />
					<span>
						{{ formatTime(batch.data.start_time) }} -
						{{ formatTime(batch.data.end_time) }}
					</span>
				</div>
				<!-- <div v-if="batch.data.timezone" class="flex items-center text-gray-600">
				<Globe class="h-4 w-4 stroke-1.5 mr-2" />
				<span>
					{{ batch.data.timezone }}
				</span>
			</div> -->
			</div>
		</div>
		<div v-if="!readOnlyMode" class="p-5">
			<div class="flex space-x-3" v-if="canAccessBatch">
				<router-link v-if="canEditBatch" :to="{
					name: 'BatchForm',
					params: {
						batchName: batch.data.name,
					},
				}">
					<button
						class="w-full bg-primary-500 hover:bg-primary-700 px-4 min-h-12 py-4 text-white rounded-md flex items-center space-x-2 justify-center">
						<Pencil class="size-4 stroke-1.5" />
					</button>
				</router-link>
				<router-link :to="{
					name: 'Batch',
					params: {
						batchName: batch.data.name,
					},
				}">
					<button
						class="w-full bg-primary-500 hover:bg-primary-700 px-4 py-3 text-white rounded-md flex items-center space-x-2 justify-center">
						<span>
							{{ isStudent ? __('Visit Batches') : __('Manage Batch') }}
						</span>
					</button>
				</router-link>
			</div>
			<router-link :to="{
				name: 'Billing',
				params: {
					type: 'batch',
					name: batch.data.name,
				},
			}" v-else-if="
				batch.data.paid_batch &&
				batch.data.seats_left > 0 &&
				batch.data.accept_enrollments
			">
				<button v-if="!isStudent"
					class="w-full bg-primary-500 hover:bg-primary-700 px-4 py-3 text-white rounded-md flex items-center space-x-2 justify-center mt-4">
					<span>
						{{ __('Register Now') }}
					</span>
				</button>
			</router-link>
			<button variant="solid"
				class="w-full bg-primary-500 hover:bg-primary-700 px-4 py-3 text-white rounded-md flex items-center space-x-2 justify-center mt-2"
				v-else-if="
					batch.data.allow_self_enrollment &&
					batch.data.seats_left &&
					batch.data.accept_enrollments
				" @click="enrollInBatch()">
				{{ __('Enroll Now') }}
			</button>
		</div>
	</div>
</template>
<script setup>
import { inject, computed } from 'vue'
import { Button, createResource, toast } from 'frappe-ui'
import {
	BookOpen,
	Clock,
	CreditCard,
	Globe,
	GraduationCap,
	LogIn,
	Pencil,
	Settings,
} from 'lucide-vue-next'
import { formatNumberIntoCurrency, formatTime } from '@/utils'
import DateRange from '@/components/Common/DateRange.vue'
import { useRouter } from 'vue-router'
import ClockIcon from '@/components/icons/ClockIcon.vue'

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

const isEvaluator = computed(() => {
	return user.data?.is_evaluator
})

const isInstructor = computed(() => {
	return (
		props.batch.data?.instructors?.filter(
			(instructor) => instructor.name === user.data?.name
		).length > 0
	)
})

const canAccessBatch = computed(() => {
	return isModerator.value || isStudent.value || isEvaluator.value
})

const canEditBatch = computed(() => {
	return isModerator.value || isInstructor.value
})
</script>
