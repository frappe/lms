<template>
	<FormShell
		:title="__('New Live Class')"
		size="xl"
		position="top"
		@close="close"
	>
		<template #default>
			<div v-if="loadingBatch" class="p-4 text-base text-ink-gray-6">
				{{ __('Loading...') }}
			</div>
			<div v-else-if="refusal" class="p-4 text-base text-ink-gray-6">
				{{ refusal }}
			</div>
			<div v-else data-testid="live-class-fields" class="flex flex-col gap-4">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div class="space-y-4">
						<FormControl
							type="text"
							v-model="liveClass.title"
							:label="__('Title')"
							:required="true"
							variant="outline"
						/>
						<FormControl
							v-model="liveClass.date"
							type="date"
							:format="dateFormat"
							:label="__('Date')"
							:required="true"
							variant="outline"
						/>
						<FormControl
							type="number"
							v-model="liveClass.duration"
							:label="__('Duration (in minutes)')"
							:required="true"
							variant="outline"
						/>
					</div>
					<div class="space-y-4">
						<Tooltip
							:text="
								__(
									'Time must be in 24 hour format (HH:mm). Example 11:30 or 22:00'
								)
							"
						>
							<FormControl
								v-model="liveClass.time"
								type="time"
								:label="__('Time')"
								:required="true"
								variant="outline"
							/>
						</Tooltip>

						<Combobox
							:modelValue="liveClass.timezone"
							:options="getTimezoneOptions()"
							:label="__('Timezone')"
							:required="true"
							@update:modelValue="(value) => (liveClass.timezone = value)"
							variant="outline"
						/>
						<FormControl
							v-if="conferencingProvider === 'Zoom'"
							v-model="liveClass.auto_recording"
							type="select"
							:options="getRecordingOptions()"
							:label="__('Auto Recording')"
							variant="outline"
						/>
					</div>
				</div>
				<FormControl
					v-model="liveClass.description"
					type="textarea"
					:label="__('Description')"
					variant="outline"
				/>
				<!-- Last in the body, so it sits right above Save on desktop. -->
				<p
					v-if="calendarMissing"
					data-testid="live-class-calendar-missing"
					role="alert"
					class="text-p-sm text-ink-gray-7"
				>
					{{ calendarMissing.message }}
					<button
						v-if="calendarMissing.setUp"
						type="button"
						class="font-medium text-ink-gray-9 underline underline-offset-2"
						@click="calendarMissing.setUp"
					>
						{{ __('Set up') }}
					</button>
				</p>
			</div>
		</template>
		<template #actions>
			<div
				v-if="!refusal && !loadingBatch"
				class="flex items-center justify-end"
			>
				<HeaderButton
					data-testid="live-class-save"
					:label="__('Create')"
					variant="solid"
					:loading="
						createLiveClass.loading || createGoogleMeetLiveClass.loading
					"
					@click="submitLiveClass()"
				/>
			</div>
		</template>
	</FormShell>
</template>
<script setup>
import {
	Combobox,
	createResource,
	getCachedListResource,
	Tooltip,
	FormControl,
	toast,
} from 'frappe-ui'
import { computed, reactive, inject, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getTimezones, getUserTimezone, openSettings } from '@/utils/'
import { canManageGoogleIntegrations } from '@/components/Settings/GoogleApi/googleApi'
import { canManageGoogleMeet } from '@/components/Settings/GoogleMeet/googleMeet'
import FormShell from '@/components/FormShell.vue'
import HeaderButton from '@/components/HeaderButton.vue'
import {
	batchRouteLocation,
	useBatchDetails,
} from '@/composables/useBatchForms'
import { useFormRoute } from '@/composables/useFormRoute'
import { submitResource } from '@/utils/resource'
import { getDateFormat } from '@/utils/format'
import { useLearningOnboarding } from '@/onboarding/useLearningOnboarding'

const props = defineProps({
	batchName: {
		type: String,
		required: true,
	},
})

const user = inject('$user')
const { completeStep } = useLearningOnboarding()
const dayjs = inject('$dayjs')
const route = useRoute()
const router = useRouter()
const readOnlyMode = window.read_only_mode
const dateFormat = getDateFormat()

// C2: close()'s pop branch restores the hash by itself; its deep-link branch
// replaces to this literal location, so the tab hash has to be carried here or
// a close lands on the bare path and silently resets the page to tab 0.
const { close } = useFormRoute(
	batchRouteLocation('BatchDetail', props.batchName, route.hash)
)

// Parent context a URL cannot carry: the conferencing provider and its account
// pick which endpoint a class is created through. Its own fetch, NOT the page's
// instance — see useBatchForms.ts for why sharing one is not available here.
const batch = useBatchDetails(() => props.batchName)

const loadingBatch = computed(() => !batch.data && batch.loading)

const conferencingProvider = computed(
	() => batch.data?.conferencing_provider || null
)

// can_schedule_classes, not the Batch Evaluator role or can_manage:
// create_live_class accepts only the batch's instructors.
const isAdmin = computed(() =>
	Boolean(user.data?.is_moderator || batch.data?.can_schedule_classes)
)

// Copied from LiveClass.vue's canCreateClass()/hasProviderAccount(), which gate
// the "Add" button. A URL does not go through a button.
//
// UX gate, not an authorization boundary — the server-side permission check in
// lms_batch.create_live_class is.
const hasProviderAccount = computed(() => {
	const data = batch.data
	if (data?.conferencing_provider === 'Zoom' && data?.zoom_account) return true
	if (
		data?.conferencing_provider === 'Google Meet' &&
		data?.google_meet_account
	)
		return true
	return false
})

