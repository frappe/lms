<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('Schedule Evaluation'),
			size: 'xl',
			actions: [
				{
					label: __('Submit'),
					variant: 'solid',
					onClick: (close) => submitEvaluation(close),
				},
			],
		}"
	>
		<template #body-content>
			<div class="flex flex-col gap-4">
				<div>
					<div class="mb-1.5 text-sm text-ink-gray-5">
						{{ __('Course') }}
					</div>
					<Select v-model="evaluation.course" :options="getCourses()" />
				</div>
				<div>
					<div class="mb-1.5 text-sm text-ink-gray-5">
						{{ __('Date') }}
					</div>
					<FormControl
						type="date"
						v-model="evaluation.date"
						:min="
							dayjs()
								.add(dayjs.duration({ days: 1 }))
								.format('YYYY-MM-DD')
						"
					/>
				</div>
				<div v-if="slots.data?.length">
					<div class="mb-1.5 text-sm text-ink-gray-5">
						{{ __('Select a slot') }}
					</div>
					<div class="grid grid-cols-2 gap-2">
						<div v-for="slot in slots.data">
							<div
								class="text-base text-center border rounded-md text-ink-gray-8 bg-surface-gray-3 p-2 cursor-pointer"
								@click="saveSlot(slot)"
								:class="{
									'border-outline-gray-4':
										evaluation.start_time == slot.start_time,
								}"
							>
								{{ formatTime(slot.start_time) }} -
								{{ formatTime(slot.end_time) }}
							</div>
						</div>
					</div>
				</div>
				<div
					v-else-if="evaluation.course && evaluation.date"
					class="text-sm italic text-ink-red-4"
				>
					{{ __('No slots available for this date.') }}
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import { Dialog, createResource, Select, FormControl } from 'frappe-ui'
import { reactive, watch, inject } from 'vue'
import { formatTime } from '@/utils/'

const user = inject('$user')
const dayjs = inject('$dayjs')
const show = defineModel()
const evaluations = defineModel('reloadEvals')

const props = defineProps({
	courses: {
		type: Array,
		default: [],
	},
	batch: {
		type: String,
		default: null,
	},
	endDate: {
		type: String,
		default: null,
	},
})

let evaluation = reactive({
	course: '',
	date: '',
	start_time: '',
	end_time: '',
	day: '',
	batch: props.batch,
	member: user.data.name,
})

const createEvaluation = createResource({
	url: 'frappe.client.insert',
	makeParams(values) {
		return {
			doc: {
				doctype: 'LMS Certificate Request',
				batch_name: values.batch,
				...values,
			},
		}
	},
})

function submitEvaluation(close) {
	createEvaluation.submit(evaluation, {
		validate() {
			if (!evaluation.course) {
				return 'Please select a course.'
			}
			if (!evaluation.date) {
				return 'Please select a date.'
			}
			if (!evaluation.start_time) {
				return 'Please select a slot.'
			}
			if (dayjs(evaluation.date).isBefore(dayjs(), 'day')) {
				return 'Please select a future date.'
			}
			if (dayjs(evaluation.date).isAfter(dayjs(props.endDate), 'day')) {
				return `Please select a date before the end date ${dayjs(
					props.endDate
				).format('DD MMMM YYYY')}.`
			}
		},
		onSuccess() {
			evaluations.value.reload()
			close()
		},
		onError(err) {
			let message = err.messages?.[0] || err
			let unavailabilityMessage

			if (typeof message === 'string') {
				unavailabilityMessage = message?.includes('unavailable')
			} else {
				unavailabilityMessage = false
			}

			toast.warning(__('Evaluator is unavailable'))
		},
	})
}

const getCourses = () => {
	let courses = []
	for (const course of props.courses) {
		if (course.evaluator) {
			courses.push({
				label: course.title,
				value: course.course,
			})
		}
	}

	if (courses.length == 1) {
		evaluation.course = courses[0].value
	}

	return courses
}

const slots = createResource({
	url: 'lms.lms.doctype.course_evaluator.course_evaluator.get_schedule',
	makeParams(values) {
		return {
			course: values.course,
			date: values.date,
			batch: props.batch,
		}
	},
})

watch(
	() => evaluation.date,
	(date) => {
		evaluation.start_time = ''
		if (date && evaluation.course) {
			slots.submit(evaluation)
		}
	}
)

watch(
	() => evaluation.course,
	(course) => {
		evaluation.date = ''
		evaluation.start_time = ''
		slots.reset()
	}
)

const saveSlot = (slot) => {
	evaluation.start_time = slot.start_time
	evaluation.end_time = slot.end_time
	evaluation.day = slot.day
}
</script>
