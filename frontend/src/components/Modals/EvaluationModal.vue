<template>
	<Dialog
		v-model:open="show"
		:title="__('Schedule your evaluation')"
		size="xl"
		:actions="[
			{
				label: __('Submit'),
				variant: 'solid',
				onClick: ({ close }) => submitEvaluation(close),
			},
		]"
	>
		<template #default>
			<div class="flex flex-col gap-4 text-base max-h-[60vh]">
				<FormControl
					v-model="evaluation.course"
					type="select"
					:label="__('Course')"
					:options="getCourses()"
				/>
				<div v-if="slots.data?.length" class="space-y-4 overflow-y-auto mt-4">
					<div class="flex items-baseline justify-between gap-x-3">
						<div class="text-ink-gray-9 font-medium">
							{{ __('Available Slots') }}
						</div>
						<div v-if="scheduleTimezone" class="text-sm text-ink-gray-5">
							{{ __('All times in {0}').format(scheduleTimezone) }}
						</div>
					</div>
					<div class="space-y-5">
						<div
							v-for="row in slots.data"
							:key="row.display_date"
							class="space-y-2"
						>
							<div class="flex items-center text-ink-gray-7 gap-x-2">
								<span class="lucide-calendar size-3" />
								<div class="text-ink-gray-9">
									{{ dayjs(row.display_date).format('DD MMMM YYYY') }}
								</div>
								<div>&middot;</div>
								<div class="text-ink-gray-5">
									{{ row.display_day }}
								</div>
								<template
									v-if="row.display_timezone_label !== scheduleTimezone"
								>
									<div>&middot;</div>
									<div class="text-ink-gray-5">
										{{ row.display_timezone_label }}
									</div>
								</template>
							</div>
							<div class="grid grid-cols-3 gap-2">
								<button
									v-for="slot in row.slots"
									:key="`${slot.date}-${slot.start_time}`"
									type="button"
									class="text-base text-center border rounded-md text-ink-gray-8 p-2 cursor-pointer text-ink-gray-7 hover:bg-surface-gray-2 hover:border-outline-gray-3"
									@click="saveSlot(slot)"
									:title="slotLabel(slot, row)"
									:aria-label="slotLabel(slot, row)"
									:class="{
										'border-outline-gray-4 text-ink-gray-9':
											evaluation.date == slot.date &&
											evaluation.start_time == slot.start_time,
									}"
								>
									{{ formatTime(slot.display_start_time) }} -
									{{ formatTime(slot.display_end_time) }}
									<sup
										v-if="endsOnAnotherDay(slot, row)"
										class="text-ink-gray-5 ms-0.5"
									>
										+1
									</sup>
								</button>
							</div>
						</div>
					</div>
				</div>
				<div v-else-if="!evaluation.course" class="text-ink-gray-7">
					{{ __('Please select a course to view available slots.') }}
				</div>
				<div v-else class="text-ink-red-6">
					{{ __('No slots available for the selected course.') }}
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import { call, createResource, Dialog, FormControl, toast } from 'frappe-ui'
import { computed, ref, watch, inject } from 'vue'
import { formatTime } from '@/utils'

const dayjs = inject('$dayjs')
const user = inject('$user')
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

const evaluation = ref({
	course: '',
	date: '',
	start_time: '',
	end_time: '',
	day: '',
	batch: props.batch,
	member: user.data.name,
})

function submitEvaluation(close) {
	if (!evaluation.value.date || !evaluation.value.start_time) {
		toast.warning(__('Please select a slot for your evaluation.'), {
			duration: 10,
		})
		return
	}
	call('frappe.client.insert', {
		doc: {
			doctype: 'LMS Certificate Request',
			batch_name: evaluation.value.batch,
			...evaluation.value,
		},
	})
		.then(() => {
			evaluations.value.reload()
			close()
		})
		.catch((err) => {
			console.log(err.messages?.[0] || err)
			toast.warning(__(err.messages?.[0] || err), { duration: 20 })
		})
}

const getCourses = () => {
	const courses = []
	for (const course of props.courses) {
		if (course.evaluator) {
			courses.push({
				label: course.title,
				value: course.course,
			})
		}
	}

	if (courses.length === 1) {
		evaluation.value.course = courses[0].value
	}

	return courses
}

const slots = createResource({
	url: 'lms.lms.doctype.course_evaluator.course_evaluator.get_schedule',
	makeParams(values) {
		return {
			course: values.course,
			batch: props.batch,
		}
	},
})

watch(
	() => evaluation.value.course,
	(course) => {
		slots.reload(evaluation.value)
	}
)

/* get_schedule spans 60 days, so the header label is wrong for later days once a
   DST transition falls inside the range. Each day carries its own label and only
   the ones that disagree with the header repeat it. */
const scheduleTimezone = computed(
	() => slots.data?.[0]?.display_timezone_label ?? ''
)

/* Conversion can push a slot's end past midnight while its start stays on the
   rendered day: 17:00-19:00 Asia/Kolkata is 23:30-01:30 in Pacific/Auckland.
   "23:30 - 01:30" alone would not say which day it ends on. */
const endsOnAnotherDay = (slot, row) =>
	Boolean(slot.display_end_date) && slot.display_end_date !== row.display_date

const slotLabel = (slot, row) => {
	const start = formatTime(slot.display_start_time)
	const end = formatTime(slot.display_end_time)
	if (!endsOnAnotherDay(slot, row)) return `${start} - ${end}`

	return __('{0} until {1} on {2}').format(
		start,
		end,
		dayjs(slot.display_end_date).format('DD MMMM YYYY')
	)
}

/* Displayed times are converted; the booking submits the system values the slot
   was stored with. Both live on the slot, not the day: converting can move a
   slot into the previous or next day, so one rendered day can hold slots from
   two different stored dates. */
const saveSlot = (slot) => {
	evaluation.value.start_time = slot.start_time
	evaluation.value.end_time = slot.end_time
	evaluation.value.date = slot.date
	evaluation.value.day = slot.day
}
</script>
