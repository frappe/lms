<template>
	<div class="mt-7 mb-20 flex flex-col gap-12">
		<section data-testid="availability">
			<div class="flex flex-wrap items-start justify-between gap-4">
				<div>
					<h2 class="text-lg font-semibold text-ink-gray-9">
						{{ __('Weekly availability') }}
					</h2>
					<p v-if="details?.timezone" class="mt-1 text-p-sm text-ink-gray-6">
						{{ __('Times are in {0}.').format(details.timezone) }}
					</p>
				</div>
				<div v-if="canEdit" class="flex items-center gap-2">
					<Button
						v-if="dirty"
						variant="ghost"
						:label="__('Discard')"
						:disabled="saving"
						@click="discard"
					/>
					<Button
						variant="solid"
						:label="__('Save')"
						:disabled="!dirty"
						:loading="saving"
						@click="save"
					/>
				</div>
			</div>
			<p
				v-if="readOnlyMode && isSessionUser"
				class="mt-3 text-p-sm text-ink-gray-6"
			>
				{{
					__("You can't change your availability while the site is updating.")
				}}
			</p>
			<ErrorMessage v-if="saveError" class="mt-3" :message="saveError" />

			<div
				v-if="showEmptyWeek"
				class="mt-5 rounded-6 border border-outline-gray-2"
				data-testid="empty-week"
			>
				<EmptyStateLayout
					:name="__('Weekly hours')"
					icon="lucide-calendar-clock"
					width="lg"
					:title="emptyWeekTitle"
					:description="emptyWeekDescription"
				>
					<Button
						v-if="canEdit"
						:label="__('Add weekly hours')"
						@click="startingWeek = true"
					/>
				</EmptyStateLayout>
			</div>
			<ul
				v-else
				class="mt-5 divide-y divide-outline-gray-2 rounded-6 border border-outline-gray-2"
			>
				<li
					v-for="day in WEEKDAYS"
					:key="day"
					class="flex flex-wrap items-start gap-x-4 gap-y-3 px-4 py-3.5"
					:data-testid="`day-${day}`"
				>
					<span
						class="flex-1 py-1 text-base font-medium text-ink-gray-8 sm:w-28 sm:flex-none"
					>
						{{ __(day) }}
					</span>
					<Switch
						v-if="canEdit"
						class="py-1 sm:order-3"
						:model-value="week[day].length > 0"
						:aria-label="__('Available on {0}').format(__(day))"
						@update:model-value="(on: boolean) => toggleDay(day, on)"
					/>
					<div class="w-full sm:order-2 sm:w-auto sm:flex-1">
						<p v-if="!week[day].length" class="py-1 text-p-sm text-ink-gray-6">
							{{ __('Unavailable') }}
						</p>
						<p v-else-if="!canEdit" class="py-1 text-p-sm text-ink-gray-8">
							{{ week[day].map(formatRange).join(', ') }}
						</p>
						<ul v-else class="flex flex-col gap-2">
							<li
								v-for="(range, index) in week[day]"
								:key="range.key"
								data-testid="range"
							>
								<div class="flex items-center gap-2">
									<label class="sr-only" :for="fieldId(range, 'start')">
										{{ __('{0} start time').format(__(day)) }}
									</label>
									<FormControl
										:id="fieldId(range, 'start')"
										v-model="range.start"
										type="time"
										class="min-w-0 flex-1 sm:w-28 sm:flex-none"
									/>
									<span class="text-p-sm text-ink-gray-6">
										{{ __('to') }}
									</span>
									<label class="sr-only" :for="fieldId(range, 'end')">
										{{ __('{0} end time').format(__(day)) }}
									</label>
									<FormControl
										:id="fieldId(range, 'end')"
										v-model="range.end"
										type="time"
										class="min-w-0 flex-1 sm:w-28 sm:flex-none"
									/>
									<Button
										variant="ghost"
										icon="lucide-x"
										:aria-label="
											__('Remove {0} on {1}').format(
												formatRange(range),
												__(day)
											)
										"
										@click="removeRange(day, range)"
									/>
									<Button
										v-if="index === week[day].length - 1"
										variant="ghost"
										icon="lucide-plus"
										:aria-label="__('Add a time range on {0}').format(__(day))"
										@click="addRange(day)"
									/>
									<span v-else class="size-7 shrink-0" />
								</div>
								<ErrorMessage
									v-if="errors[day][range.key]"
									class="mt-1.5"
									:message="errors[day][range.key]"
								/>
							</li>
						</ul>
					</div>
				</li>
			</ul>
		</section>

		<section data-testid="time-off">
			<h2 class="text-lg font-semibold text-ink-gray-9">
				{{ __('Time off') }}
			</h2>
			<p class="mt-1 text-p-sm text-ink-gray-6">
				{{
					isSessionUser
						? __("Learners can't book you between these dates.")
						: __("Learners can't book this evaluator between these dates.")
				}}
			</p>
			<template v-if="canEdit">
				<div class="mt-5 flex flex-wrap items-start gap-4">
					<FormControl
						v-model="timeOff.from"
						type="date"
						class="w-full sm:w-44"
						:label="__('From')"
						:format="dateFormat"
					/>
					<FormControl
						v-model="timeOff.to"
						type="date"
						class="w-full sm:w-44"
						:label="__('To')"
						:format="dateFormat"
					/>
					<Button
						v-if="timeOff.from || timeOff.to"
						class="sm:self-end"
						variant="ghost"
						:label="__('Clear')"
						@click="clearTimeOff"
					/>
				</div>
				<ErrorMessage
					v-if="timeOffMessage"
					class="mt-2"
					:message="timeOffMessage"
				/>
			</template>
			<p v-else class="mt-4 text-p-sm text-ink-gray-8">
				{{ timeOffSummary }}
			</p>
		</section>

		<section v-if="showCalendar" data-testid="calendar">
			<h2 class="text-lg font-semibold text-ink-gray-9">
				{{ __('Google Calendar') }}
			</h2>
			<p class="mt-1 text-p-sm text-ink-gray-6">
				{{ calendarDescription }}
			</p>
			<ul
				v-if="details?.google_enabled"
				class="mt-5 divide-y divide-outline-gray-2 rounded-6 border border-outline-gray-2"
			>
				<li class="flex items-center justify-between gap-4 px-4 py-3.5">
					<span class="text-base text-ink-gray-8">
						{{ __('Use Google Calendar') }}
					</span>
					<Switch
						v-model="calendarDraft.enable"
						:aria-label="__('Use Google Calendar')"
					/>
				</li>
				<template v-if="calendarDraft.enable">
					<li
						class="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
					>
						<label for="calendar-name" class="text-base text-ink-gray-8">
							{{ __('Calendar name') }}
						</label>
						<FormControl
							id="calendar-name"
							v-model="calendarDraft.calendar_name"
							type="text"
							class="sm:w-64"
						/>
					</li>
					<li class="flex items-center justify-between gap-4 px-4 py-3.5">
						<span class="text-base text-ink-gray-8">
							{{ __('Add events to Google') }}
						</span>
						<Switch
							v-model="calendarDraft.push"
							:aria-label="__('Add events to Google')"
						/>
					</li>
					<li
						class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3.5"
					>
						<span class="text-base text-ink-gray-8">
							{{ __('Google account') }}
						</span>
						<div class="flex items-center gap-3">
							<Badge
								:theme="calendar?.is_authorized ? 'green' : 'gray'"
								:label="
									calendar?.is_authorized
										? __('Connected')
										: __('Not connected')
								"
							/>
							<Tooltip
								:text="dirty ? __('Save your changes first') : ''"
								:disabled="!dirty"
							>
								<Button
									:label="
										calendar?.is_authorized ? __('Reconnect') : __('Connect')
									"
									:disabled="dirty"
									:loading="authorizeCalendar.loading"
									@click="authorizeCalendar.submit()"
								/>
							</Tooltip>
						</div>
					</li>
				</template>
			</ul>
		</section>
	</div>