const refusal = computed(() => {
	if (readOnlyMode) return __('This site is in read-only mode.')
	if (!isAdmin.value)
		return __(
			"You can't schedule live classes for this batch. Ask one of its instructors or a Moderator."
		)
	if (!hasProviderAccount.value)
		return __(
			'Please select a conferencing provider and add an account to the batch to create live classes.'
		)
	return null
})

const liveClass = reactive({
	title: '',
	description: '',
	date: '',
	time: '',
	duration: '',
	timezone: '',
	auto_recording: 'No Recording',
	batch: props.batchName,
	host: user.data?.name,
})

onMounted(() => {
	liveClass.timezone = getUserTimezone()
})

const getTimezoneOptions = () => {
	return getTimezones().map((timezone) => {
		return {
			label: timezone,
			value: timezone,
		}
	})
}

const getRecordingOptions = () => {
	return [
		{
			label: 'No Recording',
			value: 'No Recording',
		},
		{
			label: 'Local',
			value: 'Local',
		},
		{
			label: 'Cloud',
			value: 'Cloud',
		},
	]
}

const createLiveClass = createResource({
	url: 'lms.lms.doctype.lms_batch.lms_batch.create_live_class',
	makeParams(values) {
		return {
			doctype: 'LMS Live Class',
			batch_name: values.batch,
			zoom_account: batch.data?.zoom_account,
			...values,
		}
	},
})

const createGoogleMeetLiveClass = createResource({
	url: 'lms.lms.doctype.lms_batch.lms_batch.create_google_meet_live_class',
	makeParams(values) {
		return {
			batch_name: values.batch,
			google_meet_account: batch.data?.google_meet_account,
			...values,
		}
	},
})

// C4: the `reloadLiveClasses` defineModel is gone with the modal, so the tab's
// list is refreshed by name instead. A lookup, NOT createListResource — a
// constructor here would win the cache and hand LiveClass.vue an instance with
// this file's (absent) filters/fields, because createListResource discards the
// second caller's options. Null when the tab is not mounted (deep link), which
// is correct: it fetches on mount anyway. Mirrors stores/notifications.js:35.
const reloadLiveClassList = () => {
	getCachedListResource(['liveClasses', props.batchName])?.reload()
}

const submitLiveClass = () => {
	if (refusal.value) return
	const resource =
		conferencingProvider.value === 'Google Meet'
			? createGoogleMeetLiveClass
			: createLiveClass
	calendarMissing.value = null
	return submitResource(resource, liveClass, {
		// Returned, so a missing field blocks the submit with its own message. It
		// used to be discarded, and an empty duration reached the server as an
		// Internal Server Error.
		validate() {
			return validateFormFields()
		},
		onSuccess() {
			completeStep('schedule_live_class')
			reloadLiveClassList()
			close()
		},
		onError(err) {
			if (err?.exc_type === 'GoogleCalendarMissingError') {
				showCalendarMissing(err.messages?.[0] || err)
				return
			}
			toast.error(err.messages?.[0] || err)
			console.error(err)
		},
	})
}

// Classes go out through Google Calendar, so a missing one blocks scheduling.
// One line above Save rather than a toast: a toast sits outside the Dialog, so
// clicking its action first dismissed the form and took a second click to act.
// Set up goes to the page that fixes it when the user can open it.
const calendarMissing = ref(null)

const showCalendarMissing = (message) => {
	const meet = conferencingProvider.value === 'Google Meet'
	const setUp = calendarSetUpAction(meet)
	calendarMissing.value = {
		message: setUp
			? message
			: meet
			? __(
					'Ask your site administrator to add a Google Calendar to this Google Meet account.'
			  )
			: __(
					'Ask your site administrator to set up your Google Calendar to schedule Zoom classes.'
			  ),
		setUp,
	}
}

// Where "Set up" goes. Moderators with access get the Settings page. Evaluators
// have no Settings, but a Zoom class uses their own calendar, which they manage
// on their profile's Slots tab. A Meet account's calendar is the admin's.
const calendarSetUpAction = (meet) => {
	if (
		user.data?.is_moderator &&
		(meet ? canManageGoogleMeet() : canManageGoogleIntegrations())
	) {
		return () => openSettings(meet ? 'google-meet' : 'google-calendar')
	}
	if (!meet && user.data?.is_evaluator && user.data?.username) {
		return () =>
			router.push({
				name: 'ProfileEvaluator',
				params: { username: user.data.username },
			})
	}
	return null
}

const validateFormFields = () => {
	if (!liveClass.title) {
		return __('Please enter a title.')
	}
	if (!liveClass.date) {
		return __('Please select a date.')
	}
	if (!liveClass.time) {
		return __('Please select a time.')
	}
	if (!liveClass.timezone) {
		return __('Please select a timezone.')
	}
	if (!valideTime()) {
		return __('Please enter a valid time in the format HH:mm.')
	}
	const liveClassDateTime = dayjs(`${liveClass.date}T${liveClass.time}`).tz(
		liveClass.timezone,
		true
	)
	if (
		liveClassDateTime.isSameOrBefore(
			dayjs().tz(liveClass.timezone, false),
			'minute'
		)
	) {
		return __('Please select a future date and time.')
	}
	if (!liveClass.duration) {
		return __('Please select a duration.')
	}
}

const valideTime = () => {
	let time = liveClass.time.split(':')
	// HH:mm from the picker, or HH:mm:ss when seconds are typed.
	if (time.length < 2 || time.length > 3) {
		return false
	}
	if (time[0] < 0 || time[0] > 23) {
		return false
	}
	if (time[1] < 0 || time[1] > 59) {
		return false
	}
	return true
}
</script>
