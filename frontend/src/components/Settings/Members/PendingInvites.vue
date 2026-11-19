<template>
	<SettingsList
		:title="__(label)"
		:columns="columns"
		:rows="rows"
		:loading="invites.loading"
		v-model:search="search"
		searchable
		:show-new="false"
		:empty-name="__('Invites')"
		empty-icon="lucide-mail"
		:empty-content="{ component: NoInvites }"
	/>
</template>

<script setup lang="ts">
import { toast } from 'frappe-ui'
import type { FrappeResourceError } from 'frappe-ui'
import { computed, defineComponent, h, onMounted, ref } from 'vue'
import { useInviteUser } from '@framework/ui/components/InviteUser/index'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import SettingsList from '@/components/Layouts/settings/desktop/SettingsList.vue'
import {
	inviteColumns,
	memberError,
} from '@/components/Settings/Members/members'
// @ts-expect-error utils/dialogs.js is still plain JS, so it has no declarations
import { createDialog } from '@/utils/dialogs'
import type { SettingsListRow } from '@/types'

// Settings > Invites: people invited from setup or anywhere else who have not
// accepted yet. Accepting makes them a user, listed under Users instead.

defineProps<{ label: string }>()

const invites = useInviteUser({ appName: 'lms' })
const search = ref('')

onMounted(() => invites.load())

const rows = computed(() => {
	const term = search.value.trim().toLowerCase()
	return invites.pendingInvites.filter((invite) =>
		invite.email.toLowerCase().includes(term)
	)
})

const resend = async (row: SettingsListRow) => {
	try {
		await invites.resend(row.name)
		toast.success(__('Invite sent again to {0}').format(row.email))
	} catch (error) {
		toast.error(
			memberError(
				error as FrappeResourceError,
				__('Could not resend the invite')
			)
		)
	}
}

const confirmCancel = (row: SettingsListRow) => {
	createDialog({
		title: __('Cancel the invite to {0}?').format(row.email),
		message: __(
			'Their link stops working and they get an email saying so. You can invite them again later.'
		),
		size: 'sm',
		actions: [
			{
				label: __('Cancel invite'),
				theme: 'red',
				variant: 'solid',
				onClick: ({ close }: { close: () => void }) => cancel(row, close),
			},
		],
	})
}

const cancel = async (row: SettingsListRow, close: () => void) => {
	try {
		await invites.cancel(row.name)
		close()
		toast.success(__('Invite to {0} cancelled').format(row.email))
	} catch (error) {
		toast.error(
			memberError(
				error as FrappeResourceError,
				__('Could not cancel the invite')
			)
		)
	}
}

const columns = inviteColumns({ resend, cancel: confirmCancel })

const NoInvites = defineComponent({
	setup: () => () =>
		h(EmptyStateLayout, {
			name: __('Invites'),
			title: __('No pending invites'),
			description: __('People you invite show up here until they accept.'),
			icon: 'lucide-mail',
		}),
})
</script>
