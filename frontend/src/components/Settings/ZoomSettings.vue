<template>
	<SettingsList
		v-if="view === 'list'"
		:title="label"
		:description="__(description || '')"
		:columns="columns"
		:rows="list.rows"
		:loading="list.loading"
		:has-next-page="list.hasNextPage"
		v-model:search="list.search"
		searchable
		:search-label="__('Search accounts')"
		empty-name="Zoom Settings"
		empty-icon="lucide-video"
		@new="openForm('new')"
		@load-more="list.loadMore()"
		@row-click="(row) => openForm(row.name)"
	/>
	<ZoomAccountForm
		v-else
		:accountID="currentAccount"
		v-model:zoomAccounts="list.resource"
		@updateStep="(step) => (view = step)"
	/>
</template>
<script setup lang="ts">
import { call, toast } from 'frappe-ui'
import { ref } from 'vue'
import { cleanError } from '@/utils'
import ZoomAccountForm from '@/components/Settings/ZoomAccountForm.vue'
import SettingsList from '@/components/Layouts/SettingsList.vue'
import { useSettingsListResource } from '@/composables/useSettingsListResource'
import type { SettingsListColumn, SettingsListRow } from '@/types'

const view = ref<'list' | 'form'>('list')
const currentAccount = ref<string | null>(null)

defineProps<{
	label: string
	description?: string
}>()

const list = useSettingsListResource({
	doctype: 'LMS Zoom Settings',
	fields: [
		'name',
		'enabled',
		'account_name',
		'member',
		'member_name',
		'member_image',
		'account_id',
		'client_id',
		'client_secret',
	],
	searchFields: ['account_name', 'account_id', 'member_name'],
	cache: ['zoomAccounts'],
})

const toggleEnabled = async (row: SettingsListRow, value: boolean) => {
	const previous = row.enabled
	row.enabled = value ? 1 : 0
	try {
		await call('frappe.client.set_value', {
			doctype: 'LMS Zoom Settings',
			name: row.name,
			fieldname: 'enabled',
			value: row.enabled,
		})
	} catch (err: any) {
		row.enabled = previous
		toast.error(cleanError(err.messages?.[0] || err))
	}
}

const removeAccount = (accountID: string) => {
	list.remove(accountID, {
		onSuccess: () => toast.success(__('Zoom account deleted successfully')),
		onError: (err) => toast.error(cleanError(err.messages?.[0])),
	})
}

const columns: SettingsListColumn[] = [
	{
		key: 'account',
		label: __('Account'),
		type: 'stacked',
		primary: (row) => row.account_name || row.name,
		secondary: (row) => row.account_id,
	},
	{
		key: 'member',
		label: __('Member'),
		type: 'text',
		value: (row) => row.member_name,
		avatar: (row) => ({ image: row.member_image, label: row.member_name }),
	},
	{
		key: 'enabled',
		label: __('Enabled'),
		type: 'switch',
		width: '6.5rem',
		checked: (row) => Boolean(row.enabled),
		ariaLabel: (row) => __('Enable {0}').format(row.account_name || row.name),
		onChange: toggleEnabled,
	},
	{
		key: 'actions',
		type: 'actions',
		ariaLabel: (row) =>
			__('Actions for {0}').format(row.account_name || row.name),
		options: (row) => [
			{
				label: __('Delete'),
				icon: 'lucide-trash-2',
				onClick: () => removeAccount(row.name),
			},
		],
	},
]

const openForm = (accountID: string) => {
	currentAccount.value = accountID
	view.value = 'form'
}
</script>
