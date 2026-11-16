<template>
	<section data-testid="calendar">
		<div class="flex flex-wrap items-center gap-2">
			<h2 class="text-lg font-semibold text-ink-gray-9">
				{{ __('Google Calendar') }}
			</h2>
			<Badge
				v-if="details"
				data-testid="calendar-status"
				:theme="connected ? 'green' : 'gray'"
				:label="statusLabel"
			/>
		</div>
		<template v-if="connected || disabled">
			<Alert
				v-if="invitesLocked"
				class="mt-3"
				theme="amber"
				data-testid="invites-off"
				:title="__('Evaluation invites are off on this site')"
				:description="connectedDescription"
			/>
			<p v-else class="mt-1 text-p-sm text-ink-gray-6">
				{{ connectedDescription }}
			</p>
			<Button
				v-if="connected && canTurnOnInvites"
				class="mt-3"
				variant="outline"
				@click="openInvitesSetting"
			>
				<span class="text-p-base">{{ __('Open Settings') }}</span>
			</Button>
			<div
				class="group mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-6 border border-outline-gray-2 px-4 py-3.5"
				data-testid="calendar-connected"
			>
				<div class="flex min-w-0 items-center gap-2">
					<span
						class="lucide-calendar size-4 shrink-0 text-ink-gray-5"
						aria-hidden="true"
					/>
					<TextInput
						v-if="renaming"
						ref="nameInput"
						v-model="newName"
						class="w-64 max-w-full"
						variant="outline"
						:aria-label="__('Calendar name')"
						:disabled="renameCalendar.loading"
						@keydown.enter.stop.prevent="saveName"
						@keydown.esc.stop.prevent="cancelRename"
						@blur="saveName"
					/>
					<Button
						v-if="renaming"
						variant="ghost"
						:aria-label="__('Save name')"
						:disabled="renameCalendar.loading"
						@mousedown.prevent
						@click="saveName"
					>
						<template #icon>
							<span
								class="lucide-check size-4 text-ink-gray-5"
								aria-hidden="true"
							/>
						</template>
					</Button>
					<template v-else>
						<span
							class="truncate text-base text-ink-gray-8"
							data-testid="calendar-name"
							@dblclick="startRename"
						>
							{{ details?.calendar?.calendar_name }}
						</span>
						<Button
							variant="ghost"
							class="transition-opacity focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
							:aria-label="__('Rename calendar')"
							@click="startRename"
						>
							<template #icon>
								<span
									class="lucide-pencil size-4 text-ink-gray-5"
									aria-hidden="true"
								/>
							</template>
						</Button>
					</template>
				</div>
				<div class="flex items-center gap-2">
					<Button
						:loading="updateCalendar.loading"
						@click="setEnabled(disabled)"
					>
						<span class="text-p-base">
							{{ disabled ? __('Enable') : __('Disable') }}
						</span>
					</Button>
					<Button
						variant="outline"
						:loading="disconnectCalendar.loading"
						@click="confirmDisconnect"
					>
						<span class="text-p-base">{{ __('Disconnect') }}</span>
					</Button>
				</div>
			</div>
		</template>
		<div
			v-else-if="details"
			class="mt-5 rounded-6 border border-outline-gray-2"
			data-testid="calendar-empty"
		>
			<EmptyStateLayout
				:name="__('Google Calendar')"
				icon="lucide-calendar-x-2"
				width="lg"
				:title="calendarEmptyTitle"
				:description="calendarEmptyDescription"
			>
				<div
					v-if="details.google_enabled"
					class="flex flex-wrap justify-center gap-2"
				>
					<Tooltip
						:text="dirty ? __('Save your changes first') : ''"
						:disabled="!dirty"
					>
						<Button
							variant="subtle"
							:disabled="dirty"
							:loading="authorizeCalendar.loading"
							@click="authorizeCalendar.submit()"
						>
							<span class="text-p-base">{{ __('Connect') }}</span>
						</Button>
					</Tooltip>
					<Button
						v-if="canTurnOnInvites"
						variant="outline"
						@click="openInvitesSetting"
					>
						<span class="text-p-base">{{ __('Open Settings') }}</span>
					</Button>
				</div>
				<Button
					v-else-if="details.can_configure_google"
					variant="subtle"
					href="/app/google-settings"
				>
					<span class="text-p-base">{{ __('Open Google Settings') }}</span>
				</Button>
			</EmptyStateLayout>
		</div>
	</section>
</template>
<script setup lang="ts">
import {
	Alert,
	Badge,
	Button,
	createDocumentResource,
	createResource,
	TextInput,
	toast,
	Tooltip,
} from 'frappe-ui'
import type { TextInputExposed } from 'frappe-ui'
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import type { EvaluatorDetails, Resource } from '@/types/api'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
// @ts-expect-error utils/index.js has no type declarations yet
import { openSettings } from '@/utils'
import { createDialog } from '@/utils/dialogs'
import { resourceErrorMessage } from '@/utils/resource'
import { safeUrl } from '@/utils/safeUrl'

type Calendar = EvaluatorDetails['calendar']

const props = defineProps<{
	details?: EvaluatorDetails | null
	dirty: boolean
}>()

const emit = defineEmits<{ changed: [calendar: Calendar] }>()

const connected = computed(() => Boolean(props.details?.calendar?.connected))

// Signed in but switched off: the token is kept, so Enable needs no new sign-in.
const disabled = computed(() => {
	const calendar = props.details?.calendar
	if (!calendar?.is_authorized || calendar.connected) return false
	return !(calendar.enable && calendar.push_to_google_calendar)
})

const statusLabel = computed(() => {
	if (connected.value) return __('Connected')
	return disabled.value ? __('Disabled') : __('Not connected')
})

