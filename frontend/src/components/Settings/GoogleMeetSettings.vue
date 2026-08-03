<template>
	<SettingsList
		v-if="view === 'list'"
		:title="label || ''"
		:description="__(description || '')"
		:columns="columns"
		:rows="list.rows"
		:loading="list.loading"
		:has-next-page="list.hasNextPage"
		v-model:search="list.search"
		searchable
		:search-label="__('Search accounts')"
		empty-name="Google Meet Settings"
		empty-icon="lucide-presentation"
		@new="openForm('new')"
		@load-more="list.loadMore()"
		@row-click="(row) => openForm(row.name)"
	/>
	<GoogleMeetAccountForm
		v-else
		:accountID="currentAccount"
		v-model:googleMeetAccounts="list.resource"
		@updateStep="(step) => (view = step)"
	/>
</template>
<script setup lang="ts">
import { toast } from 'frappe-ui'
import { inject, onMounted, ref } from 'vue'
import { cleanError } from '@/utils'
import { User } from '@/types'
import GoogleMeetAccountForm from '@/components/Settings/GoogleMeetAccountForm.vue'
import SettingsList from '@/components/Layouts/SettingsList.vue'
import { useSettingsListResource } from '@/composables/useSettingsListResource'
import type { SettingsListColumn } from '@/types'

const user = inject<User | null>('$user')
const view = ref<'list' | 'form'>('list')
const currentAccount = ref<string | null>(null)

defineProps({
	label: String,
	description: String,
})

const list = useSettingsListResource({
	doctype: 'LMS Google Meet Settings',
	fields: [
		'name',
		'enabled',
		'member',
		'member_name',
		'member_image',
		'google_calendar',
	],
	searchFields: ['member_name', 'google_calendar'],
	cache: ['googleMeetAccounts'],
	auto: false,
})

const fetchGoogleMeetAccounts = () => {
	if (!user?.data?.is_moderator && !user?.data?.is_evaluator) return

	if (!user?.data?.is_moderator) {
		list.resource.update({ filters: { member: user.data.name } })
	}
	list.reload()
}

onMounted(() => {
	fetchGoogleMeetAccounts()
})

const removeAccount = (accountID: string) => {
	list.remove(accountID, {
		onSuccess: () =>
			toast.success(__('Google Meet account deleted successfully')),
		onError: (err) => toast.error(cleanError(err.messages?.[0])),
	})
}

const columns: SettingsListColumn[] = [
	{
		key: 'account',
		label: __('Account'),
		type: 'stacked',
		primary: (row) => row.member_name,
		secondary: (row) => row.google_calendar,
		avatar: (row) => ({ image: row.member_image, label: row.member_name }),
	},
	{
		key: 'status',
		label: __('Status'),
		type: 'badge',
		width: '6.5rem',
		badges: (row) => [
			row.enabled
				? { label: __('Enabled'), theme: 'green' }
				: { label: __('Disabled'), theme: 'gray' },
		],
	},
	{
		key: 'actions',
		type: 'actions',
		ariaLabel: (row) => __('Actions for {0}').format(row.member_name),
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
