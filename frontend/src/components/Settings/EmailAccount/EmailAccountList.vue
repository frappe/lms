<template>
	<SettingsLayout
		:title="__('Email Accounts')"
		:description="
			__(
				'Manage your email accounts and configure incoming and outgoing settings.'
			)
		"
	>
		<template #header-actions>
			<Button
				:label="__('New')"
				variant="solid"
				@click="emit('update:step', 'email-add')"
			>
				<template #prefix>
					<LucidePlus class="size-4" />
				</template>
			</Button>
		</template>

		<div v-if="!emailAccounts.loading && emailAccounts.data?.length">
			<ListView
				:columns="columns"
				:rows="emailAccounts.data"
				row-key="name"
				:options="{
					showTooltip: false,
					selectable: false,
					onRowClick: (row) => emit('update:step', 'email-edit', { ...row }),
				}"
			>
				<ListHeader
					class="mb-2 grid items-center gap-x-4 rounded bg-surface-gray-2 p-2"
				>
					<ListHeaderItem :item="item" v-for="item in columns" :key="item.key">
						<template #prefix="{ item }">
							<FeatherIcon
								v-if="item.icon"
								:name="item.icon"
								class="h-4 w-4 stroke-1.5"
							/>
						</template>
					</ListHeaderItem>
				</ListHeader>
				<ListRows>
					<ListRow :row="row" v-for="row in emailAccounts.data" :key="row.name">
						<template #default="{ column }">
							<ListRowItem :item="row[column.key]" :align="column.align">
								<div
									v-if="column.key === 'email_account_name'"
									class="flex min-w-0 items-center gap-2"
								>
									<img
										v-if="emailIcon[row.service]"
										:src="emailIcon[row.service]"
										class="size-4 shrink-0"
									/>
									<span class="truncate text-sm leading-5">
										{{ row.email_account_name }}
									</span>
								</div>
								<Badge
									v-else-if="column.key === 'status'"
									variant="subtle"
									theme="gray"
									:label="statusLabel(row)"
								/>
								<div v-else-if="column.key === 'action'" @click.stop>
									<Dropdown
										:options="getMoreOptions(row)"
										:button="{
											icon: 'more-horizontal',
											onblur: (e: Event) => {
												e.stopPropagation()
											},
										}"
										placement="right"
									/>
								</div>
								<div v-else class="truncate text-sm leading-5">
									{{ row[column.key] }}
								</div>
							</ListRowItem>
						</template>
					</ListRow>
				</ListRows>
			</ListView>
		</div>

		<EmptyStateLayout
			v-else
			name="Email Accounts"
			:description="__('Add one to get started.')"
			icon="lucide-mail"
		/>
	</SettingsLayout>

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
import {
	Badge,
	Button,
	Dialog,
	Dropdown,
	FeatherIcon,
	ListView,
	ListHeader,
	ListHeaderItem,
	ListRows,
	ListRow,
	ListRowItem,
	createListResource,
	toast,
} from 'frappe-ui'
import { computed, ref } from 'vue'
import { cleanError } from '@/utils'
import { emailIcon } from './emailConfig'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import SettingsLayout from '@/components/Layouts/SettingsLayout.vue'
import type { EmailAccount } from '@/types/email'

const emit = defineEmits(['update:step'])

const emailAccounts = createListResource({
	doctype: 'Email Account',
	cache: ['Email Accounts'],
	fields: ['*'],
	filters: {
		email_id: ['Not Like', '%example%'],
	},
	pageLength: 10,
	auto: true,
	onSuccess: (accounts: EmailAccount[]) => {
		// normalize 0/1 from the DB into booleans for the status badge
		accounts.forEach((account) => {
			account.enable_incoming = Boolean(account.enable_incoming)
			account.enable_outgoing = Boolean(account.enable_outgoing)
			account.default_incoming = Boolean(account.default_incoming)
			account.default_outgoing = Boolean(account.default_outgoing)
		})
	},
})

const columns = computed(() => [
	{
		label: __('Account'),
		key: 'email_account_name',
		icon: 'mail',
		align: 'left',
		width: 2,
	},
	{
		label: __('Email ID'),
		key: 'email_id',
		icon: 'at-sign',
		align: 'left',
		width: 2,
	},
	{
		label: __('Status'),
		key: 'status',
		icon: 'check-square',
		align: 'left',
		width: 1.5,
	},
	{
		key: 'action',
		align: 'right',
		width: '52px',
	},
])

const statusLabel = (account: EmailAccount) => {
	if (account.default_incoming && account.default_outgoing) {
		return __('Default Sending & Inbox')
	} else if (account.default_incoming) {
		return __('Default Inbox')
	} else if (account.default_outgoing) {
		return __('Default Sending')
	}
	return __('Inbox')
}

const showDeleteDialog = ref(false)
const accountToDelete = ref<string | null>(null)

const getMoreOptions = (account: EmailAccount) => [
	{
		label: __('Edit'),
		icon: 'edit',
		onClick: () => emit('update:step', 'email-edit', { ...account }),
	},
	{
		label: __('Delete'),
		icon: 'trash-2',
		onClick: () => openDeleteDialog(account.email_account_name),
	},
]

const openDeleteDialog = (name: string) => {
	accountToDelete.value = name
	showDeleteDialog.value = true
}

const confirmDelete = () => {
	const name = accountToDelete.value
	if (!name) return
	emailAccounts.delete.submit(name, {
		onSuccess: () => {
			toast.success(__('Email Account deleted successfully'))
		},
		onError: (err: { messages?: string[] }) => {
			toast.error(
				cleanError(err.messages?.[0]) || __('Error deleting email account')
			)
		},
	})
	showDeleteDialog.value = false
	accountToDelete.value = null
}
</script>
