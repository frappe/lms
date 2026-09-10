<template>
	<SettingsList
		v-if="!record"
		:title="__(label)"
		:columns="columns"
		:rows="list.rows"
		:loading="list.loading"
		:has-next-page="list.hasNextPage"
		v-model:search="list.search"
		searchable
		:search-label="searchLabel()"
		:empty-name="emptyState.name"
		:empty-icon="emptyState.icon"
		@new="openForm(NEW_GATEWAY)"
		@load-more="list.loadMore()"
		@row-click="(row) => openForm(row.name)"
	/>

	<PaymentGatewayForm v-else :name="record" @back="closeForm()" />
</template>

<script setup lang="ts">
import PaymentGatewayForm from '@/components/Settings/PaymentGateways/PaymentGatewayForm.vue'
import SettingsList from '@/components/Layouts/settings/desktop/SettingsList.vue'
import { useSettingsListResource } from '@/composables/useSettingsListResource'
import {
	NEW_GATEWAY,
	columns,
	emptyState,
	gatewayList,
	searchLabel,
} from '@/components/Settings/PaymentGateways/paymentGateways'

// Settings > Payment Gateways: the list of configured gateways, with the form
// behind New and behind a row in PaymentGatewayForm.vue. The form is imported
// statically so a row click reveals it on the same tick.

defineProps<{ label: string }>()

// The open record, as a model rather than state of its own, the same contract
// SettingsListPanel has. Whether the form is showing is read off this and
// never stored beside it: a second copy could disagree with the URL.
const record = defineModel<string | null>('record', { default: null })

const list = useSettingsListResource(gatewayList)

const openForm = (gateway: string) => {
	record.value = gateway
}

const closeForm = () => {
	record.value = null
}
</script>
