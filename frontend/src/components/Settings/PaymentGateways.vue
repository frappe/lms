<template>
	<div class="flex min-h-0 flex-col text-base">
		<div class="flex items-center justify-between mb-5">
			<div>
				<div class="text-xl font-semibold mb-1 text-ink-gray-9">
					{{ __(label) }}
				</div>
				<div class="text-ink-gray-6 leading-5">
					{{ __(description) }}
				</div>
			</div>
			<Button @click="openForm('new')">
				<template #prefix>
					<Plus class="h-3 w-3 stroke-1.5" />
				</template>
				{{ __('New') }}
			</Button>
		</div>

		<div v-if="paymentGateways.data?.length" class="overflow-y-scroll">
			<ListView
				:columns="columns"
				:rows="paymentGateways.data"
				row-key="name"
				:options="{
					showTooltip: false,
					onRowClick: (row) => {
						openForm(row.name)
					},
				}"
			>
				<ListHeader
					class="mb-2 grid items-center space-x-4 rounded bg-surface-gray-2 p-2"
				>
					<ListHeaderItem :item="item" v-for="item in columns">
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
					<ListRow :row="row" v-for="row in paymentGateways.data">
						<template #default="{ column, item }">
							<ListRowItem :item="row[column.key]" :align="column.align">
								<div v-if="column.key == 'enabled'">
									<Badge v-if="row[column.key]" theme="green">
										{{ __('Enabled') }}
									</Badge>
									<Badge v-else theme="gray">
										{{ __('Disabled') }}
									</Badge>
								</div>
								<div v-else class="leading-5 text-sm">
									{{ row[column.key] }}
								</div>
							</ListRowItem>
						</template>
					</ListRow>
				</ListRows>

				<ListSelectBanner>
					<template #actions="{ unselectAll, selections }">
						<div class="flex gap-2">
							<Button
								variant="ghost"
								@click="removeAccount(selections, unselectAll)"
							>
								<Trash2 class="h-4 w-4 stroke-1.5" />
							</Button>
						</div>
					</template>
				</ListSelectBanner>
			</ListView>
		</div>
	</div>
	<PaymentGatewayDetails
		v-model="showForm"
		:gatewayID="currentGateway"
		v-model:paymentGateways="paymentGateways"
	/>
</template>
<script setup>
import {
	Badge,
	Button,
	createListResource,
	FeatherIcon,
	ListView,
	ListHeader,
	ListHeaderItem,
	ListRows,
	ListRow,
	ListRowItem,
	ListSelectBanner,
} from 'frappe-ui'
import { computed, ref } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import PaymentGatewayDetails from '@/components/Settings/PaymentGatewayDetails.vue'

const showForm = ref(false)
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

const openForm = (gatewayID) => {
	currentGateway.value = gatewayID
	showForm.value = true
}

const columns = computed(() => {
	return [
		{
			label: __('Gateway'),
			key: 'name',
			icon: 'credit-card',
		},
	]
})
</script>
