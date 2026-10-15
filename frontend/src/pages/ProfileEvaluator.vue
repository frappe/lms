<template>
	<div class="mt-7 mb-20 flex flex-col gap-10">
		<div
			v-if="readOnlyMode"
			class="flex items-center gap-x-2 text-p-sm text-ink-gray-7 bg-surface-gray-1 px-3 py-2 rounded-5 w-full"
		>
			<span class="lucide-circle-alert size-4" />
			<span>
				{{
					__('You cannot change your slots while the site is being updated.')
				}}
			</span>
		</div>

		<section v-if="isSessionUser() && !readOnlyMode" data-testid="calendar">
			<div class="flex items-start justify-between gap-4">
				<div>
					<h2 class="text-lg-semibold text-ink-gray-9">
						{{ __('Google Calendar') }}
					</h2>
					<p class="mt-1 text-p-sm text-ink-gray-6">
						{{
							__(
								'Live class invites and evaluation bookings are sent from it. Changes save on their own.'
							)
						}}
					</p>
				</div>
				<label
					v-if="googleEnabled"
					class="flex shrink-0 items-center gap-2 text-p-sm text-ink-gray-7"
				>
					{{ __('Enabled') }}
					<BooleanSwitch
						size="sm"
						:model-value="calendar.enable"
						:aria-label="__('Enable Google Calendar')"
						@update:model-value="(value) => saveCalendar('enable', value)"
					/>
				</label>
			</div>

			<p
				v-if="!googleEnabled"
				class="mt-4 rounded-6 bg-surface-gray-1 px-4 py-3 text-p-sm text-ink-gray-7"
			>
				{{
					__(
						'Google Calendar is not set up on this site yet. Ask your site administrator to turn it on.'
					)
				}}
			</p>
			<div
				v-else
				class="mt-4 divide-y divide-outline-gray-1 rounded-6 border border-outline-gray-1"
			>
				<div class="grid gap-3 px-4 py-3 md:grid-cols-2 md:items-center">
					<div>
						<label
							for="calendar-name"
							class="text-p-base-medium text-ink-gray-7"
						>
							{{ __('Calendar name') }}
						</label>
						<p class="text-p-sm text-ink-gray-6">
							{{ __('The name that will appear in Google Calendar') }}
						</p>
					</div>
					<FormControl
						id="calendar-name"
						type="text"
						v-model="calendarName"
						@blur="saveCalendarName"
						@keydown.enter="$event.target.blur()"
					/>
				</div>
				<div class="flex items-center justify-between gap-4 px-4 py-3">
					<div>
						<div class="text-p-base-medium text-ink-gray-7">
							{{ __('Push to Google Calendar') }}
						</div>
						<p class="text-p-sm text-ink-gray-6">
							{{ __('Classes reach Google Calendar only while this is on.') }}
						</p>
					</div>
					<BooleanSwitch
						size="sm"
						:model-value="calendar.push_to_google_calendar"
						:aria-label="__('Push to Google Calendar')"
						@update:model-value="
							(value) => saveCalendar('push_to_google_calendar', value)
						"
					/>
				</div>
				<div
					class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3"
				>
					<div>
						<div class="text-p-base-medium text-ink-gray-7">
							{{ __('Access') }}
						</div>
						<p class="text-p-sm text-ink-gray-6">
							{{
								calendar.is_authorized
									? __(
											'Authorize again to switch Google accounts or restore access.'
									  )
									: __(
											'Sign in with Google once so classes can be added to it.'
									  )
							}}
						</p>
					</div>
					<div class="flex flex-wrap items-center gap-3">
						<Badge
							:theme="calendar.is_authorized ? 'green' : 'gray'"
							:label="
								calendar.is_authorized ? __('Authorized') : __('Not authorized')
							"
						/>
						<Button
							:variant="calendar.is_authorized ? 'subtle' : 'solid'"
							:loading="authorizeCalendar.loading"
							:label="
								calendar.is_authorized
									? __('Authorize again')
									: __('Authorize Google Calendar Access')
							"
							@click="authorizeCalendar.submit()"
						/>
					</div>
				</div>
			</div>
		</section>

		<section data-testid="availability">
			<h2 class="text-lg-semibold text-ink-gray-9">
				{{ __('Weekly slots') }}
			</h2>
			<p v-if="evaluator.data?.timezone" class="mt-1 text-p-sm text-ink-gray-6">
				{{ __('Times are in {0}.').format(evaluator.data.timezone) }}
			</p>

			<div
				v-if="!slots.length && !addingSlot"
				class="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-6 border border-dashed border-outline-gray-2 px-4 py-4"
			>
				<p class="max-w-md text-p-base text-ink-gray-7">
					{{
						isSessionUser()
							? __(
									"You haven't added any slots yet. Add the days and times you're available each week, so learners can book evaluations with you."
							  )
							: __('No slots added yet.')
					}}
				</p>
				<Button
					v-if="canEdit"
					:label="__('Add slot')"
					@click="addingSlot = true"
				>
					<template #prefix>
						<span class="lucide-plus size-4 text-ink-gray-7" />
					</template>
				</Button>
			</div>

			<template v-else>
				<div
					class="mt-4 divide-y divide-outline-gray-1 rounded-6 border border-outline-gray-1"
				>
					<div
						v-for="slot in slots"
						:key="slot.name"
						class="flex flex-wrap items-center gap-3 px-4 py-2.5"
						data-testid="slot"
					>
						<div class="w-36 shrink-0">
							<FormControl
								type="select"
								:options="days"
								v-model="slot.day"
								:aria-label="__('Day')"
								:disabled="!canEdit"
								@update:modelValue="update(slot.name, 'day', $event)"
							/>
						</div>
						<div
							class="order-last flex w-full items-center gap-2 md:order-none md:w-auto"
						>
							<div class="w-32 shrink-0">
								<FormControl
									type="time"
									v-model="slot.start_time"
									:aria-label="__('Start time')"
									:disabled="!canEdit"
									@update:modelValue="update(slot.name, 'start_time', $event)"
								/>
							</div>
							<span class="text-p-sm text-ink-gray-6">{{ __('to') }}</span>
							<div class="w-32 shrink-0">
								<FormControl
									type="time"
									v-model="slot.end_time"
									:aria-label="__('End time')"
									:disabled="!canEdit"
									@update:modelValue="update(slot.name, 'end_time', $event)"
								/>
							</div>
						</div>
						<Button
							v-if="canEdit"
							class="ms-auto"
							variant="ghost"
							:aria-label="__('Remove {0}').format(__(slot.day))"
							@click="deleteRow(slot.name)"
						>
							<template #icon>
								<span class="lucide-x size-4 text-ink-gray-6" />
							</template>
						</Button>
					</div>

					<div
						v-if="addingSlot"
						class="flex flex-wrap items-center gap-3 px-4 py-2.5"
						data-testid="new-slot"
					>
						<div class="w-36 shrink-0">
							<FormControl
								type="select"
								:options="[{ label: __('Pick a day'), value: '' }, ...days]"
								v-model="newSlot.day"
								:aria-label="__('Day')"
								@update:modelValue="add()"
							/>
						</div>
						<div
							class="order-last flex w-full items-center gap-2 md:order-none md:w-auto"
						>
							<div class="w-32 shrink-0">
								<FormControl
									type="time"
									v-model="newSlot.start_time"
									:aria-label="__('Start time')"
									@update:modelValue="add()"
								/>
							</div>
							<span class="text-p-sm text-ink-gray-6">{{ __('to') }}</span>
							<div class="w-32 shrink-0">
								<FormControl
									type="time"
									v-model="newSlot.end_time"
									:aria-label="__('End time')"
									@update:modelValue="add()"
								/>
							</div>
						</div>
						<Button
							class="ms-auto"
							variant="ghost"
							:aria-label="__('Cancel')"
							@click="resetNewSlot"
						>
							<template #icon>
								<span class="lucide-x size-4 text-ink-gray-6" />
							</template>
						</Button>
					</div>
				</div>
				<p v-if="addingSlot" class="mt-2 text-p-sm text-ink-gray-6">
					{{
						__('Pick a day and both times. It saves once all three are set.')
					}}
				</p>
				<Button
					v-if="canEdit && !addingSlot"
					class="mt-3"
					:label="__('Add slot')"
					@click="addingSlot = true"
				>
					<template #prefix>
						<span class="lucide-plus size-4 text-ink-gray-7" />
					</template>
				</Button>
			</template>
		</section>

		<section data-testid="time-off">
			<h2 class="text-lg-semibold text-ink-gray-9">
				{{ __('Time off') }}
			</h2>
			<p class="mt-1 text-p-sm text-ink-gray-6">
				{{ __('Learners cannot book you between these dates.') }}
			</p>
			<div
				v-if="from || to || addingTimeOff"
				class="mt-4 flex flex-wrap items-center gap-3"
			>
				<div class="w-36 md:w-40">
					<FormControl
						type="date"
						:format="dateFormat"
						:aria-label="__('From')"
						v-model="from"
						:disabled="!canEdit"
						@update:modelValue="
							(value) => setUnavailability('unavailable_from', value)
						"
					/>
				</div>
				<span class="text-p-sm text-ink-gray-6">{{ __('to') }}</span>
				<div class="w-36 md:w-40">
					<FormControl
						type="date"
						:format="dateFormat"
						:aria-label="__('To')"
						v-model="to"
						:disabled="!canEdit"
						@update:modelValue="
							(value) => setUnavailability('unavailable_to', value)
						"
					/>
				</div>
				<Button
					v-if="canEdit"
					variant="ghost"
					:label="__('Clear')"
					@click="clearTimeOff"
				/>
			</div>
			<Button
				v-else-if="canEdit"
				class="mt-4"
				:label="__('Add time off')"
				@click="addingTimeOff = true"
			>
				<template #prefix>
					<span class="lucide-plus size-4 text-ink-gray-7" />
				</template>
			</Button>
			<p v-else class="mt-4 text-p-base text-ink-gray-7">
				{{ __('No time off planned.') }}
			</p>
		</section>
	</div>
