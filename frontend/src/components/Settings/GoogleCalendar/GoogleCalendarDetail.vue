<template>
	<SettingsLayout
		:title="heading"
		show-back
		:unsaved="source.isDirty"
		:save-label="__('Save')"
		:can-save="source.isDirty"
		:saving="saving"
		save-testid="google-calendar-save"
		v-model:enabled="enabled"
		@back="emit('back')"
		@save="save"
	>
		<SettingsFields
			v-if="source.doc"
			:sections="sections"
			:data="source.doc"
			flush
			@commit="() => {}"
		/>
		<div class="mt-6 border-t border-outline-elevation-2 pt-6">
			<Button
				:label="__('Authorize Google Calendar Access')"
				:disabled="source.isNew"
				:loading="authorizing"
				@click="authorize"
			/>
			<p v-if="source.isNew" class="text-p-sm text-ink-gray-5 mt-2">
				{{ __('Save the calendar before authorizing it.') }}
			</p>
		</div>
	</SettingsLayout>
</template>

<script setup lang="ts">
// A custom detail page, not `recordForm()`: the Authorize button isn't a
// field the shared schema can express, so this hand-rolls the same shape
// (manual save, dirty guard, rename) and adds the one thing it can't.
import { computed, ref, watch } from 'vue'
import { Button, call, toast } from 'frappe-ui'
import SettingsFields from '@/components/Layouts/settings/desktop/SettingsFields.vue'
import SettingsLayout from '@/components/Layouts/settings/desktop/SettingsLayout.vue'
import { useDirtyGuard } from '@/composables/useDirtyGuard'
import { useSettingsSource } from '@/composables/useSettingsSource'
import { openExternal } from '@/utils/openExternal'
import type { FieldsSection } from '@/types/settingsSchema'

const props = defineProps<{ name: string }>()
const emit = defineEmits<{ back: []; renamed: [string] }>()

const record = computed(() => props.name ?? null)

const source = useSettingsSource(
	{ doctype: 'Google Calendar', record: 'route' },
	{ record, renameField: 'calendar_name' }
)

useDirtyGuard(
	() => source.isDirty,
	() => void source.reload()
)

const heading = computed(() =>
	source.isNew
		? __('New Google Calendar')
		: source.doc?.calendar_name || __('Google Calendar')
)

// Hoisted into the header, the way every other record form here hoists its
// on/off switch, excluded from `sections` below so it is not drawn twice.
const enabled = computed<boolean | undefined>({
	get: () => (source.doc ? Boolean(source.doc.enable) : undefined),
	set: (value) => {
		if (source.doc) source.doc.enable = value ? 1 : 0
	},
})

const sections: FieldsSection[] = [
	{
		fields: [
			{
				name: 'calendar_name',
				label: 'Calendar Name',
				description: 'The name that will appear in Google Calendar',
				type: 'text',
				reqd: true,
			},
			{
				name: 'user',
				label: 'User',
				type: 'link',
				doctype: 'User',
				reqd: true,
			},
			{
				name: 'push_to_google_calendar',
				label: 'Push to Google Calendar',
				description:
					'Events this app creates only sync to Google Calendar while this is on. Off looks configured and syncs nothing.',
				type: 'checkbox',
				default: 1,
			},
		],
	},
]

watch(
	() => source.name,
	(name, previous) => {
		if (name && previous && name !== previous) emit('renamed', name)
	}
)

const saving = ref(false)

const reportFailure = (error: { messages?: string[]; message?: string }) => {
	toast.error(error?.messages?.[0] || error?.message || __('Save failed'))
}

const save = () => {
	saving.value = true
	const wasNew = source.isNew
	source
		.save()
		.then(() => {
			toast.success(
				wasNew
					? __('Google Calendar created successfully')
					: __('Google Calendar updated successfully')
			)
			// Same lifecycle every record form here follows: a create closes back
			// to the list, so Authorize is only ever reachable on a record the
			// list has already fetched. That's what "disabled until saved" means
			// here, since a still-new draft never keeps the button on screen long
			// enough to click.
			if (wasNew) emit('back')
		})
		.catch(reportFailure)
		.finally(() => (saving.value = false))
}

const authorizing = ref(false)

const authorize = () => {
	if (source.isNew || !source.name) return
	authorizing.value = true
	call(
		'frappe.integrations.doctype.google_calendar.google_calendar.authorize_access',
		{
			g_calendar: source.name,
			reauthorize: 1,
		}
	)
		.then((result: unknown) => {
			const url = (result as { url?: string } | undefined)?.url
			if (url) openExternal(url)
			else toast.success(__('Google Calendar authorized'))
		})
		.catch(reportFailure)
		.finally(() => (authorizing.value = false))
}
</script>
