<template>
	<SettingsLayout
		:title="__('Services')"
		:unsaved="isDirty"
		:save-label="__('Save')"
		:can-save="isDirty"
		:saving="saving"
		save-testid="services-save"
		@save="save"
	>
		<div class="divide-y divide-outline-elevation-2">
			<div class="py-3">
				<div class="text-p-base-medium text-ink-gray-7 mb-2">
					{{ __('Livecode URL') }}
				</div>
				<FormControl
					type="text"
					class="w-full"
					:model-value="lmsSource.doc?.livecode_url"
					:aria-label="__('Livecode URL')"
					@update:model-value="(value: string) => setLmsField('livecode_url', value)"
				/>
				<div class="text-p-sm text-ink-gray-5 mt-1">
					{{
						__(
							"Address of the LiveCode server that runs the code learners write in programming exercises. Leave it blank to use Frappe's hosted server, or see https://docs.frappe.io/learning/falcon-self-hosting-guide to host your own."
						)
					}}
				</div>
			</div>
			<div class="py-3">
				<div class="text-p-base-medium text-ink-gray-7 mb-2">
					{{ __('Unsplash Access Key') }}
				</div>
				<FormControl
					type="password"
					class="w-full"
					:model-value="lmsSource.doc?.unsplash_access_key"
					:aria-label="__('Unsplash Access Key')"
					@update:model-value="
						(value: string) => setLmsField('unsplash_access_key', value)
					"
				/>
				<div class="text-p-sm text-ink-gray-5 mt-1">
					{{
						__(
							'Allows users to pick a profile cover image from Unsplash. https://unsplash.com/documentation#getting-started.'
						)
					}}
				</div>
			</div>
		</div>

		<template v-if="googleSource">
			<div class="text-p-lg-semibold text-ink-gray-8 mb-1 mt-6">
				{{ __('Google API') }}
			</div>
			<div class="divide-y divide-outline-elevation-2">
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
						:model-value="Boolean(googleSource?.doc?.enable)"
						:aria-label="__('Enable Google API')"
						@update:model-value="
							(value) => setGoogleField('enable', value ? 1 : 0)
						"
					/>
				</div>
				<div class="py-3">
					<div class="text-p-base-medium text-ink-gray-7 mb-2">
						{{ __('Client ID') }}
					</div>
					<FormControl
						type="text"
						class="w-full"
						:model-value="googleSource?.doc?.client_id"
						:error="clientIdError"
						:aria-label="__('Client ID')"
						@update:model-value="(value: string) => setGoogleField('client_id', value)"
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
						:error="clientSecretError"
						:placeholder="
							hasExistingSecret
								? __('Saved, leave blank to keep it')
								: __('Client Secret')
						"
						:aria-label="__('Client Secret')"
					/>
				</div>
			</div>
		</template>
	</SettingsLayout>
</template>

<script setup lang="ts">
// One page, two documents: `Google Settings` (System Manager-gated) and
// `LMS Settings` (Livecode/Unsplash, open to any Moderator). `client_secret`
// loads as Frappe's dummy mask or empty, so `secretInput` lives outside
// `googleSource.doc` and the write only carries it when actually typed into.
import { computed, ref } from 'vue'
import { FormControl, call, toast } from 'frappe-ui'
import BooleanSwitch from '@/components/Controls/BooleanSwitch.vue'
import SettingsLayout from '@/components/Layouts/settings/desktop/SettingsLayout.vue'
import { useSettingsSource } from '@/composables/useSettingsSource'
import { canManageGoogleIntegrations } from '@/components/Settings/GoogleApi/googleApi'

const GOOGLE_DOCTYPE = 'Google Settings'
const GOOGLE_NAME = 'Google Settings'

// A Moderator without System Manager holds no permission on Google Settings,
// and creating the resource below would throw the instant it fetches. Not
// calling useSettingsSource here is what keeps the page usable for one.
const googleSource = canManageGoogleIntegrations()
	? useSettingsSource({ doctype: GOOGLE_DOCTYPE, name: GOOGLE_NAME })
	: null

const lmsSource = useSettingsSource({ doc: 'LMS Settings' })

const setGoogleField = (field: 'enable' | 'client_id', value: unknown) => {
	if (googleSource?.doc) googleSource.doc[field] = value
}

const setLmsField = (
	field: 'livecode_url' | 'unsplash_access_key',
	value: unknown
) => {
	if (lmsSource.doc) lmsSource.doc[field] = value
}

// Truthy the moment a secret has ever been set: a never-set Password field
// loads null/empty, and a set one loads the dummy mask, never blank.
const hasExistingSecret = computed(() =>
	Boolean(googleSource?.doc?.client_secret)
)

const secretInput = ref('')

const googleEnabled = computed(() => Boolean(googleSource?.doc?.enable))

// Google API cannot be turned on without something to authenticate with:
// Client ID always, Client Secret unless one is already saved.
const clientIdError = computed(() =>
	googleEnabled.value && !String(googleSource?.doc?.client_id ?? '').trim()
		? __('Client ID is required to enable Google API')
		: ''
)
const clientSecretError = computed(() =>
	googleEnabled.value && !hasExistingSecret.value && !secretInput.value
		? __('Client Secret is required to enable Google API')
		: ''
)
const hasBlockingErrors = computed(
	() => Boolean(clientIdError.value) || Boolean(clientSecretError.value)
)

const isDirty = computed(
	() =>
		(Boolean(googleSource) &&
			(Boolean(googleSource?.isDirty) || secretInput.value.length > 0)) ||
		Boolean(lmsSource.isDirty)
)

const saving = ref(false)

const reportFailure = (error: { messages?: string[]; message?: string }) => {
	toast.error(error?.messages?.[0] || error?.message || __('Save failed'))
}

const save = () => {
	if (hasBlockingErrors.value) {
		toast.error(
			__('Client ID and Client Secret are required to enable Google API')
		)
		return
	}

	saving.value = true
	const secretValue = secretInput.value

	// googleSource.save() and the secret set_value both write "Google
	// Settings"; running them via Promise.all races two writes against the
	// same `modified` timestamp and 409s. Sequence the secret write after.
	Promise.all([
		googleSource ? googleSource.save() : Promise.resolve(),
		lmsSource.save(),
	])
		.then(() =>
			secretValue
				? call('frappe.client.set_value', {
						doctype: GOOGLE_DOCTYPE,
						name: GOOGLE_NAME,
						fieldname: 'client_secret',
						value: secretValue,
				  })
				: Promise.resolve()
		)
		.then(() => {
			toast.success(__('Services settings saved'))
			secretInput.value = ''
		})
		.catch(reportFailure)
		.finally(() => (saving.value = false))
}
</script>
