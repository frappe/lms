<template>
	<SettingsLayout
		:title="title"
		:description="
			__('Connect a Zoom account to schedule and host live classes.')
		"
		:show-back="true"
		@back="emit('updateStep', 'list')"
	>
		<template #header-actions>
			<Button variant="solid" @click="save">{{ __('Save') }}</Button>
		</template>
		<div class="mb-4">
			<Switch
				size="sm"
				v-model="account.enabled"
				:label="__('Enabled')"
				:description="__('Activate this Zoom account for scheduling meetings.')"
			/>
		</div>
		<div class="grid grid-cols-2 gap-5">
			<FormControl
				v-model="account.name"
				:label="__('Account Name')"
				type="text"
				:required="true"
			/>
			<FormControl
				v-model="account.client_id"
				:label="__('Client ID')"
				type="text"
				:required="true"
			/>
			<Link
				v-model="account.member"
				:label="__('Member')"
				doctype="Course Evaluator"
				:onCreate="
					(value: string, close: () => void) => openSettings('Members', close)
				"
				:required="true"
			/>
			<FormControl
				v-model="account.client_secret"
				:label="__('Client Secret')"
				type="password"
				:required="true"
			/>
			<FormControl
				v-model="account.account_id"
				:label="__('Account ID')"
				type="text"
				:required="true"
			/>
		</div>
	</SettingsLayout>
</template>
<script setup lang="ts">
import { Button, FormControl, call, toast } from 'frappe-ui'
import Switch from '@/components/Controls/Switch.vue'
import { computed, inject, reactive, watch } from 'vue'
import { User } from '@/components/Settings/types'
import { openSettings, cleanError } from '@/utils'
import Link from '@/components/Controls/Link.vue'
import SettingsLayout from '@/components/Layouts/SettingsLayout.vue'
import { useTelemetry } from 'frappe-ui/frappe'

interface ZoomAccount {
	name: string
	account_name: string
	enabled: boolean
	member: string
	account_id: string
	client_id: string
	client_secret: string
}

interface ZoomAccounts {
	data: ZoomAccount[]
	reload: () => void
	insert: {
		submit: (
			data: ZoomAccount,
			options: { onSuccess: () => void; onError: (err: any) => void }
		) => void
	}
	setValue: {
		submit: (
			data: ZoomAccount,
			options: { onSuccess: () => void; onError: (err: any) => void }
		) => void
	}
}

const emit = defineEmits<{ updateStep: ['list' | 'form'] }>()
const user = inject<User | null>('$user')
const zoomAccounts = defineModel<ZoomAccounts>('zoomAccounts')
const { capture } = useTelemetry()

const account = reactive({
	name: '',
	enabled: false,
	member: user?.data?.name || '',
	account_id: '',
	client_id: '',
	client_secret: '',
})

const props = defineProps<{
	accountID: string | null
}>()

const title = computed(() =>
	props.accountID === 'new' ? __('New Zoom Account') : __('Edit Zoom Account')
)

watch(
	() => props.accountID,
	(val) => {
		if (val === 'new') {
			account.name = ''
			account.enabled = false
			account.member = user?.data?.name || ''
			account.account_id = ''
			account.client_id = ''
			account.client_secret = ''
		} else if (val && val !== 'new') {
			const acc = zoomAccounts.value?.data.find((acc) => acc.name === val)
			if (acc) {
				account.name = acc.name
				account.enabled = acc.enabled || false
				account.member = acc.member
				account.account_id = acc.account_id
				account.client_id = acc.client_id
				account.client_secret = acc.client_secret
			}
		}
	},
	{ immediate: true }
)

const save = () => saveAccount()

const saveAccount = () => {
	if (props.accountID == 'new') {
		createAccount()
	} else {
		updateAccount()
	}
}

const createAccount = () => {
	zoomAccounts.value?.insert.submit(
		{
			account_name: account.name,
			...account,
		},
		{
			onSuccess() {
				capture('zoom_account_linked')
				zoomAccounts.value?.reload()
				emit('updateStep', 'list')
				toast.success(__('Zoom Account created successfully'))
			},
			onError(err) {
				emit('updateStep', 'list')
				toast.error(
					cleanError(err.messages[0]) || __('Error creating Zoom Account')
				)
			},
		}
	)
}

const updateAccount = async () => {
	if (props.accountID != account.name) {
		await renameDoc()
	}
	setValue()
}

const renameDoc = async () => {
	await call('frappe.client.rename_doc', {
		doctype: 'LMS Zoom Settings',
		old_name: props.accountID,
		new_name: account.name,
	})
}

const setValue = () => {
	zoomAccounts.value?.setValue.submit(
		{
			...account,
			name: account.name,
			account_name: props.accountID,
		},
		{
			onSuccess() {
				zoomAccounts.value?.reload()
				emit('updateStep', 'list')
				toast.success(__('Zoom Account updated successfully'))
			},
			onError(err: any) {
				emit('updateStep', 'list')
				toast.error(
					cleanError(err.messages[0]) || __('Error updating Zoom Account')
				)
			},
		}
	)
}
</script>
