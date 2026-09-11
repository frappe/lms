<template>
	<SettingsLayout
		:title="title"
		show-back
		:unsaved="isNew ? false : isDirty"
		:save-label="__('Save')"
		:saving="saving"
		:can-save="isDirty"
		@back="emit('back')"
		@save="submit"
	>
		<div class="space-y-4">
			<EmailProviderPicker
				v-if="isNew && !state.service"
				:services="services"
				@pick="selectService"
			/>

			<template v-if="state.service">
				<div v-if="isNew && selected" class="flex items-center gap-3">
					<div
						class="flex size-8 shrink-0 items-center justify-center rounded-xl bg-surface-gray-2"
					>
						<img
							v-if="selected.icon"
							:src="selected.icon"
							:alt="__('{0} icon').format(selected.name)"
							class="size-4"
						/>
						<LucideMail v-else class="size-4 text-ink-gray-7" />
					</div>
					<div class="flex min-w-0 flex-col">
						<span class="text-p-base-medium text-ink-gray-8">{{
							selected.name
						}}</span>
						<span class="text-p-sm text-ink-gray-6">{{
							selected.description
						}}</span>
					</div>
					<Button
						variant="ghost"
						class="ms-auto"
						data-testid="change-provider"
						:label="__('Change')"
						@click="state.service = ''"
					/>
				</div>

				<div
					v-if="isNew && selected"
					class="flex items-center gap-2 rounded-md p-2 text-ink-gray-6 ring-1 ring-outline-gray-3"
				>
					<CircleAlert class="size-5 shrink-0" />
					<div class="text-wrap text-p-xs">
						{{ selected.info }}
						<a :href="safeUrl(selected.link)" v-external class="underline">{{
							__('here')
						}}</a
						>.
					</div>
				</div>

				<SettingsFields
					:sections="sections"
					:data="form"
					flush
					@commit="() => {}"
				/>
			</template>

			<ErrorMessage v-if="error" class="ms-1" :message="error" />
		</div>
	</SettingsLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Button, ErrorMessage, call, toast } from 'frappe-ui'
import { useTelemetry } from 'frappe-ui/frappe'
import { CircleAlert, Mail as LucideMail } from 'lucide-vue-next'
import SettingsFields from '@/components/Layouts/settings/desktop/SettingsFields.vue'
import SettingsLayout from '@/components/Layouts/settings/desktop/SettingsLayout.vue'
import EmailProviderPicker from './EmailProviderPicker.vue'
import {
	CUSTOM_SERVICE,
	EMAIL_ACCOUNT_METHODS,
	FRAPPE_MAIL,
	buildCreatePayload,
	buildUpdatePayload,
	customServerFields,
	customServerSwitches,
	frappeMailFields,
	incomingOutgoingFields,
	popularProviderFields,
	services,
	toSettingsField,
	validateInputs,
	type EmailAccountState,
} from './emailAccounts'
import { useDirtyGuard } from '@/composables/useDirtyGuard'
import { runSave, useSaveState } from '@/composables/useSettingsSave'
import { safeUrl } from '@/utils/safeUrl'
import type { EmailService } from '@/types'
import type { FieldsSection } from '@/types/settingsSchema'

/**
 * The one part of Settings > Communication > Email Accounts that is not config:
 * pick a provider, then fill in the fields that provider has.
 *
 * emailAccounts.ts owns the field sets, the validation and the payload shapes.
 * What is left here is the four things they cannot express: a choice that comes
 * before any field and decides which fields exist, a create that goes through a
 * whitelisted endpoint rather than an insert, an update that is two calls
 * because the account name is the document id, and a custom server whose host
 * and port only exist when no preset supplies them.
 *
 * Every call here names an LMS endpoint. Core Email Account grants no DocPerm
 * to Moderator, so the generic frappe.client.* calls this used to make were all
 * refused for the role the settings surface is gated on.
 */

