<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('Schedule your evaluation'),
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
			<div class="flex flex-col gap-4 text-base max-h-[60vh]">
				<FormControl
					v-model="evaluation.course"
					type="select"
					:label="__('Course')"
					:options="getCourses()"
				/>
				<div v-if="slots.data?.length" class="space-y-4 overflow-y-auto mt-4">
					<div class="text-ink-gray-9 font-medium">
						{{ __('Available Slots') }}
					</div>
					<div class="space-y-5">
						<div v-for="row in slots.data" class="space-y-2">
							<div class="flex items-center text-ink-gray-7 space-x-2">
								<Calendar class="size-3" />
								<div class="text-ink-gray-9">
									{{ dayjs(row.date).format('DD MMMM YYYY') }}
								</div>
								<div>&middot;</div>
								<div class="text-ink-gray-5">
									{{ row.day }}
								</div>
							</div>
							<div class="grid grid-cols-3 gap-2">
								<div
									v-for="slot in row.slots"
									class="text-base text-center border rounded-md text-ink-gray-8 p-2 cursor-pointer text-ink-gray-7 hover:bg-surface-gray-2 hover:border-outline-gray-3"
									@click="saveSlot(slot, row)"
									:class="{
										'border-outline-gray-4 text-ink-gray-9':
											evaluation.date == row.date &&
											evaluation.start_time == slot.start_time,
									}"
								>
									{{ formatTime(slot.start_time) }} -
									{{ formatTime(slot.end_time) }}
								</div>
							</div>
						</div>
					</div>
				</div>
				<div v-else class="text-ink-red-3">
					{{ __('No slots available for the selected course.') }}
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import {
	call,
	createResource,
	dayjs,
	Dialog,
	FormControl,
	toast,
} from 'frappe-ui'
import { ref, watch, inject } from 'vue'
import { Calendar } from 'lucide-vue-next'
import { formatTime } from '@/utils/'

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

const saveSlot = (slot, row) => {
	evaluation.value.start_time = slot.start_time
	evaluation.value.end_time = slot.end_time
	evaluation.value.date = row.date
	evaluation.value.day = row.day
}
</script>
