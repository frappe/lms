<template>
	<SettingsLayout
		:title="title"
		:description="
			__('Connect a Google Meet account to schedule and host live classes.')
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
				:description="
					__('Activate this Google Meet account for scheduling meetings.')
				"
			/>
		</div>
		<div class="grid grid-cols-2 gap-5">
			<FormControl
				v-model="account.name"
				:label="__('Account Name')"
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
			<Link
				v-model="account.google_calendar"
				:label="__('Google Calendar')"
				doctype="Google Calendar"
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

interface GoogleMeetAccount {
	name: string
	account_name: string
	enabled: boolean
	member: string
	google_calendar: string
}

interface GoogleMeetAccounts {
	data: GoogleMeetAccount[]
	reload: () => void
	insert: {
		submit: (
			data: GoogleMeetAccount,
			options: { onSuccess: () => void; onError: (err: any) => void }
		) => void
	}
	setValue: {
		submit: (
			data: GoogleMeetAccount,
			options: { onSuccess: () => void; onError: (err: any) => void }
		) => void
	}
}

const emit = defineEmits<{ updateStep: ['list' | 'form'] }>()
const user = inject<User | null>('$user')
const googleMeetAccounts = defineModel<GoogleMeetAccounts>('googleMeetAccounts')
const { capture } = useTelemetry()

const account = reactive({
	name: '',
	enabled: false,
	member: user?.data?.name || '',
	google_calendar: '',
})

const props = defineProps({
	accountID: {
		type: String,
		default: 'new',
	},
})

const title = computed(() =>
	props.accountID === 'new'
		? __('New Google Meet Account')
		: __('Edit Google Meet Account')
)

watch(
	() => props.accountID,
	(val) => {
		if (val === 'new') {
			account.name = ''
			account.enabled = false
			account.member = user?.data?.name || ''
			account.google_calendar = ''
		} else if (val && val !== 'new') {
			const acc = googleMeetAccounts.value?.data.find((acc) => acc.name === val)
			if (acc) {
				account.name = acc.name
				account.enabled = acc.enabled || false
				account.member = acc.member
				account.google_calendar = acc.google_calendar
			}
		}
	}
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
	googleMeetAccounts.value?.insert.submit(
		{
			account_name: account.name,
			...account,
		},
		{
			onSuccess() {
				capture('google_meet_account_linked')
				googleMeetAccounts.value?.reload()
				emit('updateStep', 'list')
				toast.success(__('Google Meet Account created successfully'))
			},
			onError(err) {
				console.error(err)
				emit('updateStep', 'list')
				toast.error(
					cleanError(err.messages[0]) ||
						__('Error creating Google Meet Account')
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
		doctype: 'LMS Google Meet Settings',
		old_name: props.accountID,
		new_name: account.name,
	})
}

const setValue = () => {
	googleMeetAccounts.value?.setValue.submit(
		{
			...account,
			name: account.name,
			account_name: props.accountID,
		},
		{
			onSuccess() {
				googleMeetAccounts.value?.reload()
				emit('updateStep', 'list')
				toast.success(__('Google Meet Account updated successfully'))
			},
			onError(err: any) {
				console.error(err)
				emit('updateStep', 'list')
				toast.error(
					cleanError(err.messages[0]) ||
						__('Error updating Google Meet Account')
				)
			},
		}
	)
}
</script>