// An admin can flip the setting from the Settings dialog over this page. Reading
// it from the same cached document the dialog edits shows the change at once,
// where reloading the details would also throw away unsaved hours.
const lmsSettings = shallowRef<{ doc?: Record<string, unknown> } | null>(null)
watch(
	() => props.details?.can_configure_invites,
	(canConfigure) => {
		if (!canConfigure || lmsSettings.value) return
		lmsSettings.value = createDocumentResource({
			doctype: 'LMS Settings',
			name: 'LMS Settings',
			auto: true,
		})
	},
	{ immediate: true }
)

const invitesOn = computed(() => {
	const doc = lmsSettings.value?.doc
	if (doc) return Boolean(doc.send_calendar_invite_for_evaluations)
	return Boolean(props.details?.evaluation_invites)
})

const canTurnOnInvites = computed(
	() => Boolean(props.details?.can_configure_invites) && !invitesOn.value
)

// Invites are off and this viewer can't turn them on, so it reads as a notice.
const invitesLocked = computed(
	() => !disabled.value && !invitesOn.value && !canTurnOnInvites.value
)

const connectedDescription = computed(() => {
	if (disabled.value) {
		return __(
			"Booked evaluations aren't added to this calendar while it's disabled."
		)
	}
	if (invitesOn.value) {
		return __(
			'Each booked evaluation is added to this calendar with a Google Meet link.'
		)
	}
	if (canTurnOnInvites.value) {
		return __(
			"Evaluation invites are off, so booked evaluations aren't added to this calendar. Turn on Send calendar invite for evaluations in Settings > General."
		)
	}
	return __(
		"Booked evaluations aren't added to this calendar. Contact a Moderator to turn them on."
	)
})

const calendarEmptyTitle = computed(() =>
	props.details?.google_enabled
		? __('Connect your Google Calendar')
		: __("Google Calendar isn't set up on this site")
)

const googleSetupDescription = computed(() =>
	props.details?.can_configure_google
		? __(
				'Turn on Google in Google Settings and add a client ID and secret. Until then, evaluations are booked without a calendar event or meeting link.'
		  )
		: __(
				'Ask your site administrator to set up Google in Google Settings. Until then, evaluations are booked without a calendar event or meeting link.'
		  )
)

const calendarEmptyDescription = computed(() => {
	if (!props.details?.google_enabled) return googleSetupDescription.value
	if (canTurnOnInvites.value) {
		return __(
			"Evaluation invites are off, so booked evaluations won't be added to your calendar. Turn on Send calendar invite for evaluations in Settings > General."
		)
	}
	if (!invitesOn.value) {
		return __(
			"Evaluation invites are off on this site. Booked evaluations won't be added to your calendar until a Moderator turns them on."
		)
	}
	return __(
		'Each booked evaluation is added to it with a Google Meet link. Without it, evaluations are still booked, with no meeting link.'
	)
})

const openInvitesSetting = () =>
	openSettings('general', null, 'send_calendar_invite_for_evaluations')

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

const disconnectCalendar = createResource({
	url: 'lms.lms.api.disconnect_evaluator_calendar',
	onSuccess(calendar: Calendar) {
		emit('changed', calendar)
		toast.success(__('Google Calendar disconnected'))
	},
	onError(err: unknown) {
		toast.error(resourceErrorMessage(err))
	},
}) as Resource<Calendar>

const updateCalendar = createResource({
	url: 'lms.lms.api.update_evaluator_calendar',
}) as Resource<Calendar>

const setEnabled = async (on: boolean) => {
	try {
		let calendar = await updateCalendar.submit({
			fieldname: 'enable',
			value: on ? 1 : 0,
		})
		if (on && !props.details?.calendar?.push_to_google_calendar) {
			calendar = await updateCalendar.submit({
				fieldname: 'push_to_google_calendar',
				value: 1,
			})
		}
		emit('changed', calendar)
		toast.success(
			on ? __('Google Calendar enabled') : __('Google Calendar disabled')
		)
	} catch (err) {
		toast.error(resourceErrorMessage(err))
	}
}

const renameCalendar = createResource({
	url: 'lms.lms.api.update_evaluator_calendar',
}) as Resource<Calendar>

const renaming = ref(false)
const newName = ref('')
const nameInput = ref<TextInputExposed | null>(null)

const focusName = () =>
	nextTick(() => {
		nameInput.value?.focus()
		nameInput.value?.inputElement?.select()
	})

const startRename = () => {
	newName.value = props.details?.calendar?.calendar_name ?? ''
	renaming.value = true
	focusName()
}

const cancelRename = () => {
	renaming.value = false
}

// Enter and the blur it can cause both land here; a failed save stays open.
const saveName = async () => {
	if (!renaming.value || renameCalendar.loading) return
	const name = newName.value.trim()
	if (!name || name === props.details?.calendar?.calendar_name) {
		renaming.value = false
		return
	}
	try {
		const calendar = await renameCalendar.submit({
			fieldname: 'calendar_name',
			value: name,
		})
		renaming.value = false
		emit('changed', calendar)
		toast.success(__('Calendar renamed'))
	} catch (err) {
		toast.error(resourceErrorMessage(err))
		focusName()
	}
}

const confirmDisconnect = () => {
	createDialog({
		title: __('Disconnect Google Calendar?'),
		message: __(
			'New evaluations will be booked without a calendar event or Google Meet link. Events already on your calendar stay there.'
		),
		size: 'sm',
		actions: [
			{
				label: __('Disconnect'),
				theme: 'red',
				variant: 'solid',
				onClick({ close }: { close: () => void }) {
					close()
					disconnectCalendar.submit()
				},
			},
		],
	})
}
</script>
