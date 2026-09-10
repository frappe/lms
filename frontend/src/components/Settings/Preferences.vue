<template>
	<SettingsLayout :save-state="saveState">
		<div v-if="settings.doc">
			<div class="text-p-lg-semibold text-ink-gray-8 mb-1">
				{{ __('Preferences') }}
			</div>

			<div class="divide-y divide-outline-elevation-2">
				<div class="flex items-center justify-between gap-4 py-3">
					<div class="flex flex-col">
						<div class="text-p-base-medium text-ink-gray-7">
							{{ __('System Language') }}
						</div>
						<div class="text-p-sm text-ink-gray-5">
							{{ __('The language this site falls back to.') }}
						</div>
					</div>
					<div class="shrink-0">
						<Link
							:key="controlKey.language"
							:model-value="systemLanguage"
							doctype="Language"
							data-test="system-language"
							:readonly="!systemEditable"
							:aria-label="__('System Language')"
							class="w-48"
							@update:model-value="(value) => onSystemSelect('language', value)"
						/>
					</div>
				</div>

				<div class="flex items-center justify-between gap-4 py-3">
					<div class="flex flex-col">
						<div class="text-p-base-medium text-ink-gray-7">
							{{ __('System Timezone') }}
						</div>
						<div class="text-p-sm text-ink-gray-5">
							{{ __('The timezone new batches and courses start from.') }}
						</div>
					</div>
					<div class="shrink-0">
						<Combobox
							:key="controlKey.time_zone"
							:model-value="systemTimezone"
							:options="timezoneOptions"
							data-test="system-timezone"
							:disabled="!systemEditable"
							:aria-label="__('System Timezone')"
							:placeholder="__('Search timezone')"
							class="w-48"
							@update:model-value="
								(value) => onSystemSelect('time_zone', value)
							"
						/>
					</div>
				</div>

				<div class="flex items-center justify-between gap-4 py-3">
					<div class="flex flex-col">
						<div class="text-p-base-medium text-ink-gray-7">
							{{ __('Text Direction') }}
						</div>
						<div class="text-p-sm text-ink-gray-5">
							{{ __('Auto follows the language of the site.') }}
						</div>
					</div>
					<div class="shrink-0">
						<Select
							v-model="textDirection"
							:options="directionOptions"
							data-test="text-direction"
							:aria-label="__('Text Direction')"
							class="w-48"
							@update:model-value="() => docSave.commit('now')"
						/>
					</div>
				</div>
			</div>

			<div class="mt-6">
				<SettingsFields
					:sections="accessSections"
					:data="settings.doc"
					@commit="docSave.commit"
				/>
			</div>
		</div>
	</SettingsLayout>
</template>

<script setup lang="ts">
import {
	Combobox,
	Select,
	createDocumentResource,
	createResource,
} from 'frappe-ui'
import { computed, inject, reactive, ref, watch, type Ref } from 'vue'
import Link from '@/components/Controls/Link.vue'
import SettingsFields from '@/components/Layouts/settings/desktop/SettingsFields.vue'
import SettingsLayout from '@/components/Layouts/settings/desktop/SettingsLayout.vue'
import { useAutosave, type AutosaveStatus } from '@/composables/useAutosave'
import { useSettings } from '@/stores/settings'
import type { User } from '@/types/settings'

interface SystemPreferences {
	language: string
	time_zone: string
	timezones: string[]
}

// The shape this page uses of a frappe-ui document resource. `isDirty`
// compares doc vs originalDoc; `submit()` resolves or rejects, and skips
// the round trip when nothing changed, so calling it on a clean doc is free.
interface SettingsResource {
	doc: Record<string, any>
	isDirty?: boolean
	save: {
		submit: (values?: object, options?: object) => Promise<unknown>
		loading: boolean
	}
}

// `label` and `description` are the sidebar item's, handed down by
// Settings.vue to every panel. Undeclared props fall through to the root
// element, and `label="General"` on a div is not markup we want.
const props = defineProps<{
	label: string
	description?: string
	data?: SettingsResource
}>()

const settingsStore = useSettings()
const user = inject<User>('$user')

