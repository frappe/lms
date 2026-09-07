<template>
	<div class="mt-7 mb-20">
		<div class="mb-4">
			<h2 class="text-md font-semibold text-ink-gray-9">
				{{ __('My availability') }}
			</h2>
			<p v-if="evaluator.data?.timezone" class="text-sm text-ink-gray-6">
				{{ __('Times are in {0}').format(evaluator.data.timezone) }}
			</p>
		</div>

		<div
			v-if="readOnlyMode"
			class="flex items-center gap-x-2 text-sm text-ink-gray-7 bg-surface-gray-1 px-3 py-2 rounded-md w-full text-center"
		>
			<span class="lucide-circle-alert size-4" />
			<span>
				{{
					__(
						'You cannot change the availability when the site is being updated.'
					)
				}}
			</span>
		</div>
		<div v-else>
			<div>
				<div
					class="hidden md:grid md:grid-cols-4 gap-4 text-sm text-ink-gray-7 mb-4"
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
					:key="slot.name"
					class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 group"
				>
					<FormControl
						type="select"
						:options="days"
						v-model="slot.day"
						:aria-label="__('Day')"
						@update:modelValue="update(slot.name, 'day', $event)"
						:disabled="!isSessionUser()"
					/>
					<label
						:for="`start-time-${slot.name}`"
						class="md:sr-only block text-xs text-ink-gray-5"
					>
						{{ __('Start Time') }}
					</label>
					<FormControl
						type="time"
						:id="`start-time-${slot.name}`"
						v-model="slot.start_time"
						@update:modelValue="update(slot.name, 'start_time', $event)"
						:disabled="!isSessionUser()"
					/>
					<label
						:for="`end-time-${slot.name}`"
						class="md:sr-only block text-xs text-ink-gray-5"
					>
						{{ __('End Time') }}
					</label>
					<FormControl
						type="time"
						:id="`end-time-${slot.name}`"
						v-model="slot.end_time"
						@update:modelValue="update(slot.name, 'end_time', $event)"
						:disabled="!isSessionUser()"
					/>
					<button
						v-if="isSessionUser()"
						type="button"
						:aria-label="__('Delete slot')"
						class="lucide-x size-6 text-red-900 rounded-md cursor-pointer p-1 bg-surface-red-2 md:sr-only md:group-hover:not-sr-only md:focus:not-sr-only"
						@click="deleteRow(slot.name)"
					/>
				</div>

				<div
					class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4"
					v-show="showSlotsTemplate"
				>
					<FormControl
						type="select"
						:options="days"
						v-model="newSlot.day"
						:aria-label="__('Day')"
						@update:modelValue="add()"
						:disabled="!isSessionUser()"
					/>
					<label
						for="new-slot-start-time"
						class="md:sr-only block text-xs text-ink-gray-5"
					>
						{{ __('Start Time') }}
					</label>
					<FormControl
						type="time"
						id="new-slot-start-time"
						v-model="newSlot.start_time"
						@update:modelValue="add()"
						:disabled="!isSessionUser()"
					/>
					<label
						for="new-slot-end-time"
						class="md:sr-only block text-xs text-ink-gray-5"
					>
						{{ __('End Time') }}
					</label>
					<FormControl
						type="time"
						id="new-slot-end-time"
						v-model="newSlot.end_time"
						@update:modelValue="add()"
						:disabled="!isSessionUser()"
					/>
				</div>

				<Button v-if="isSessionUser()" @click="showSlotsTemplate = 1">
					<template #prefix>
						<span class="lucide-plus size-4 text-ink-gray-7" />
					</template>
					{{ __('Add Slot') }}
				</Button>
			</div>
			<div class="my-10">
				<h2 class="mb-4 text-md font-semibold text-ink-gray-9">
					{{ __('I am unavailable') }}
				</h2>
				<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
					<FormControl
						type="date"
						:label="__('From')"
						v-model="from"
						:disabled="!isSessionUser()"
						@update:modelValue="
							(value) => {
								updateUnavailability.submit({
									field: 'unavailable_from',
									value,
								})
							}
						"
					/>
					<FormControl
						type="date"
						:label="__('To')"
						v-model="to"
						:disabled="!isSessionUser()"
						@update:modelValue="
							(value) => {
								updateUnavailability.submit({
									field: 'unavailable_to',
									value,
								})
							}
						"
					/>
				</div>
			</div>
			<div v-if="isSessionUser()">
				<h2 class="mb-4 text-md font-semibold text-ink-gray-9">
					{{ __('My calendar') }}
				</h2>
				<div
					v-if="evaluator.data?.calendar && evaluator.data?.is_authorized"
					class="flex items-center bg-surface-green-2 text-green-900 text-sm p-1 rounded-md mb-4 w-fit"
				>
					<span class="lucide-check size-4 me-2" />
					{{ __('Your calendar is set.') }}
				</div>
				<Button class="text-p-base-medium" @click="startCalendarAuthorization">
					{{ __('Authorize Google Calendar Access') }}
				</Button>
			</div>
		</div>
	</div>
