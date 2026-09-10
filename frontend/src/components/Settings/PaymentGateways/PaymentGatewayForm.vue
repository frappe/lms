<template>
	<SettingsLayout
		:title="formTitle"
		show-back
		:unsaved="isDirty"
		:save-label="__('Save')"
		:saving="saving"
		:can-save="isDirty"
		@back="emit('back')"
		@save="save"
	>
		<div v-if="loading" class="flex flex-1 items-center justify-center py-20">
			<LoadingIndicator class="size-5 text-ink-gray-5" />
		</div>

		<div v-else class="space-y-4">
			<div v-if="isNew" class="flex items-center justify-between gap-8">
				<div class="flex flex-col">
					<div class="text-p-base-medium text-ink-gray-7">
						{{ __('Provider') }}
					</div>
					<div class="text-p-sm text-ink-gray-5">
						{{ __('Choose a provider to configure its credentials.') }}
					</div>
				</div>
				<Combobox
					v-model="provider"
					class="w-48"
					:options="providerOptions"
					:placeholder="__('Select a provider')"
				/>
			</div>

			<div
				v-if="isNew && fields.length"
				class="h-px border-t border-outline-elevation-2"
			/>

			<div v-if="credentialFields.length" class="grid grid-cols-2 gap-4">
				<FormControl
					v-for="field in credentialFields"
					:key="field.name"
					v-model="doc[field.name]"
					:label="__(field.label)"
					:type="controlType(field)"
					:options="selectOptions(field)"
					:placeholder="placeholder(field)"
					:description="description(field)"
					:required="Boolean(field.reqd)"
					autocomplete="off"
				/>
			</div>

			<FormControl
				v-for="field in noteFields"
				:key="field.name"
				v-model="doc[field.name]"
				type="textarea"
				:rows="3"
				:label="__(field.label)"
				:description="description(field)"
				:required="Boolean(field.reqd)"
			/>

			<template v-if="rowFields.length">
				<div class="h-px border-t border-outline-elevation-2" />

				<div
					v-for="field in toggleFields"
					:key="field.name"
					class="flex items-center justify-between gap-8"
				>
					<div class="flex min-w-0 flex-col">
						<div class="text-p-base-medium text-ink-gray-7">
							{{ __(field.label) }}
						</div>
						<div v-if="field.description" class="text-p-sm text-ink-gray-5">
							{{ __(field.description) }}
						</div>
					</div>
					<Switch
						size="sm"
						:model-value="Boolean(doc[field.name])"
						:aria-label="__(field.label)"
						@update:model-value="(on: boolean) => setCheck(field, on)"
					/>
				</div>

				<ImageUploadField
					v-for="field in uploadFields"
					:key="field.name"
					:label="__(field.label)"
					:description="fileName(doc[field.name]) || __('No file attached')"
					:image_url="String(doc[field.name] || '')"
					:is_private="true"
					:required="Boolean(field.reqd)"
					@upload="(url: string) => (doc[field.name] = url)"
					@remove="doc[field.name] = null"
				/>
			</template>
		</div>
	</SettingsLayout>
</template>

<script setup lang="ts">
import {
	Combobox,
	FormControl,
	LoadingIndicator,
	Switch,
	call,
	createDocumentResource,
	toast,
} from 'frappe-ui'
import { computed, reactive, ref, shallowRef, watch } from 'vue'
import ImageUploadField from '@/components/Controls/ImageUploadField.vue'
import SettingsLayout from '@/components/Layouts/settings/desktop/SettingsLayout.vue'
import {
	DOCTYPE,
	NEW_GATEWAY,
	SETTINGS_SUFFIX,
	providerName,
} from '@/components/Settings/PaymentGateways/paymentGateways'
import { reloadSettingsLists } from '@/composables/useSettingsListResource'
import { useDirtyGuard } from '@/composables/useDirtyGuard'
import { runSave, useSaveState } from '@/composables/useSettingsSave'
import { cleanError } from '@/utils'
import type { SettingsDocumentResource } from '@/composables/useSettingsSource'
import type { SettingsListRow } from '@/types'

/**
 * One payment gateway, behind both New and a row.
 *
 * Credentials draw as a two-column FormControl grid, with state fields
 * (sandbox switch, header image) as their own row below a divider, CRM's
 * Telephony > Twilio shape.
 */

const props = defineProps<{ name?: string | null }>()

const emit = defineEmits<{ back: [] }>()

interface GatewayField {
	name: string
	label: string
	/** A frappe fieldtype, except Attach → `Upload` and Check → `checkbox`. */
	type: string
	reqd?: number
	options?: string
	default?: string
	description?: string
}