</template>
<script setup lang="ts">
// Slots are bare wall-clock times read as system time everywhere downstream,
// so the editor names the clock. Edits stay local until Save.
import {
	Badge,
	Button,
	createResource,
	ErrorMessage,
	FormControl,
	Switch,
	toast,
	Tooltip,
} from 'frappe-ui'
import { computed, inject, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { EvaluatorDetails, Resource, SessionUser } from '@/types/api'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import { getDateFormat } from '@/utils/format'
import { resourceErrorMessage } from '@/utils/resource'
import { safeUrl } from '@/utils/safeUrl'
import {
	WEEKDAYS,
	emptyWeek,
	formatRange,
	nextRange,
	rangeErrors,
	timeOffError,
	toRows,
	toWeek,
} from '@/utils/evaluatorAvailability'
import type {
	TimeOff,
	TimeRange,
	Week,
	Weekday,
} from '@/utils/evaluatorAvailability'

interface ProfileData {
	name?: string
	username?: string
}

const props = defineProps<{ profile: { data: ProfileData | null } }>()

const user = inject<SessionUser>('$user')
const route = useRoute()
const router = useRouter()
const dateFormat = getDateFormat()
const readOnlyMode = Boolean(window.read_only_mode)

const isSessionUser = computed(
	() =>
		Boolean(props.profile.data?.username) &&
		user?.data?.username === props.profile.data?.username
)
const canEdit = computed(() => isSessionUser.value && !readOnlyMode)
const showCalendar = computed(() => isSessionUser.value && !readOnlyMode)

const evaluator = createResource({
	url: 'lms.lms.api.get_evaluator_details',
	params: { evaluator: props.profile.data?.name },
	auto: true,
	onError(err: unknown) {
		toast.error(resourceErrorMessage(err))
	},
}) as Resource<EvaluatorDetails | null>

const details = computed(() => evaluator.data)
const calendar = computed(() => details.value?.calendar ?? null)

const week = ref<Week>(emptyWeek())
const timeOff = reactive<TimeOff>({ from: null, to: null })
const calendarDraft = reactive({ enable: true, calendar_name: '', push: true })
const baseline = ref('')
const startingWeek = ref(false)
const attempted = ref(false)
const saving = ref(false)
const saveError = ref('')

const snapshot = (): string =>
	JSON.stringify({
		rows: toRows(week.value),
		timeOff,
		calendar: showCalendar.value ? calendarDraft : null,
	})

const load = (data: EvaluatorDetails | null) => {
	week.value = toWeek(data?.slots?.schedule ?? [])
	timeOff.from = data?.slots?.unavailable_from || null
	timeOff.to = data?.slots?.unavailable_to || null
	// No calendar record yet: these are what Frappe would create it with.
	calendarDraft.enable = Boolean(data?.calendar?.enable ?? 1)
	calendarDraft.push = Boolean(data?.calendar?.push_to_google_calendar ?? 1)
	calendarDraft.calendar_name =
		data?.calendar?.calendar_name || props.profile.data?.name || ''
	baseline.value = snapshot()
	attempted.value = false
	startingWeek.value = false
	saveError.value = ''
}

watch(() => evaluator.data, load, { immediate: true })

const dirty = computed(() => snapshot() !== baseline.value)

// Seven "Unavailable" rows read as a broken list, so a week with nothing saved
// starts as an empty state until the evaluator chooses to add hours.
const emptyWeekTitle = computed(() =>
	canEdit.value ? __('No weekly hours yet') : __('No weekly hours set')
)
const emptyWeekDescription = computed(() =>
	canEdit.value
		? __("Students can't book an evaluation with you until you add hours.")
		: __("Students can't book an evaluation with this evaluator yet.")
)
const showEmptyWeek = computed(
	() =>
		Boolean(details.value) &&
		!(details.value?.slots?.schedule ?? []).length &&
		!startingWeek.value
)

const errors = computed(
	() =>
		Object.fromEntries(
			WEEKDAYS.map((day) => [day, rangeErrors(week.value[day])])
		) as Record<Weekday, Record<number, string>>
)

const timeOffMessage = computed(() => {
	const complete = Boolean(timeOff.from && timeOff.to)
	return complete || attempted.value ? timeOffError(timeOff) : ''
})

const hasErrors = computed(
	() =>
		WEEKDAYS.some((day) => Object.keys(errors.value[day]).length > 0) ||
		Boolean(timeOffError(timeOff))
)

const timeOffSummary = computed(() =>
	timeOff.from && timeOff.to
		? __('{0} to {1}').format(timeOff.from, timeOff.to)
		: __('No time off planned.')
)

const calendarDescription = computed(() => {
	if (!details.value?.google_enabled) {
		return __(
			"Google Calendar isn't set up on this site, so evaluations are booked without a calendar event or meeting link."
		)
	}
	if (!details.value.evaluation_invites) {
		return __(
			"Evaluation invites are off on this site, so bookings don't reach your calendar. Live classes you schedule still use it."
		)
	}
	return __(
		'Each booked evaluation is added to it with a Google Meet link. Without it, evaluations are still booked, with no meeting link.'
	)
})

const fieldId = (range: TimeRange, edge: 'start' | 'end'): string =>
	`availability-${range.key}-${edge}`

const toggleDay = (day: Weekday, on: boolean) => {
	week.value[day] = on ? [nextRange([])] : []
}

const addRange = (day: Weekday) => {
	week.value[day].push(nextRange(week.value[day]))
}

const removeRange = (day: Weekday, range: TimeRange) => {
	week.value[day] = week.value[day].filter((item) => item !== range)
}

const clearTimeOff = () => {
	timeOff.from = null
	timeOff.to = null
}

const discard = () => load(evaluator.data)

const saveAvailability = createResource({
	url: 'lms.lms.api.save_evaluator_availability',
}) as Resource<EvaluatorDetails>

// Evaluators have no write permission on Google Calendar, so their own is
// changed through lms.lms.api, one field per call.
const calendarUpdate = createResource({
	url: 'lms.lms.api.update_evaluator_calendar',
}) as Resource<EvaluatorDetails['calendar']>

const calendarChanges = (): { fieldname: string; value: string | number }[] => {
	if (!showCalendar.value || !details.value?.google_enabled) return []
	const saved = calendar.value
	const changes: { fieldname: string; value: string | number }[] = []
	if (calendarDraft.enable !== Boolean(saved?.enable ?? 1)) {
		changes.push({ fieldname: 'enable', value: calendarDraft.enable ? 1 : 0 })
	}
	if (calendarDraft.push !== Boolean(saved?.push_to_google_calendar ?? 1)) {
		changes.push({
			fieldname: 'push_to_google_calendar',
			value: calendarDraft.push ? 1 : 0,
		})
	}
	const name = calendarDraft.calendar_name.trim()
	if (name !== (saved?.calendar_name || props.profile.data?.name || '')) {
		changes.push({ fieldname: 'calendar_name', value: name })
	}
	return changes
}

const save = async () => {
	attempted.value = true
	if (hasErrors.value) return
	saving.value = true
	saveError.value = ''
	try {
		await saveAvailability.submit({
			schedule: toRows(week.value),
			unavailable_from: timeOff.from,
			unavailable_to: timeOff.to,
		})
		for (const change of calendarChanges()) {
			await calendarUpdate.submit(change)
		}
		await evaluator.reload()
		toast.success(__('Availability saved'))
	} catch (err) {
		saveError.value = resourceErrorMessage(err)
	} finally {
		saving.value = false
	}
}

// Sign-in happens in this tab: Google returns to this page when it is done.
const authorizeCalendar = createResource({
	url: 'lms.lms.api.authorize_evaluator_calendar',
	onSuccess(data: { url?: string } | null) {
		const href = safeUrl(data?.url)
		if (href) window.location.href = href
	},
	onError(err: unknown) {
		toast.error(resourceErrorMessage(err))
	},
}) as Resource<{ url?: string } | null>

onMounted(() => {
	// Google sends the evaluator back here; a failed sign-in says so in the URL.
	if (route.query.calendar === 'failed') {
		toast.error(
			__('Google did not finish connecting your calendar. Try again.')
		)
		router.replace({ query: { ...route.query, calendar: undefined } })
	}
})
</script>
