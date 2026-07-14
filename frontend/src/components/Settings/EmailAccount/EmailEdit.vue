<template>
	<SettingsLayout
		:title="__('Edit Email')"
		:description="__('Edit your email account')"
		:show-back="true"
		@back="emit('update:step', 'email-list')"
	>
		<template #header-actions>
			<Button
				:label="__('Delete')"
				theme="red"
				variant="subtle"
				@click="showDeleteDialog = true"
			>
				<template #prefix>
					<span class="lucide-trash-2 size-4" />
				</template>
			</Button>
			<Button
				:label="__('Update Account')"
				variant="solid"
				:loading="loading"
				@click="updateAccount"
			/>
		</template>
		<div class="flex flex-col gap-4">
			<!-- fields -->
			<div class="flex flex-col gap-4">
				<div class="grid grid-cols-1 gap-4">
					<div
						v-for="field in fields"
						:key="field.name"
						class="flex flex-col gap-1"
					>
						<FormControl
							v-model="state[field.name]"
							:label="field.label"
							:name="field.name"
							:type="field.type"
							:placeholder="field.placeholder"
							:required="field.required"
						/>
					</div>
				</div>
				<div class="h-px border-t border-outline-elevation-2" />
				<div class="flex flex-col gap-4">
					<Switch
						v-for="field in incomingOutgoingFields"
						:key="field.name"
						v-model="state[field.name]"
						size="sm"
						:label="field.label"
						:description="field.description"
					/>
				</div>
				<ErrorMessage v-if="error" class="ml-1" :message="error" />
			</div>
		</div>
	</SettingsLayout>

	<Dialog
		v-model:open="showDeleteDialog"
		:title="__('Delete {0}?').format(props.accountData.email_account_name)"
		:message="
			__('This permanently deletes the email account and cannot be undone.')
		"
		size="sm"
		:actions="[
			{
				label: __('Delete'),
				theme: 'red',
				variant: 'solid',
				loading: deleting,
				onClick: deleteAccount,
			},
			{
				label: __('Cancel'),
				onClick: () => {
					showDeleteDialog = false
				},
			},
		]"
	/>
</template>

<script setup lang="ts">
import SettingsLayout from '@/components/Layouts/SettingsLayout.vue'
import { EmailAccount, EmailStep } from '@/types/email'
import {
	Button,
	Dialog,
	ErrorMessage,
	FormControl,
	Switch,
	call,
	createListResource,
	toast,
} from 'frappe-ui'
import { cleanError } from '@/utils'
import { computed, reactive, ref, watch } from 'vue'
import {
	frappeMailFields,
	incomingOutgoingFields,
	popularProviderFields,
	services,
	validateInputs,
} from './emailConfig'

interface EmailAccountState {
	email_account_name: string
	service: string
	email_id: string
	enable_incoming: boolean
	enable_outgoing: boolean
	default_incoming: boolean
	default_outgoing: boolean
	api_key?: string | null
	api_secret?: string | null
	password?: string | null
	frappe_mail_site?: string
}

interface P {
	accountData: EmailAccount
}

interface E {
	(event: 'update:step', step: EmailStep): void
}

const props = withDefaults(defineProps<P>(), {
	accountData: null,
})

const emit = defineEmits<E>()

const state = reactive<EmailAccountState>({
	email_account_name: props.accountData.email_account_name || '',
	service: props.accountData.service || '',
	email_id: props.accountData.email_id || '',
	api_key: props.accountData?.api_key || null,
	api_secret: props.accountData?.api_secret || null,
	password: props.accountData?.password || null,
	frappe_mail_site: props.accountData?.frappe_mail_site || '',
	enable_incoming: props.accountData.enable_incoming || false,
	enable_outgoing: props.accountData.enable_outgoing || false,
	default_incoming: props.accountData.default_incoming || false,
	default_outgoing: props.accountData.default_outgoing || false,
})

const currentServiceName = computed(
	() => state.service || props.accountData.service || ''
)

const serviceDef = computed(() =>
	services.find((s) => s.name === currentServiceName.value)
)

const fields = computed(() => {
	if (serviceDef.value?.name === 'Frappe Mail') {
		return frappeMailFields
	}
	return popularProviderFields
})

const error = ref<string | undefined>()
const loading = ref(false)

// shared cached accounts list — reload it so edits/renames show on return
const emailAccounts = createListResource({
	doctype: 'Email Account',
	cache: ['Email Accounts'],
})

const showDeleteDialog = ref(false)
const deleting = ref(false)

function deleteAccount() {
	if (deleting.value) return
	deleting.value = true
	emailAccounts.delete.submit(props.accountData.email_account_name, {
		onSuccess: () => {
			deleting.value = false
			showDeleteDialog.value = false
			toast.success(__('Email Account deleted successfully'))
			emit('update:step', 'email-list')
		},
		onError: (err: { messages?: string[] }) => {
			deleting.value = false
			toast.error(
				cleanError(err.messages?.[0]) || __('Error deleting email account')
			)
		},
	})
}

async function updateAccount() {
	// guard against a double-submit from spamming the Update button
	if (loading.value) return
	error.value = validateInputs(state, currentServiceName.value, true)
	if (error.value) return

	const nameChanged =
		props.accountData.email_account_name !== state.email_account_name

	if (!nameChanged && !isDirty.value) {
		toast.info(__('No changes made'))
		return
	}

	try {
		loading.value = true
		if (nameChanged) await callRenameDoc()
		if (isDirty.value) await callSetValue(buildUpdatePayload())
		emailAccounts.reload()
		emit('update:step', 'email-list')
		toast.success(__('Email account updated successfully'))
	} catch (err) {
		error.value = __('Failed to update email account, Invalid credentials')
	} finally {
		loading.value = false
	}
}

function buildUpdatePayload() {
	const commonPayload = {
		email_id: state.email_id,
		service: state.service,
		enable_incoming: state.enable_incoming,
		enable_outgoing: state.enable_outgoing,
		default_incoming: state.default_incoming,
		default_outgoing: state.default_outgoing,
	}

	if (currentServiceName.value === 'Frappe Mail') {
		return {
			...commonPayload,
			frappe_mail_site: state.frappe_mail_site,
			api_key: state.api_key,
			api_secret: state.api_secret,
		}
	}

	return {
		...commonPayload,
		password: state.password,
	}
}

const isDirty = computed(
	() =>
		state.service !== props.accountData.service ||
		state.email_id !== props.accountData.email_id ||
		state.api_key !== props.accountData.api_key ||
		state.api_secret !== props.accountData.api_secret ||
		state.password !== props.accountData.password ||
		state.enable_incoming !== props.accountData.enable_incoming ||
		state.enable_outgoing !== props.accountData.enable_outgoing ||
		state.default_incoming !== props.accountData.default_incoming ||
		state.default_outgoing !== props.accountData.default_outgoing ||
		state.frappe_mail_site !== props.accountData.frappe_mail_site
)

async function callRenameDoc() {
	return call('frappe.client.rename_doc', {
		doctype: 'Email Account',
		old_name: props.accountData.email_account_name,
		new_name: state.email_account_name,
	})
}

async function callSetValue(values: Record<string, unknown>) {
	const d = await call('frappe.client.set_value', {
		doctype: 'Email Account',
		name: state.email_account_name,
		fieldname: values,
	})
	return d.name
}

watch(
	() => props.accountData,
	(val) => {
		if (val?.email_id && state.email_id !== val.email_id) {
			state.email_id = val.email_id
		}
	},
	{ deep: true, immediate: true }
)
</script>
