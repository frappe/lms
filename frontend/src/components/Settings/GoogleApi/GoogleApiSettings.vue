<template>
	<SettingsLayout
		:title="__('Google API')"
		:description="
			__('OAuth credentials Google Calendar and Google Meet authorize against.')
		"
		:unsaved="isDirty"
		:save-label="__('Save')"
		:can-save="isDirty"
		:saving="saving"
		save-testid="google-api-save"
		@save="save"
	>
		<div v-if="source.doc" class="divide-y divide-outline-elevation-2">
			<div class="flex items-center justify-between gap-4 py-3">
				<div class="flex flex-col">
					<div class="text-p-base-medium text-ink-gray-7">
						{{ __('Enable') }}
					</div>
					<div class="text-p-sm text-ink-gray-5">
						{{ __('Turns on Google API access for this site.') }}
					</div>
				</div>
				<BooleanSwitch
					size="sm"
					:model-value="Boolean(source.doc.enable)"
					:aria-label="__('Enable Google API')"
					@update:model-value="(value) => setField('enable', value ? 1 : 0)"
				/>
			</div>
			<div class="py-3">
				<div class="text-p-base-medium text-ink-gray-7 mb-2">
					{{ __('Client ID') }}
				</div>
				<FormControl
					type="text"
					class="w-full"
					:model-value="source.doc.client_id"
					:aria-label="__('Client ID')"
					@update:model-value="(value: string) => setField('client_id', value)"
				/>
			</div>
			<div class="py-3">
				<div class="text-p-base-medium text-ink-gray-7 mb-2">
					{{ __('Client Secret') }}
				</div>
				<FormControl
					type="password"
					class="w-full"
					v-model="secretInput"
					:placeholder="
						hasExistingSecret
							? __('Saved, leave blank to keep it')
							: __('Client Secret')
					"
					:aria-label="__('Client Secret')"
				/>
			</div>
		</div>
	</SettingsLayout>
</template>

<script setup lang="ts">
// A custom page rather than `kind: 'fields'`, deliberately: the shared
// FieldsPanel diffs `doc` against `originalDoc` and sends whatever differs,
// which is exactly wrong for a Password field. `client_secret` is loaded as
// Frappe's dummy mask ("*" x length) or empty, and this box never shows
// either — it starts blank, `secretInput` lives OUTSIDE `source.doc`
// entirely, and the outgoing write only ever carries the field when the box
// actually holds something. An untouched box therefore leaves the stored
// secret exactly as it was, whichever save path fires: the shared
// getChangedFields() diff never sees `client_secret` because it is never on
// the document, and this component's own `save()` skips the explicit
// `set_value` call the same way. See google_calendar.ts for the read side of
// the same contract on Google Calendar's own Password fields.
import { computed, ref } from 'vue'
import { FormControl, call, toast } from 'frappe-ui'
import BooleanSwitch from '@/components/Controls/BooleanSwitch.vue'
import SettingsLayout from '@/components/Layouts/settings/desktop/SettingsLayout.vue'
import { useSettingsSource } from '@/composables/useSettingsSource'

const DOCTYPE = 'Google Settings'
const NAME = 'Google Settings'

const source = useSettingsSource({ doctype: DOCTYPE, name: NAME })

// Truthy the moment a secret has ever been set: a never-set Password field
// loads null/empty, and a set one loads the dummy mask, never blank.
const hasExistingSecret = computed(() => Boolean(source.doc?.client_secret))

const secretInput = ref('')

const setField = (field: 'enable' | 'client_id', value: unknown) => {
	if (source.doc) source.doc[field] = value
}

const isDirty = computed(() => source.isDirty || secretInput.value.length > 0)

const saving = ref(false)

const reportFailure = (error: { messages?: string[]; message?: string }) => {
	toast.error(error?.messages?.[0] || error?.message || __('Save failed'))
}

const save = () => {
	saving.value = true
	const writeSecret = secretInput.value
		? call('frappe.client.set_value', {
				doctype: DOCTYPE,
				name: NAME,
				fieldname: 'client_secret',
				value: secretInput.value,
		  })
		: Promise.resolve()

	Promise.all([source.save(), writeSecret])
		.then(() => {
			toast.success(__('Google API settings saved'))
			secretInput.value = ''
		})
		.catch(reportFailure)
		.finally(() => (saving.value = false))
}
</script>