</template>
<script setup>
// The slots are stored as bare wall-clock times and read as system time
// everywhere downstream, so the editor has to name the clock it means.
//
// Everything here saves as it changes; there is no Save button.
import { Badge, Button, createResource, FormControl, toast } from 'frappe-ui'
import { computed, reactive, ref, onMounted, inject, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BooleanSwitch from '@/components/Controls/BooleanSwitch.vue'
import { convertToTitleCase } from '@/utils'
import { safeUrl } from '@/utils/safeUrl'
import { getDateFormat } from '@/utils/format'

const user = inject('$user')
const route = useRoute()
const router = useRouter()
const dateFormat = getDateFormat()
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
	// Google sends the evaluator back here; a failed sign-in says so in the URL.
	if (route.query.calendar === 'failed') {
		toast.error(
			__(
				'Google did not finish connecting your calendar. Try authorizing again.'
			)
		)
		router.replace({ query: { ...route.query, calendar: undefined } })
	}
})

const hasHigherAccess = () => {
	return user.data?.is_evaluator || user.data?.is_moderator
}

const isSessionUser = () => {
	return user.data?.email === props.profile.data?.name
}

const canEdit = computed(() => isSessionUser() && !readOnlyMode)

const addingSlot = ref(false)
const addingTimeOff = ref(false)
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

