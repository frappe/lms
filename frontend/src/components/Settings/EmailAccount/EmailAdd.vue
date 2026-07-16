<template>
	<SettingsLayout
		:title="__('Setup Email')"
		:description="
			__('Choose the email service provider you want to configure.')
		"
		:show-back="true"
		@back="emit('update:step', 'email-list')"
	>
		<template #header-actions>
			<Button
				:label="__('Create')"
				variant="solid"
				:loading="addEmailRes.loading"
				@click="createEmailAccount"
			/>
		</template>
		<div class="flex flex-col gap-4">
			<!-- email service provider selection -->
			<div class="flex flex-wrap items-center gap-4">
				<div
					v-for="s in services"
					:key="s.name"
					class="flex w-[70px] flex-col items-center gap-1"
					@click="handleSelect(s)"
				>
					<EmailProviderIcon
						:service-name="s.name"
						:logo="s.icon"
						:selected="selectedService?.name === s?.name"
					/>
				</div>
			</div>
			<div v-if="selectedService" class="flex flex-col gap-4">
				<!-- email service provider info -->
				<div
					class="flex items-center gap-2 rounded-md p-2 text-ink-gray-6 ring-1 ring-outline-gray-3"
				>
					<CircleAlert class="size-5 shrink-0" />
					<div class="text-wrap text-p-xs">
						{{ selectedService.info }}
						<a :href="selectedService.link" target="_blank" class="underline">{{
							__('here')
						}}</a
						>.
					</div>
				</div>
				<!-- service provider fields -->
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
		</div>
	</SettingsLayout>
</template>

<script setup lang="ts">
import SettingsLayout from '@/components/Layouts/SettingsLayout.vue'
import { useTelemetry } from 'frappe-ui/frappe'
import { EmailAccount, EmailService, EmailStep } from '@/types/email'
import {
	Button,
	ErrorMessage,
	FormControl,
	Switch,
	createListResource,
	createResource,
	toast,
} from 'frappe-ui'
import { computed, reactive, Ref, ref } from 'vue'
import { CircleAlert } from 'lucide-vue-next'
import {
	frappeMailFields,
	incomingOutgoingFields,
	popularProviderFields,
	services,
	validateInputs,
} from './emailConfig'
import EmailProviderIcon from './EmailProviderIcon.vue'

interface EmailAccountState {
	email_account_name: string
	email_id: string
	service: string
	enable_incoming: boolean
	enable_outgoing: boolean
	default_incoming: boolean
	default_outgoing: boolean
	password?: string
	api_key?: string
	api_secret?: string
	frappe_mail_site?: string
}

interface E {
	(event: 'update:step', value: EmailStep): void
}

const emit = defineEmits<E>()

const { capture } = useTelemetry()

const state = reactive<EmailAccountState>({
	service: '',
	email_account_name: '',
	email_id: '',
	password: '',
	api_key: '',
	api_secret: '',
	frappe_mail_site: '',
	enable_incoming: false,
	enable_outgoing: true,
	default_incoming: false,
	default_outgoing: false,
})

const selectedService: Ref<EmailService | null> = ref(null)
const fields = computed(() => {
	if (!selectedService.value) return []
	if (selectedService.value.name === 'Frappe Mail') {
		return frappeMailFields
	}
	return popularProviderFields
})

function handleSelect(service: EmailService) {
	selectedService.value = service
	state.service = service.name
}

// shared cached accounts list — reload it so the new account shows on return
const emailAccounts = createListResource({
	doctype: 'Email Account',
	cache: ['Email Accounts'],
})

const addEmailRes = createResource({
	url: 'lms.lms.email_account.create_email_account',
	makeParams: (val: EmailAccount) => ({ ...val }),
	onSuccess: () => {
		toast.success(window.__('Email account created'))
		emailAccounts.reload()
		emit('update:step', 'email-list')
		capture('email_account_created', { data: { service: state.service } })
	},
	onError: () => {
		error.value = window.__(
			'Failed to create email account, Invalid credentials'
		)
	},
})

const error = ref<string | undefined>()
function createEmailAccount() {
	// guard against a double-submit from spamming the Create button
	if (addEmailRes.loading) return
	error.value = validateInputs(state, state.service)
	if (error.value) return

	addEmailRes.submit({ data: buildCreatePayload() })
}

function buildCreatePayload() {
	const commonPayload = {
		email_account_name: state.email_account_name,
		email_id: state.email_id,
		service: state.service,
		enable_incoming: state.enable_incoming,
		enable_outgoing: state.enable_outgoing,
		default_incoming: state.default_incoming,
		default_outgoing: state.default_outgoing,
	}

	if (state.service === 'Frappe Mail') {
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
</script>
