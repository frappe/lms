<template>
	<SettingsList
		:title="__('Email Accounts')"
		:description="
			__(
				'Manage your email accounts and configure incoming and outgoing settings.'
			)
		"
		:columns="columns"
		:rows="list.rows"
		:loading="list.loading"
		:has-next-page="list.hasNextPage"
		v-model:search="list.search"
		searchable
		:search-label="__('Search accounts')"
		empty-name="Email Accounts"
		empty-icon="lucide-mail"
		@new="emit('update:step', 'email-add')"
		@load-more="list.loadMore()"
		@row-click="(row) => emit('update:step', 'email-edit', { ...row })"
	>
		<template #leading="{ row }">
			<EmailProviderIcon :logo="emailIcon[row.service]" />
		</template>
	</SettingsList>

	<Dialog
		v-model:open="showDeleteDialog"
		:title="accountToDelete ? __('Delete {0}?').format(accountToDelete) : ''"
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
				onClick: confirmDelete,
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
import { Dialog, toast } from 'frappe-ui'
import { ref } from 'vue'
import { cleanError } from '@/utils'
import EmailProviderIcon from './EmailProviderIcon.vue'
import { defaultsBadgeLabel, emailIcon } from './emailConfig'
import SettingsList from '@/components/Layouts/SettingsList.vue'
import { useSettingsListResource } from '@/composables/useSettingsListResource'
import type { EmailAccount, SettingsListColumn } from '@/types'

const emit = defineEmits(['update:step'])

const list = useSettingsListResource({
	doctype: 'Email Account',
	cache: ['Email Accounts'],
	fields: ['*'],
	searchFields: ['email_account_name', 'email_id'],
	filters: {
		email_id: ['Not Like', '%example%'],
	},
	// The DB hands these back as 0/1 and the edit form compares them against
	// booleans to decide whether anything changed.
	transform: (accounts: EmailAccount[]) =>
		accounts.map((account) => ({
			...account,
			enable_incoming: Boolean(account.enable_incoming),
			enable_outgoing: Boolean(account.enable_outgoing),
			default_incoming: Boolean(account.default_incoming),
			default_outgoing: Boolean(account.default_outgoing),
		})),
})

const showDeleteDialog = ref(false)
const accountToDelete = ref<string | null>(null)
const deleting = ref(false)

const openDeleteDialog = (name: string) => {
	accountToDelete.value = name
	showDeleteDialog.value = true
}

const columns: SettingsListColumn[] = [
	{
		key: 'account',
		label: __('Account'),
		type: 'stacked',
		primary: (row) => row.email_account_name,
		secondary: (row) => row.email_id,
		leading: true,
	},
	{
		key: 'defaults',
		label: __('Role'),
		type: 'badge',
		// Wide enough for the longest label, "Default Sending & Inbox".
		width: '11rem',
		badges: (row) => [{ label: defaultsBadgeLabel(row), theme: 'gray' }],
	},
	{
		key: 'actions',
		type: 'actions',
		ariaLabel: (row) => __('Actions for {0}').format(row.email_account_name),
		options: (row) => [
			{
				label: __('Delete'),
				icon: 'lucide-trash-2',
				onClick: () => openDeleteDialog(row.email_account_name),
			},
		],
	},
]

const confirmDelete = () => {
	const name = accountToDelete.value
	if (!name || deleting.value) return
	deleting.value = true
	list.remove(name, {
		onSuccess: () => {
			deleting.value = false
			showDeleteDialog.value = false
			accountToDelete.value = null
			toast.success(__('Email Account deleted successfully'))
		},
		onError: (err) => {
			deleting.value = false
			toast.error(
				cleanError(err.messages?.[0]) || __('Error deleting email account')
			)
		},
	})
}
</script>