interface Provider {
	label: string
	value: string
	issingle: boolean
}

/** What get_payment_gateway_details says about a configured gateway. */
interface GatewayDetails {
	fields: GatewayField[]
	doctype: string
	docname: string
}

const currentGateway = computed(() => props.name ?? null)
const isNew = computed(() => currentGateway.value === NEW_GATEWAY)

const fields = ref<GatewayField[]>([])
const providers = ref<Provider[]>([])
const provider = ref<string | null>(null)
const fetching = ref(false)

const state = useSaveState()
const saving = state.saving

// A gateway that does not exist yet has no document to load, so it edits a
// plain object seeded from the field defaults.
const draft = reactive<SettingsListRow>({})

/**
 * The credentials document, populated once the server says which doctype
 * and record hold it. Can't use useSettingsSource here since it fixes the
 * doctype at setup, and this doctype isn't known until
 * get_payment_gateway_details answers.
 */
const settings = shallowRef<SettingsDocumentResource | null>(null)

const doc = computed<SettingsListRow>(() =>
	isNew.value ? draft : settings.value?.doc ?? {}
)

const loading = computed(
	() => fetching.value || Boolean(settings.value && !settings.value.doc)
)

const formTitle = computed(() =>
	isNew.value ? __('New Payment Gateway') : currentGateway.value || ''
)

const clearDraft = () => {
	for (const key of Object.keys(draft)) delete draft[key]
}

const reportError = (err: any, fallback: string) =>
	toast.error(cleanError(err?.messages?.[0] || err) || fallback)

/**
 * A configured gateway's fields and the document behind them.
 *
 * Metadata comes from the whitelisted method, since only the server knows
 * where credentials live. Values come from the document itself, so save
 * only sends the fields that changed.
 */
const loadGateway = async (gateway: string) => {
	fetching.value = true
	try {
		const details = await call<GatewayDetails>(
			'lms.lms.api.get_payment_gateway_details',
			{ payment_gateway: gateway }
		)
		fields.value = details.fields || []
		settings.value = createDocumentResource({
			doctype: details.doctype,
			name: details.docname,
			auto: true,
			// The try/catch above covers get_payment_gateway_details only; this
			// resource fetches on its own. frappe-ui nulls `doc` on a failed get,
			// which `loading` reads as "still loading", so a deleted or
			// unreadable record would otherwise spin forever.
			onError: (err: any) => {
				reportError(err, __('Error loading payment gateway'))
				emit('back')
			},
		}) as unknown as SettingsDocumentResource
	} catch (err: any) {
		reportError(err, __('Error loading payment gateway'))
		emit('back')
	} finally {
		fetching.value = false
	}
}

/**
 * The providers that can still be added.
 *
 * Only `<Provider> Settings` doctypes: matching on the first word alone
 * would also catch other doctypes in the same module (GoCardless Mandate).
 * Existing gateways come from their own unfiltered, unpaged query, since
 * reading the on-screen list could hide a configured one behind a search
 * term or the 13-row page, and re-adding it would overwrite its credentials.
 */
const loadProviders = async () => {
	fetching.value = true
	try {
		const [doctypes, configured] = await Promise.all([
			call<SettingsListRow[]>('frappe.client.get_list', {
				doctype: 'DocType',
				filters: { module: 'Payment Gateways' },
				fields: ['name', 'issingle'],
				limit_page_length: 0,
			}),
			call<SettingsListRow[]>('frappe.client.get_list', {
				doctype: DOCTYPE,
				fields: ['name'],
				limit_page_length: 0,
			}),
		])
		const taken = new Set((configured || []).map((row) => row.name))
		providers.value = (doctypes || [])
			.filter((row) => String(row.name).endsWith(SETTINGS_SUFFIX))
			.map((row) => ({
				label: providerName(row.name),
				value: String(row.name),
				issingle: Boolean(row.issingle),
			}))
			.filter((option) => !taken.has(option.label))
	} catch (err: any) {
		reportError(err, __('Error loading payment providers'))
	} finally {
		fetching.value = false
	}
}

const providerOptions = computed(() =>
	providers.value.map((option) => ({
		label: option.label,
		value: option.value,
	}))
)

const chosenProvider = computed(() =>
	providers.value.find((option) => option.value === provider.value)
)

watch(provider, async (doctype) => {
	fields.value = []
	clearDraft()
	if (!doctype) return
	fetching.value = true
	try {
		fields.value = await call<GatewayField[]>(
			'lms.lms.api.get_new_gateway_fields',
			{ doctype }
		)
		for (const field of fields.value) draft[field.name] = field.default ?? ''
	} catch (err: any) {
		reportError(err, __('Error loading provider fields'))
	} finally {
		fetching.value = false
	}
})

