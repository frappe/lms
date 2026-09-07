<template>
	<SettingsList
		v-if="view === 'list'"
		:title="__(label)"
		:description="__(description)"
		:columns="columns"
		:rows="list.rows"
		:loading="list.loading"
		:has-next-page="list.hasNextPage"
		v-model:search="list.search"
		searchable
		:search-label="__('Search gateways')"
		empty-name="Payment Gateways"
		empty-icon="lucide-dollar-sign"
		@new="openForm('new')"
		@load-more="list.loadMore()"
		@row-click="(row) => openForm(row.name)"
	/>
	<PaymentGatewayDetails
		v-else
		:gatewayID="currentGateway"
		v-model:paymentGateways="list.resource"
		@updateStep="(step) => (view = step)"
	/>
</template>
<script setup lang="ts">
import { toast } from 'frappe-ui'
import { ref } from 'vue'
import PaymentGatewayDetails from '@/components/Settings/PaymentGatewayDetails.vue'
import SettingsList from '@/components/Layouts/SettingsList.vue'
import { useSettingsListResource } from '@/composables/useSettingsListResource'
import { cleanError } from '@/utils'
import type { SettingsListColumn } from '@/types'

const view = ref<'list' | 'form'>('list')
const currentGateway = ref<string | null>(null)

defineProps<{
	label: string
	description: string
}>()

const list = useSettingsListResource({
	doctype: 'Payment Gateway',
	fields: ['name', 'gateway_settings', 'gateway_controller'],
	searchFields: ['name', 'gateway_settings'],
	orderBy: 'modified desc',
})

const removeAccount = (gateway: string) => {
	list.remove(gateway, {
		onSuccess: () => toast.success(__('Payment gateway deleted successfully')),
		onError: (err) => toast.error(cleanError(err.messages?.[0])),
	})
}

const columns: SettingsListColumn[] = [
	{
		key: 'gateway',
		label: __('Gateway'),
		type: 'stacked',
		primary: (row) => row.name,
		secondary: (row) => row.gateway_settings,
	},
	{
		key: 'actions',
		type: 'actions',
		ariaLabel: (row) => __('Actions for {0}').format(row.name),
		options: (row) => [
			{
				label: __('Delete'),
				icon: 'lucide-trash-2',
				onClick: () => removeAccount(row.name),
			},
		],
	},
]

const openForm = (gatewayID: string) => {
	currentGateway.value = gatewayID
	view.value = 'form'
}
</script>
