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
			<div v-for="(account, i) in emailAccounts.data" :key="account.name">
				<EmailAccountCard
					:email-account="account"
					@click="emit('update:step', 'email-edit', { ...account })"
				/>
				<div
					v-if="emailAccounts.data.length !== i + 1"
					class="mx-2 h-px border-t border-outline-elevation-2"
				/>
			</div>
		</div>

		<EmptyStateLayout
			v-else
			name="Email Accounts"
			:description="__('Add one to get started.')"
			icon="lucide-mail"
		/>
	</SettingsLayout>
</template>

<script setup lang="ts">
import { Button, createListResource } from 'frappe-ui'
import EmailAccountCard from './EmailAccountCard.vue'
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
</script>
