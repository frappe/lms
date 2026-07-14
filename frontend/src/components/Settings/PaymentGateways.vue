<template>
	<SettingsLayout
		v-if="view === 'list'"
		:title="__(label)"
		:description="__(description)"
	>
		<template #header-actions>
			<Button variant="solid" @click="openForm('new')">
				<template #prefix>
					<span class="lucide-plus h-4 w-4" />
				</template>
				{{ __('New') }}
			</Button>
		</template>
		<List
			v-if="paymentGateways.data?.length"
			:columns="columns"
			class="list-row-px-3"
		>
			<ListHeader>
				<ListHeaderCell>{{ __('Gateway') }}</ListHeaderCell>
				<ListHeaderCell />
			</ListHeader>
			<ListRows
				:items="paymentGateways.data"
				row-key="name"
				v-slot="{ item: row }"
			>
				<ListRow class="py-3" @click="openForm(row.name)">
					<ListCell class="gap-2">
						<span class="lucide-credit-card size-4 shrink-0 text-ink-gray-5" />
						<div class="flex min-w-0 flex-col">
							<span class="truncate text-p-base-medium text-ink-gray-8">
								{{ row.name }}
							</span>
							<span class="truncate text-p-sm text-ink-gray-5">
								{{ row.gateway_settings }}
							</span>
						</div>
					</ListCell>
					<ListCell class="justify-end" @click.stop>
						<Dropdown
							:options="[
								{
									label: __('Delete'),
									icon: 'lucide-trash-2',
									onClick: () => removeAccount(row.name),
								},
							]"
							:button="{ icon: 'lucide-more-horizontal', variant: 'ghost' }"
							placement="right"
						/>
					</ListCell>
				</ListRow>
			</ListRows>
		</List>
		<EmptyStateLayout
			v-else
			name="Payment Gateways"
			:description="__('Add one to get started.')"
			icon="lucide-dollar-sign"
		/>
	</SettingsLayout>
	<PaymentGatewayDetails
		v-else
		:gatewayID="currentGateway"
		v-model:paymentGateways="paymentGateways"
		@updateStep="(step) => (view = step)"
	/>
</template>
<script setup>
import { Button, Dropdown, createListResource, toast } from 'frappe-ui'
import {
	List,
	ListCell,
	ListHeader,
	ListHeaderCell,
	ListRow,
	ListRows,
} from 'frappe-ui/list'
import { ref } from 'vue'
import PaymentGatewayDetails from '@/components/Settings/PaymentGatewayDetails.vue'
import { cleanError } from '@/utils'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import SettingsLayout from '@/components/Layouts/SettingsLayout.vue'

const view = ref('list')
const currentGateway = ref(null)

const props = defineProps({
	label: {
		type: String,
		required: true,
	},
	description: {
		type: String,
		required: true,
	},
})

const paymentGateways = createListResource({
	doctype: 'Payment Gateway',
	fields: ['name', 'gateway_settings', 'gateway_controller'],
	auto: true,
	orderBy: 'modified desc',
})

// Grid track sizes shared by the header and every row (--list-columns).
const columns = ['minmax(0, 1fr)', '2.25rem']

const openForm = (gatewayID) => {
	currentGateway.value = gatewayID
	view.value = 'form'
}

const removeAccount = (gateway) => {
	paymentGateways.delete.submit(gateway, {
		onSuccess() {
			toast.success(__('Payment gateway deleted successfully'))
			paymentGateways.reload()
		},
		onError(err) {
			toast.error(cleanError(err.messages?.[0] || err))
			console.error(err)
		},
	})
}
</script>
