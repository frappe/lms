<template>
	<Dialog
		v-model="show"
		:options="{
			title:
				accountID === 'new' ? __('New Zoom Account') : __('Edit Zoom Account'),
			size: 'xl',
			actions: [
				{
					label: __('Save'),
					variant: 'solid',
					onClick: ({ close }) => {
						saveAccount(close)
					},
				},
			],
		}"
	>
		<template #body-content>
			<div class="mb-4">
				<FormControl
					v-model="account.enabled"
					:label="__('Enabled')"
					type="checkbox"
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
					:onCreate="(value, close) => openSettings('Members', close)"
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
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import { call, Dialog, FormControl, toast } from 'frappe-ui'
import { inject, reactive, watch } from 'vue'
import { User } from '@/components/Settings/types'
import { openSettings, cleanError } from '@/utils'
import Link from '@/components/Controls/Link.vue'

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
}

const show = defineModel('show')
const user = inject<User | null>('$user')
const zoomAccounts = defineModel<ZoomAccounts>('zoomAccounts')

const account = reactive({
	name: '',
	enabled: false,
	member: user?.data?.name || '',
	account_id: '',
	client_id: '',
	client_secret: '',
})

const props = defineProps({
	accountID: {
		type: String,
		default: 'new',
	},
})

watch(
	() => props.accountID,
	(val) => {
		if (val != 'new') {
			zoomAccounts.value?.data.forEach((acc) => {
				if (acc.name === val) {
					account.name = acc.name
					account.enabled = acc.enabled || false
					account.member = acc.member
					account.account_id = acc.account_id
					account.client_id = acc.client_id
					account.client_secret = acc.client_secret
				}
			})
		}
	}
)

watch(show, (val) => {
	if (!val) {
		account.name = ''
		account.enabled = false
		account.member = user?.data?.name || ''
		account.account_id = ''
		account.client_id = ''
		account.client_secret = ''
	}
})

const saveAccount = (close) => {
	if (props.accountID == 'new') {
		createAccount(close)
	} else {
		updateAccount(close)
	}
}

const createAccount = (close) => {
	zoomAccounts.value?.insert.submit(
		{
			account_name: account.name,
			...account,
		},
		{
			onSuccess() {
				zoomAccounts.value?.reload()
				close()
				toast.success(__('Zoom Account created successfully'))
			},
			onError(err) {
				close()
				toast.error(
					cleanError(err.messages[0]) || __('Error creating Zoom Account')
				)
			},
		}
	)
}

const updateAccount = async (close) => {
	if (props.accountID != account.name) {
		await renameDoc()
	}
	setValue(close)
}

const renameDoc = async () => {
	await call('frappe.client.rename_doc', {
		doctype: 'LMS Zoom Settings',
		old_name: props.accountID,
		new_name: account.name,
	})
}

const setValue = (close) => {
	zoomAccounts.value?.setValue.submit(
		{
			...account,
			name: account.name,
		},
		{
			onSuccess() {
				zoomAccounts.value?.reload()
				close()
				toast.success(__('Zoom Account updated successfully'))
			},
			onError(err) {
				close()
				toast.error(
					cleanError(err.messages[0]) || __('Error updating Zoom Account')
				)
			},
		}
	)
}
</script>