// Fieldtypes with no box of their own here: a Button runs a server method this
// form cannot call, and the rest carry no value of their own.
const IGNORED = new Set(['Button', 'HTML', 'Heading', 'Table', 'Tab Break'])

// Long values get the full width and a textarea; a credential never does.
const NOTE_TYPES = new Set(['Small Text', 'Long Text', 'Text', 'Code'])

const shown = computed(() =>
	fields.value.filter((field) => !IGNORED.has(field.type))
)

const noteFields = computed(() =>
	shown.value.filter((field) => NOTE_TYPES.has(field.type))
)

const toggleFields = computed(() =>
	shown.value.filter((field) => field.type === 'checkbox')
)

const uploadFields = computed(() =>
	shown.value.filter((field) => field.type === 'Upload')
)

// A switch and an attachment are states rather than values, so they are rows
// under a divider rather than cells in the credentials grid.
const rowFields = computed(() => [...toggleFields.value, ...uploadFields.value])

const credentialFields = computed(() =>
	shown.value.filter(
		(field) =>
			!NOTE_TYPES.has(field.type) &&
			field.type !== 'checkbox' &&
			field.type !== 'Upload'
	)
)

// The box a credential is typed into. A fieldtype this does not name falls
// through to a text box, which is what the value is on the wire anyway.
const controlType = (field: GatewayField) => {
	switch (field.type) {
		case 'Password':
			return 'password'
		case 'Select':
			return 'select'
		case 'Int':
		case 'Float':
		case 'Currency':
		case 'Percent':
			return 'number'
		case 'Date':
			return 'date'
		case 'Datetime':
			return 'datetime'
		case 'Time':
			return 'time'
		default:
			return 'text'
	}
}

const selectOptions = (field: GatewayField) =>
	field.type === 'Select' ? (field.options || '').split('\n') : undefined

// A secret has no example to show, so the box says nothing rather than
// repeating its own label back at it.
const placeholder = (field: GatewayField) =>
	field.type === 'Password' ? undefined : __(field.label)

const description = (field: GatewayField) =>
	field.description ? __(field.description) : undefined

// Frappe stores a Check as 0/1, and that is what a set_value has to send.
const setCheck = (field: GatewayField, on: boolean) => {
	doc.value[field.name] = on ? 1 : 0
}

const fileName = (value: unknown) =>
	typeof value === 'string' ? value.split('/').pop() : ''

/**
 * A draft is dirty once a field differs from the default it was seeded
 * with, so picking a provider whose sandbox box is checked by default
 * doesn't itself count as an edit waiting to be saved.
 */
const draftIsDirty = () =>
	fields.value.some(
		(field) => String(draft[field.name] ?? '') !== String(field.default ?? '')
	)

const isDirty = computed(() =>
	isNew.value ? draftIsDirty() : Boolean(settings.value?.isDirty)
)

useDirtyGuard(
	() => isDirty.value,
	// A gateway that exists refetches its credentials; one being created has
	// only the draft, and discarding it means dropping what was typed.
	() => {
		if (isNew.value) clearDraft()
		else void settings.value?.reload()
	}
)

/**
 * A gateway that does not exist yet.
 *
 * A Single writes onto its own record; anything else inserts a new
 * document. Either way the provider's `on_update` creates the Payment
 * Gateway the list shows, so the list is refetched rather than added to.
 */
const createGateway = async () => {
	const chosen = chosenProvider.value
	if (!chosen) return
	if (chosen.issingle) {
		await call('frappe.client.set_value', {
			doctype: chosen.value,
			name: chosen.value,
			fieldname: { ...draft },
		})
	} else {
		await call('frappe.client.insert', {
			doc: { doctype: chosen.value, ...draft },
		})
	}
}

const save = () => {
	const creating = isNew.value
	return runSave(state, {
		run: () =>
			creating
				? createGateway()
				: settings.value?.save.submit() ?? Promise.resolve(),
		success: creating
			? __('Payment gateway created successfully')
			: __('Payment gateway updated successfully'),
		// The provider's own `on_update` is what creates the Payment Gateway the
		// list shows, so the list is refetched rather than added to.
		after: async () => {
			await reloadSettingsLists(DOCTYPE)
			if (creating) emit('back')
		},
		failure: (err: any) =>
			cleanError(err?.messages?.[0] || err) ||
			__('Error saving payment gateway'),
	})
}

// The form mounts on the gateway the list opened, so this is where the load
// runs. Placed last because both loaders are consts, calling either from
// higher up would reach them before their initialiser has run.
if (isNew.value) loadProviders()
else if (currentGateway.value) loadGateway(currentGateway.value)
</script>
