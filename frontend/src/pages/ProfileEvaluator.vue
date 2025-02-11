<template>
	<div class="mt-7 mb-20">
		<h2 class="mb-4 text-lg font-semibold text-ink-gray-9">
			{{ __('My availability') }}
		</h2>

		<div class="">
			<div
				class="grid grid-cols-3 md:grid-cols-4 gap-4 text-sm text-ink-gray-7 mb-4"
			>
				<div>
					{{ __('Day') }}
				</div>
				<div>
					{{ __('Start Time') }}
				</div>
				<div>
					{{ __('End Time') }}
				</div>
			</div>

			<div
				v-if="evaluator.data"
				v-for="slot in evaluator.data.slots.schedule"
				class="grid grid-cols-3 md:grid-cols-4 gap-4 mb-4 group"
			>
				<FormControl
					type="select"
					:options="days"
					v-model="slot.day"
					@focusout.stop="update(slot.name, 'day', slot.day)"
				/>
				<FormControl
					type="time"
					v-model="slot.start_time"
					@focusout.stop="update(slot.name, 'start_time', slot.start_time)"
				/>
				<FormControl
					type="time"
					v-model="slot.end_time"
					@focusout.stop="update(slot.name, 'end_time', slot.end_time)"
				/>
				<X
					@click="deleteRow(slot.name)"
					class="w-6 h-auto stroke-1.5 text-red-900 rounded-md cursor-pointer p-1 bg-surface-red-2 hidden group-hover:block"
				/>
			</div>

			<div
				class="grid grid-cols-3 md:grid-cols-4 gap-4 mb-4"
				v-show="showSlotsTemplate"
			>
				<FormControl
					type="select"
					:options="days"
					v-model="newSlot.day"
					@focusout.stop="add()"
				/>
				<FormControl
					type="time"
					v-model="newSlot.start_time"
					@focusout.stop="add()"
				/>
				<FormControl
					type="time"
					v-model="newSlot.end_time"
					@focusout.stop="add()"
				/>
			</div>

			<Button @click="showSlotsTemplate = 1">
				<template #prefix>
					<Plus class="w-4 h-4 stroke-1.5 text-ink-gray-7" />
				</template>
				{{ __('Add Slot') }}
			</Button>
		</div>
		<div class="my-10">
			<h2 class="mb-4 text-lg font-semibold text-ink-gray-9">
				{{ __('I am unavailable') }}
			</h2>
			<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
				<FormControl
					type="date"
					:label="__('From')"
					v-model="from"
					@blur="
						() => {
							updateUnavailability.submit({
								field: 'unavailable_from',
								value: from,
							})
						}
					"
				/>
				<FormControl
					type="date"
					:label="__('To')"
					v-model="to"
					@blur="
						() => {
							updateUnavailability.submit({
								field: 'unavailable_to',
								value: to,
							})
						}
					"
				/>
			</div>
		</div>
		<div>
			<h2 class="mb-4 text-lg font-semibold text-ink-gray-9">
				{{ __('My calendar') }}
			</h2>
			<div
				v-if="evaluator.data?.calendar && evaluator.data?.is_authorized"
				class="flex items-center bg-surface-green-2 text-green-900 text-sm p-1 rounded-md mb-4 w-fit"
			>
				<Check class="h-4 w-4 stroke-1.5 mr-2" />
				{{ __('Your calendar is set.') }}
			</div>
			<Button @click="() => authorizeCalendar.submit()">
				{{ __('Authorize Google Calendar Access') }}
			</Button>
		</div>
	</div>
</template>
<script setup>
import { createResource, FormControl, Button } from 'frappe-ui'
import { computed, reactive, ref, onMounted, inject } from 'vue'
import { showToast, convertToTitleCase } from '@/utils'
import { Plus, X, Check } from 'lucide-vue-next'

const user = inject('$user')

const props = defineProps({
	profile: {
		type: Object,
		required: true,
	},
})

