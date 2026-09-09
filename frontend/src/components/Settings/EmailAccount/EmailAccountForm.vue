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
			<div v-if="isNew" class="flex flex-wrap items-center gap-4">
				<button
					v-for="option in services"
					:key="option.name"
					type="button"
					:aria-pressed="state.service === option.name"
					class="flex w-[70px] flex-col items-center gap-1"
					@click="selectService(option)"
				>
					<EmailProviderIcon
						:service-name="option.name"
						:logo="option.icon"
						:selected="state.service === option.name"
					/>
				</button>
			</div>

			<template v-if="state.service">
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

				<div data-testid="credentials" class="grid grid-cols-2 gap-4">
					<FormControl
						v-for="field in credentialFields"
						:key="field.name"
						v-model="form[field.name]"
						:label="field.label"
						:name="field.name"
						:type="field.type"
						:placeholder="field.placeholder"
						:required="field.required"
						autocomplete="off"
					/>
				</div>

				<template v-if="isCustom">
					<div class="h-px border-t border-outline-elevation-2" />
					<div data-testid="custom-server" class="grid grid-cols-2 gap-4">
						<FormControl
							v-for="field in customServerFields"
							:key="field.name"
							v-model="form[field.name]"
							:label="field.label"
							:name="field.name"
							:type="field.type"
							:placeholder="field.placeholder"
							autocomplete="off"
						/>
					</div>
					<div class="space-y-4">
						<div
							v-for="field in customServerSwitches"
							:key="field.name"
							class="flex items-center justify-between gap-8"
						>
							<div class="flex flex-col">
								<div class="text-p-base-medium text-ink-gray-7">
									{{ field.label }}
								</div>
								<div class="text-p-sm text-ink-gray-5">
									{{ field.description }}
								</div>
							</div>
							<Switch
								v-model="form[field.name]"
								size="sm"
								:aria-label="field.label"
							/>
						</div>
					</div>
				</template>

				<div class="h-px border-t border-outline-elevation-2" />

				<div class="space-y-4">
					<div
						v-for="field in incomingOutgoingFields"
						:key="field.name"
						class="flex items-center justify-between gap-8"
					>
						<div class="flex flex-col">
							<div class="text-p-base-medium text-ink-gray-7">
								{{ field.label }}
							</div>
							<div class="text-p-sm text-ink-gray-5">
								{{ field.description }}
							</div>
						</div>
						<Switch
							v-model="form[field.name]"
							size="sm"
							:aria-label="field.label"
						/>
					</div>
				</div>
			</template>

			<ErrorMessage v-if="error" class="ms-1" :message="error" />
		</div>
	</SettingsLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ErrorMessage, FormControl, Switch, call, toast } from 'frappe-ui'
import { useTelemetry } from 'frappe-ui/frappe'
import { CircleAlert } from 'lucide-vue-next'
import SettingsLayout from '@/components/Layouts/settings/desktop/SettingsLayout.vue'
import EmailProviderIcon from './EmailProviderIcon.vue'
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
	validateInputs,
	type EmailAccountState,
} from './emailAccounts'
import { useDirtyGuard } from '@/composables/useDirtyGuard'
import { runSave, useSaveState } from '@/composables/useSettingsSave'
import { safeUrl } from '@/utils/safeUrl'
import type { EmailService } from '@/types'

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

const { capture } = useTelemetry()

const isNew = computed(() => !props.name || props.name === NEW_RECORD)

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