// The record the panel opened, or the id it reserves for one that does not
// exist yet.
const props = defineProps<{ name?: string | null }>()

const emit = defineEmits<{ back: [] }>()

const NEW_RECORD = 'new'

// The empty-list picker opens a create form pre-selected on a provider by
// suffixing the reserved id: 'new:GMail'. SettingsListPanel treats the whole
// prefix as "open create" (see its own isCreateRecord); only this form reads
// the part after the colon.
const NEW_RECORD_WITH_SERVICE = `${NEW_RECORD}:`

const { capture } = useTelemetry()

const isNew = computed(
	() =>
		!props.name ||
		props.name === NEW_RECORD ||
		props.name.startsWith(NEW_RECORD_WITH_SERVICE)
)

// Falls back to '' (the picker) for a hint naming no known provider, rather
// than opening the fields on a service nothing here recognises.
const preselectedService = computed(() => {
	const name = props.name ?? ''
	if (!name.startsWith(NEW_RECORD_WITH_SERVICE)) return ''
	const hint = name.slice(NEW_RECORD_WITH_SERVICE.length)
	return services.some((service) => service.name === hint) ? hint : ''
})

const blankState = (): EmailAccountState => ({
	email_account_name: '',
	email_id: '',
	service: '',
	password: '',
	api_key: '',
	api_secret: '',
	frappe_mail_site: '',
	email_server: '',
	incoming_port: '',
	smtp_server: '',
	smtp_port: '',
	login: '',
	use_imap: true,
	use_ssl: true,
	use_ssl_for_outgoing: false,
	enable_incoming: false,
	// The account is being added to send from, until it is said otherwise.
	enable_outgoing: true,
	default_incoming: false,
	default_outgoing: false,
})

const state = reactive<EmailAccountState>(blankState())
if (preselectedService.value) state.service = preselectedService.value

// The same object, typed for the template: `v-model` on a bracket lookup needs
// a writable target, and the state's index signature is `unknown`.
const form = state as Record<string, any>

// The account as the server last returned it, which is what dirtiness is
// measured against. For a create that is the blank the form opened with.
const loaded = ref<Record<string, unknown>>({ ...blankState() })

const saveState = useSaveState()
const saving = saveState.saving
const error = saveState.error

const isCustom = computed(() => state.service === CUSTOM_SERVICE)

const selected = computed<EmailService | undefined>(() =>
	services.find((service) => service.name === state.service)
)

const credentialFields = computed(() =>
	state.service === FRAPPE_MAIL ? frappeMailFields : popularProviderFields
)

/**
 * The panel's fields, as SettingsFields renders them. Custom Server gets its
 * own labelled section only while it is on screen -- same rule `editable`
 * follows -- so switching away from Custom does not leave an empty heading.
 */
const sections = computed<FieldsSection[]>(() => {
	const result: FieldsSection[] = [
		{ fields: credentialFields.value.map(toSettingsField) },
	]
	if (isCustom.value)
		result.push({
			label: __('Custom Server'),
			fields: [
				...customServerFields.map(toSettingsField),
				...customServerSwitches.map(toSettingsField),
			],
		})
	result.push({
		label: __('Incoming & Outgoing'),
		fields: incomingOutgoingFields.map(toSettingsField),
	})
	return result
})

/**
 * Every field the update writes, which is what dirtiness is measured over.
 *
 * The custom-server set counts only while it is on screen, so switching
 * provider does not leave a hidden host reading as an unsaved change. The
 * account name is absent for the opposite reason: it is the document id, and a
 * rename is not a field write.
 */
const editable = computed(() =>
	[
		'service',
		...credentialFields.value.map((field) => field.name),
		...(isCustom.value
			? [...customServerFields, ...customServerSwitches].map(
					(field) => field.name
			  )
			: []),
		...incomingOutgoingFields.map((field) => field.name),
	].filter((field) => field !== 'email_account_name')
)

