<template>
	<div
		class="flex cursor-pointer items-center justify-between rounded px-2 py-3 hover:bg-surface-menu-bar"
	>
		<div class="flex min-w-0 items-center gap-2">
			<EmailProviderIcon :logo="emailIcon[emailAccount.service]" />
			<div class="min-w-0">
				<div class="truncate text-p-base text-ink-gray-8">
					{{ emailAccount.email_account_name }}
				</div>
				<div class="truncate text-p-sm text-ink-gray-5">
					{{ emailAccount.email_id }}
				</div>
			</div>
		</div>
		<Badge variant="subtle" theme="gray" :label="badgeTitle" />
	</div>
</template>

<script setup lang="ts">
import { Badge } from 'frappe-ui'
import { computed } from 'vue'
import EmailProviderIcon from './EmailProviderIcon.vue'
import { emailIcon } from './emailConfig'
import type { EmailAccount } from '@/types/email'

const props = defineProps<{ emailAccount: EmailAccount }>()

const badgeTitle = computed(() => {
	const account = props.emailAccount
	if (account.default_incoming && account.default_outgoing) {
		return __('Default Sending & Inbox')
	} else if (account.default_incoming) {
		return __('Default Inbox')
	} else if (account.default_outgoing) {
		return __('Default Sending')
	}
	return __('Inbox')
})
</script>
