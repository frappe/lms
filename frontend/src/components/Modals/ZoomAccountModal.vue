<template>
	<Dialog
		v-model="show"
		:options="{
			title:
				accountID === 'new' ? __('New Zoom Account') : __('Edit Zoom Account'),
			size: 'lg',
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
			<div class="grid grid-cols-2 gap-5">
				<Link
					v-model="account.member"
					:label="__('Member')"
					doctype="User"
					:onCreate="(value, close) => openSettings('Members', close)"
					:required="true"
				/>
				<FormControl
					v-model="account.account_id"
					:label="__('Account ID')"
					type="text"
					:required="true"
				/>
				<FormControl
					v-model="account.client_id"
					:label="__('Client ID')"
					type="text"
					:required="true"
				/>
				<FormControl
					v-model="account.client_secret"
					:label="__('Client Secret')"
					type="password"
					:required="true"
				/>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import { Dialog, FormControl } from 'frappe-ui'
import { inject, reactive, watch } from 'vue'
import { User } from '@/components/Settings/types'
import { openSettings } from '@/utils'
import Link from '@/components/Controls/Link.vue'

interface ZoomAccount {
	name: string
	member: string
	account_id: string
	client_id: string
	client_secret: string
}

interface ZoomAccounts {
	data: ZoomAccount[]
}

const show = defineModel('show')
const user = inject<User | null>('$user')
const zoomAccounts = defineModel<ZoomAccounts>('zoomAccounts')

const account = reactive({
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
		console.log(val)
		if (val != 'new') {
			zoomAccounts.value?.data.forEach((acc) => {
				if (acc.name === val) {
					account.member = acc.member
					account.account_id = acc.account_id
					account.client_id = acc.client_id
					account.client_secret = acc.client_secret
				}
			})
		}
	}
)
</script>