const title = computed(() =>
	isNew.value
		? __('Setup Email')
		: state.email_account_name || __('Email Account')
)

const selectService = (service: EmailService) => {
	state.service = service.name
}

/**
 * The four direction flags and the custom-server switches come back as 0/1 and
 * are compared against booleans here, so they are converted once, on arrival.
 *
 * A hand-entered server is stored with no service at all, so the blank is read
 * back as Custom — otherwise the form has no provider and draws no field.
 */
const seed = (account: Record<string, any>) => {
	Object.assign(state, {
		...account,
		service: account.service || CUSTOM_SERVICE,
		login: account.login_id_is_different ? account.login_id : '',
		use_imap: Boolean(account.use_imap),
		use_ssl: Boolean(account.use_ssl),
		use_ssl_for_outgoing: Boolean(account.use_ssl_for_outgoing),
		enable_incoming: Boolean(account.enable_incoming),
		enable_outgoing: Boolean(account.enable_outgoing),
		default_incoming: Boolean(account.default_incoming),
		default_outgoing: Boolean(account.default_outgoing),
	})
	loaded.value = { ...state }
}

onMounted(async () => {
	if (isNew.value) return
	try {
		const account = (await call(EMAIL_ACCOUNT_METHODS.get, {
			name: props.name,
		})) as Record<string, any> | null
		if (account) seed(account)
	} catch (err: any) {
		error.value = __('Failed to load email account')
		console.error(err)
	}
})

// A rename goes through its own endpoint, not the update, so the two are tracked
// apart: fieldsDirty gates the write, isDirty gates Save and Discard.
const fieldsDirty = computed(() =>
	editable.value.some((field) => state[field] !== loaded.value[field])
)

const isDirty = computed(
	() =>
		fieldsDirty.value ||
		state.email_account_name !== loaded.value.email_account_name
)

useDirtyGuard(
	() => isDirty.value,
	// seed() is the same path a fresh load takes, over the account this form
	// opened with.
	() => seed(loaded.value)
)

const createAccount = async () => {
	await call(EMAIL_ACCOUNT_METHODS.create, {
		data: buildCreatePayload(state),
	})
	toast.success(__('Email account created'))
	capture('email_account_created', { data: { service: state.service } })
}

const updateAccount = async () => {
	if (state.email_account_name !== loaded.value.email_account_name) {
		await call(EMAIL_ACCOUNT_METHODS.rename, {
			name: loaded.value.email_account_name,
			new_name: state.email_account_name,
		})
		// Record it the moment it commits. The field write below can still fail
		// on its own -- update_email_account calls doc.save(), which revalidates
		// the credentials against the live server, so a wrong password is
		// rejected there -- and a retry would otherwise rename from a name the
		// server has already forgotten, which `_require_account` throws on.
		loaded.value.email_account_name = state.email_account_name
	}
	if (fieldsDirty.value)
		await call(EMAIL_ACCOUNT_METHODS.update, {
			name: state.email_account_name,
			data: buildUpdatePayload(state),
		})
	toast.success(__('Email account updated successfully'))
}

// validateInputs takes the plain form shape, where an absent credential is
// undefined rather than the null a document returns.
const asFormState = (value: EmailAccountState) =>
	value as unknown as Parameters<typeof validateInputs>[0]

const submit = () => {
	const creating = isNew.value
	return runSave(saveState, {
		// An existing account holds its password as the mask the server returns,
		// so a blank one is not the user withholding it — allowMissingPassword.
		validate: () =>
			validateInputs(asFormState(state), state.service, !creating) ?? '',
		run: () => (creating ? createAccount() : updateAccount()),
		after: () => emit('back'),
		// Reported under the fields that caused it, not as a toast as well.
		toastError: false,
		failure: (err) => {
			console.error(err)
			return creating
				? __('Failed to create email account, Invalid credentials')
				: __('Failed to update email account, Invalid credentials')
		},
	})
}
</script>