// Settings.vue hands the LMS Settings resource down as `data`. Falling
// back to fetching it here is not a second copy: createDocumentResource
// returns the instance already cached under this doctype + name.
function cachedSettings(): SettingsResource {
	return createDocumentResource({
		doctype: 'LMS Settings',
		name: 'LMS Settings',
		fields: ['*'],
		cache: 'LMS Settings',
		auto: true,
	}) as unknown as SettingsResource
}

const settings = props.data ?? cachedSettings()

const canEditSystem = computed<boolean>(
	() => user?.data?.is_system_manager === true
)

// A doc saved before text_direction existed comes back null, and a Select
// bound to null renders an empty "Select option". Resolved for display
// only: writing Auto onto the doc would differ from originalDoc and mark
// the panel dirty on open, stuck at "Not saved" before any edit. Nothing is
// lost either way: resolve_text_direction only singles out 'Left to Right'
// and 'Right to Left', so null and Auto already mean the same to the server.
const TEXT_DIRECTION_DEFAULT = 'Auto'

const textDirection = computed<string>({
	get: () => settings.doc?.text_direction || TEXT_DIRECTION_DEFAULT,
	set: (value) => {
		if (settings.doc) settings.doc.text_direction = value
	},
})

type SystemField = 'language' | 'time_zone'

const systemLanguage = ref<string>('')
const systemTimezone = ref<string>('')

const systemValues: Record<SystemField, Ref<string>> = {
	language: systemLanguage,
	time_zone: systemTimezone,
}

// Bumped to remount the control whose clear was refused. A frappe-ui
// Combobox keeps its displayed text in an internal `query` ref and
// re-derives it from the value only once the popover closes, so restoring
// a value the prop already held would leave the box looking empty until
// then. Remounting re-derives it now.
const controlKey = reactive<Record<SystemField, number>>({
	language: 0,
	time_zone: 0,
})

const preferences = createResource({
	url: 'lms.lms.api.get_system_preferences',
	auto: true,
})

const savePreferences = createResource({
	url: 'lms.lms.api.set_system_preferences',
})
// The permission AND the answer. get_system_preferences only starts
// fetching on mount, but the panel renders as soon as LMS Settings has a
// doc, so there's a window where systemDirty reads false and the arrival
// watcher silently overwrites whatever was picked, with no error or "Not
// saved" marker.
const systemEditable = computed<boolean>(
	() => canEditSystem.value && Boolean(preferences.data)
)

// Seeded once, then only adopted again when the user has not moved on. `write`
// reloads this resource, and a pick made while that write was in flight would
// otherwise be overwritten by the answer and read as saved.
let systemSeeded = false

watch(
	() => preferences.data as SystemPreferences | undefined,
	(data) => {
		if (!data) return
		if (systemSeeded && systemDirty.value) return
		systemLanguage.value = data.language
		systemTimezone.value = data.time_zone
		systemSeeded = true
	},
	{ immediate: true }
)

const timezoneOptions = computed(() => {
	const data = preferences.data as SystemPreferences | undefined
	return (data?.timezones || []).map((zone) => ({
		label: zone,
		value: zone,
	}))
})

const directionOptions = computed(() => [
	{ label: __('Auto'), value: 'Auto' },
	{ label: __('Left to Right'), value: 'Left to Right' },
	{ label: __('Right to Left'), value: 'Right to Left' },
])