onMounted(() => {
	if (user.data?.name !== props.profile.data?.name) {
		window.location.href = `/user/${props.profile.data?.username}`
	}
})

const showSlotsTemplate = ref(0)
const from = ref(null)
const to = ref(null)

const newSlot = reactive({
	day: '',
	start_time: '',
	end_time: '',
})

const evaluator = createResource({
	url: 'lms.lms.api.get_evaluator_details',
	params: {
		evaluator: props.profile.data?.name,
	},
	auto: true,
	onSuccess(data) {
		if (data.slots.unavailable_from) from.value = data.slots.unavailable_from
		if (data.slots.unavailable_to) to.value = data.slots.unavailable_to
	},
})

const createSlot = createResource({
	url: 'frappe.client.insert',
	makeParams(values) {
		return {
			doc: {
				doctype: 'Evaluator Schedule',
				parent: evaluator.data?.slots.name,
				parentfield: 'schedule',
				parenttype: 'Course Evaluator',
				...newSlot,
			},
		}
	},
	onSuccess() {
		showToast('Success', 'Slot added successfully', 'check')
		evaluator.reload()
		showSlotsTemplate.value = 0
		newSlot.day = ''
		newSlot.start_time = ''
		newSlot.end_time = ''
	},
	onError(err) {
		showToast('Error', err.messages?.[0] || err, 'x')
	},
})

const updateSlot = createResource({
	url: 'frappe.client.set_value',
	makeParams(values) {
		return {
			doctype: 'Evaluator Schedule',
			name: values.name,
			fieldname: values.field,
			value: values.value,
		}
	},
	onSuccess() {
		showToast('Success', 'Availability updated successfully', 'check')
	},
	onError(err) {
		showToast('Error', err.messages?.[0] || err, 'x')
	},
})

const deleteSlot = createResource({
	url: 'frappe.client.delete',
	makeParams(values) {
		return {
			doctype: 'Evaluator Schedule',
			name: values.name,
		}
	},
	onSuccess() {
		showToast('Success', 'Slot deleted successfully', 'check')
		evaluator.reload()
	},
	onError(err) {
		showToast('Error', err.messages?.[0] || err, 'x')
	},
})

const updateUnavailability = createResource({
	url: 'frappe.client.set_value',
	makeParams(values) {
		return {
			doctype: 'Course Evaluator',
			name: evaluator.data?.slots.name,
			fieldname: values.field,
			value: values.value,
		}
	},
	onSuccess() {
		showToast('Success', 'Unavailability updated successfully', 'check')
	},
	onError(err) {
		showToast('Error', err.messages?.[0] || err, 'x')
	},
})

const update = (name, field, value) => {
	updateSlot.submit(
		{
			name,
			field,
			value,
		},
		{
			validate() {
				if (!value) {
					return `Please enter a value for ${convertToTitleCase(field)}`
				}
			},
		}
	)
}

const add = () => {
	if (!newSlot.day || !newSlot.start_time || !newSlot.end_time) {
		return
	}
	createSlot.submit()
}

const deleteRow = (name) => {
	deleteSlot.submit({ name })
}

const authorizeCalendar = createResource({
	url: 'frappe.integrations.doctype.google_calendar.google_calendar.authorize_access',
	makeParams() {
		return {
			g_calendar: evaluator.data?.calendar,
			reauthorize: 1,
		}
	},
	onSuccess(data) {
		window.open(data.url)
	},
})

const days = computed(() => {
	return [
		{
			label: 'Monday',
			value: 'Monday',
		},
		{
			label: 'Tuesday',
			value: 'Tuesday',
		},
		{
			label: 'Wednesday',
			value: 'Wednesday',
		},
		{
			label: 'Thursday',
			value: 'Thursday',
		},
		{
			label: 'Friday',
			value: 'Friday',
		},
		{
			label: 'Saturday',
			value: 'Saturday',
		},
		{
			label: 'Sunday',
			value: 'Sunday',
		},
	]
})
</script>