const slots = computed(() => evaluator.data?.slots?.schedule || [])
const googleEnabled = computed(() => evaluator.data?.google_enabled !== false)

// Until the evaluator first changes something there is no calendar record;
// these are the values Frappe would create it with.
const calendar = computed(
	() =>
		evaluator.data?.calendar || {
			enable: 1,
			push_to_google_calendar: 1,
			calendar_name: props.profile.data?.name,
			is_authorized: false,
		}
)
const calendarName = ref('')

// On each load only. Watching the resource itself is deep, so a calendar
// toggle (which edits evaluator.data.calendar in place) re-ran this and put the
// last load's time off back over dates saved since.
watch(
	() => evaluator.data,
	() => {
		from.value = evaluator.data?.slots?.unavailable_from || null
		to.value = evaluator.data?.slots?.unavailable_to || null
		calendarName.value = calendar.value.calendar_name || ''

		evaluator.data?.slots?.schedule.forEach((slot) => {
			slot.start_time = formatTime(slot.start_time)
			slot.end_time = formatTime(slot.end_time)
		})
	}
)

const formatTime = (time) => {
	if (!time) return ''
	const [hour, minute] = time.split(':')
	return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
}

// Availability goes through lms.lms.api rather than frappe.client.*: the raw
// framework endpoints fall back to Course Evaluator's role permissions, which
// grant Moderator blanket write with no owner condition, so a Moderator could
// edit anyone else's calendar.
const createSlot = createResource({
	url: 'lms.lms.api.add_evaluator_slot',
	makeParams() {
		return {
			evaluator: props.profile.data?.name,
			...newSlot,
		}
	},
	onSuccess() {
		toast.success(__('Slot added'))
		evaluator.reload()
		resetNewSlot()
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
		toast.success(__('Saved'))
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
		toast.success(__('Slot removed'))
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
	onError(err) {
		toast.error(err.messages?.[0] || err)
	},
})

// submit() rejects after onError has shown the error, so the catch only keeps
// the rejection from going unhandled.
const setUnavailability = (field, value) => {
	return updateUnavailability
		.submit({ field, value })
		.then(() => toast.success(__('Saved')))
		.catch(() => {})
}

const clearTimeOff = async () => {
	try {
		await updateUnavailability.submit({
			field: 'unavailable_from',
			value: null,
		})
		await updateUnavailability.submit({ field: 'unavailable_to', value: null })
	} catch {
		return
	}
	from.value = null
	to.value = null
	addingTimeOff.value = false
	toast.success(__('Time off cleared'))
}

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

const resetNewSlot = () => {
	addingSlot.value = false
	newSlot.day = ''
	newSlot.start_time = ''
	newSlot.end_time = ''
}

const deleteRow = (name) => {
	deleteSlot.submit({ name })
}

// Evaluators are portal users with no write permission on Google Calendar, so
// their own calendar is changed through lms.lms.api, never Frappe's endpoints.
const calendarUpdate = createResource({
	url: 'lms.lms.api.update_evaluator_calendar',
	makeParams(values) {
		return values
	},
	onSuccess(data) {
		if (evaluator.data) evaluator.data.calendar = data
		calendarName.value = data?.calendar_name || calendarName.value
		toast.success(__('Saved'))
	},
	onError(err) {
		calendarName.value = calendar.value.calendar_name || ''
		toast.error(err.messages?.[0] || err)
	},
})

const saveCalendar = (fieldname, value) => {
	calendarUpdate.submit({ fieldname, value: value ? 1 : 0 })
}

const saveCalendarName = () => {
	const value = calendarName.value.trim()
	if (value === (calendar.value.calendar_name || '')) return
	calendarUpdate.submit({ fieldname: 'calendar_name', value })
}

// Sign-in happens in this tab: Google returns to this page when it is done.
const authorizeCalendar = createResource({
	url: 'lms.lms.api.authorize_evaluator_calendar',
	onSuccess(data) {
		const href = safeUrl(data?.url)
		if (href) window.location.href = href
	},
	onError(err) {
		toast.error(err.messages?.[0] || err)
	},
})

const days = computed(() => {
	return [
		'Monday',
		'Tuesday',
		'Wednesday',
		'Thursday',
		'Friday',
		'Saturday',
		'Sunday',
	].map((day) => ({ label: __(day), value: day }))
})
</script>