const accessSections = [
	{
		label: 'Access & Availability',
		fields: [
			{
				label: 'Allow Guest Access',
				name: 'allow_guest_access',
				description:
					'If enabled, users can access the course and batch lists without logging in.',
				type: 'checkbox',
			},
			{
				label: 'Disable PWA',
				name: 'disable_pwa',
				description:
					'If checked, users will not be able to install the application as a Progressive Web App.',
				type: 'checkbox',
			},
			{
				label: 'Allow Job Posting',
				name: 'allow_job_posting',
				description:
					'If enabled, users can post job openings on the job board. Else only admins can post jobs.',
				type: 'checkbox',
			},
		],
	},
	// Communication's own General page was dissolved into this one, so these
	// two sections arrive whole rather than being redistributed. They write
	// LMS Settings, which is the doc this page already autosaves, so they need
	// no writer of their own.
	{
		label: 'Contact Information',
		fields: [
			{
				label: 'Email',
				name: 'contact_us_email',
				type: 'text',
				description:
					'Users can reach out to this email for support or inquiries.',
			},
			{
				label: 'URL',
				name: 'contact_us_url',
				type: 'text',
				description:
					'Users can reach out to this URL for support or inquiries.',
			},
		],
	},
	// Both override the wording of the notification rule that sends that mail, so
	// a site that set one before upgrading keeps sending the old template and an
	// admin editing the rule sees no effect. Shown here so it can be cleared.
	{
		label: 'Email Templates',
		fields: [
			{
				label: 'Batch Confirmation Template',
				name: 'batch_confirmation_template',
				type: 'link',
				doctype: 'Email Template',
				description:
					'Replaces the wording of the batch enrollment notification.',
			},
			{
				label: 'Certificate Email Template',
				name: 'certification_template',
				type: 'link',
				doctype: 'Email Template',
				description: 'Replaces the wording of the certification notification.',
			},
		],
	},
	// Not a notification gate. It decides whether a booking carries a calendar
	// invite, not whether the evaluation mail is sent, which is why it sits with
	// the rest of the site's contact settings.
	{
		label: 'Evaluations',
		fields: [
			{
				label: 'Send calendar invite for evaluations',
				name: 'send_calendar_invite_for_evaluations',
				type: 'checkbox',
				description:
					'If enabled, it sends google calendar invite to the student for evaluations.',
			},
		],
	},
	{
		label: 'Notifications',
		fields: [
			{
				label: 'Send Notification for Published Courses',
				name: 'send_notification_for_published_courses',
				type: 'select',
				options: [' ', 'Email', 'In-app'],
				description: 'Notify members when a new course is published.',
			},
			{
				label: 'Send Notification for Published Batches',
				name: 'send_notification_for_published_batches',
				type: 'select',
				options: [' ', 'Email', 'In-app'],
				description: 'Notify members when a new batch is published.',
			},
		],
	},
]

// Two writers: access toggles and text direction are LMS Settings fields,
// while language and timezone are System Settings behind a System
// Manager-gated endpoint. Committing one must not write the other, since a
// moderator changing a toggle has no business issuing a privileged call.
const docSave = useAutosave({
	isDirty: () => Boolean(settings.isDirty),
	write: () =>
		settings.save.submit().then(() => settingsStore.loadSidebarSettings(true)),
})

// The system pair has no document behind it, so its clean value is what the
// endpoint last returned. Reloading that resource after a write takes the
// pair out of "Not saved", the same shape as originalDoc, one level up.
const systemDirty = computed<boolean>(() => {
	const data = preferences.data as SystemPreferences | undefined
	if (!data) return false
	return (
		systemLanguage.value !== data.language ||
		systemTimezone.value !== data.time_zone
	)
})

const systemSave = useAutosave({
	isDirty: () => canEditSystem.value && systemDirty.value,
	write: () =>
		savePreferences
			.submit({
				language: systemLanguage.value,
				time_zone: systemTimezone.value,
			})
			.then(() => preferences.reload()),
})

// A control the user cannot edit cannot have changed, and an unchanged value
// is not dirty, so a commit here writes only when there is something to write.
const commitSystem = () => systemSave.commit('now')

// Emptying either control isn't a choice this pair offers: Link clears to
// '' and Combobox to null, and the endpoint's `if value:` guard drops a
// cleared value without error, so systemDirty would read true with nothing
// left to write and "Not saved" would stick for good. Put the endpoint's
// last value back instead, and send nothing. Nothing needs cancelling here:
// cancel() only disarms a 'typing' timer, and this pair always commits 'now'.
const onSystemSelect = (field: SystemField, value: string | null) => {
	const current = systemValues[field]
	if (value) {
		current.value = value
		commitSystem()
		return
	}
	const data = preferences.data as SystemPreferences | undefined
	current.value = data?.[field] ?? ''
	controlKey[field] += 1
}

// One marker for both writers: whichever is busy speaks, and the quieter
// states only surface once nothing is in flight.
const saveState = computed<AutosaveStatus>(() => {
	const states = [docSave.status.value, systemSave.status.value]
	for (const state of ['saving', 'error', 'pending', 'dirty', 'saved'] as const)
		if (states.includes(state)) return state
	return 'idle'
})
</script>