</template>
<script setup>
// The slots are stored as bare wall-clock times and read as system time
// everywhere downstream, so the editor has to name the clock it means.
import { createResource, FormControl, Button, Badge, toast } from 'frappe-ui'
import { computed, reactive, ref, onMounted, inject, watch } from 'vue'
import { convertToTitleCase } from '@/utils'
import { openExternal } from '@/utils/openExternal'

const user = inject('$user')
const readOnlyMode = window.read_only_mode

const props = defineProps({
	profile: {
		type: Object,
		required: true,
	},
})

onMounted(() => {
	if (user.data?.name !== props.profile.data?.name && !hasHigherAccess()) {
		window.location.href = `/user/${props.profile.data?.username}`
	}
})

const hasHigherAccess = () => {
	return user.data?.is_evaluator || user.data?.is_moderator
}

const isSessionUser = () => {
	return user.data?.email === props.profile.data?.name
}

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
	onError(err) {
		toast.error(err.messages?.[0] || err)
		console.error(err)
	},
})

watch(evaluator, () => {
	if (evaluator.data?.slots?.unavailable_from)
		from.value = evaluator.data.slots.unavailable_from
	if (evaluator.data?.slots?.unavailable_to)
		to.value = evaluator.data.slots.unavailable_to

	evaluator.data?.slots?.schedule.forEach((slot) => {
		slot.start_time = formatTime(slot.start_time)
		slot.end_time = formatTime(slot.end_time)
	})
})

const formatTime = (time) => {
	if (!time) return ''
	const [hour, minute] = time.split(':')
	return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
}

// Availability goes through lms.lms.api rather than frappe.client.*: the raw
// framework endpoints fall back to Course Evaluator's role permissions, which
// grant blanket write to Moderator, Batch Evaluator and Course Creator with no
// owner condition, so anyone holding one could edit anyone else's calendar.
const createSlot = createResource({
	url: 'lms.lms.api.add_evaluator_slot',
	makeParams(values) {
		return {
			evaluator: props.profile.data?.name,
			...newSlot,
		}
	},
	onSuccess() {
		toast.success(__('Slot added successfully'))
		evaluator.reload()
		showSlotsTemplate.value = 0
		newSlot.day = ''
		newSlot.start_time = ''
		newSlot.end_time = ''
	},
	onError(err) {
		toast.error(err.messages?.[0] || err)
	},
})

const updateSlot = createResource({
	url: 'lms.lms.api.update_evaluator_slot',
	makeParams(values) {
		return {
			evaluator: props.profile.data?.name,
			slot: values.name,
			fieldname: values.field,
			value: values.value,
		}
	},
	onSuccess() {
		toast.success(__('Availability updated successfully'))
	},
	onError(err) {
		toast.error(err.messages?.[0] || err)
	},
})

const deleteSlot = createResource({
	url: 'lms.lms.api.delete_evaluator_slot',
	makeParams(values) {
		return {
			evaluator: props.profile.data?.name,
			slot: values.name,
		}
	},
	onSuccess() {
		toast.success(__('Slot deleted successfully'))
		evaluator.reload()
	},
	onError(err) {
		toast.error(err.messages?.[0] || err)
	},
})

// The unavailability date controls call this from `@update:modelValue`, not
// `@blur`: the date control renders as a popover, so a native listener bound as
// a fallthrough attr is not reliably reached.
const updateUnavailability = createResource({
	url: 'lms.lms.api.set_evaluator_unavailability',
	makeParams(values) {
		return {
			evaluator: props.profile.data?.name,
			fieldname: values.field,
			value: values.value,
		}
	},
	onSuccess() {
		toast.success(__('Unavailability updated successfully'))
	},
	onError(err) {
		toast.error(err.messages?.[0] || err)
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
	if (createSlot.loading) {
		return
	}
	createSlot.submit()
}

const deleteRow = (name) => {
	deleteSlot.submit({ name })
}

// The calendar record is created here rather than by the page load: reading a
// profile must not write documents in that user's name.
const ensureCalendar = createResource({
	url: 'lms.lms.api.ensure_evaluator_calendar',
	onError(err) {
		toast.error(err.messages?.[0] || err)
	},
})

const authorizeCalendar = createResource({
	url: 'frappe.integrations.doctype.google_calendar.google_calendar.authorize_access',
	makeParams(values) {
		return {
			g_calendar: values.calendar,
			reauthorize: 1,
		}
	},
	onSuccess(data) {
		openExternal(data.url)
	},
	onError(err) {
		toast.error(err.messages?.[0] || err)
	},
})

const startCalendarAuthorization = async () => {
	const calendar = evaluator.data?.calendar || (await ensureCalendar.submit())
	if (!calendar) return
	authorizeCalendar.submit({ calendar })
}

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
