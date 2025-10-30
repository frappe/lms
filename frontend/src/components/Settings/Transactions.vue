<template>
	<div class="flex min-h-0 flex-col text-base">
		<div class="mb-5">
			<div class="text-xl font-semibold mb-1 text-ink-gray-9">
				{{ __(label) }}
			</div>
			<div class="text-ink-gray-6 leading-5">
				{{ __(description) }}
			</div>
		</div>

		<div class="flex items-center space-x-5 mb-4">
			<FormControl
				v-model="billingName"
				:placeholder="__('Filter by Billing Name')"
			/>
			<Link
				v-model="member"
				doctype="User"
				:placeholder="__('Filter by Member')"
			/>
			<FormControl
				v-model="paymentReceived"
				type="checkbox"
				:label="__('Payment Received')"
			/>
			<FormControl
				v-model="paymentForCertificate"
				type="checkbox"
				:label="__('Payment for Certificate')"
			/>
		</div>

		<div v-if="transactions.data?.length" class="overflow-y-scroll">
			<ListView
				:columns="columns"
				:rows="transactions.data"
				row-key="name"
				:options="{
                    showTooltip: false,
                    selectable: false,
                    onRowClick: (row: { [key: string]: any }) => {
                        openForm(row)
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
					<ListRow :row="row" v-for="row in transactions.data">
						<template #default="{ column, item }">
							<ListRowItem :item="row[column.key]" :align="column.align">
								<FormControl
									v-if="
										['payment_received', 'payment_for_certificate'].includes(
											column.key
										)
									"
									type="checkbox"
									v-model="row[column.key]"
									:disabled="true"
								/>
								<div v-else-if="column.key == 'amount'">
									{{ getCurrencySymbol(row['currency']) }} {{ row[column.key] }}
								</div>
								<div v-else class="leading-5 text-sm">
									{{ row[column.key] }}
								</div>
							</ListRowItem>
						</template>
					</ListRow>
				</ListRows>
			</ListView>
			<div
				v-if="transactions.data.length && transactions.hasNextPage"
				class="flex justify-center mt-4"
			>
				<Button @click="transactions.next()">
					<template #prefix>
						<RefreshCw class="h-3 w-3 stroke-1.5" />
					</template>
					{{ __('Load More') }}
				</Button>
			</div>
		</div>
	</div>
	<TransactionDetails
		v-model="showForm"
		:transaction="currentTransaction"
		v-model:transactions="transactions"
		v-model:show="show"
	/>
</template>
<script setup lang="ts">
import {
	Button,
	createListResource,
	ListView,
	ListHeader,
	ListHeaderItem,
	FeatherIcon,
	ListRows,
	ListRow,
	ListRowItem,
	FormControl,
} from 'frappe-ui'
import { computed, ref, watch } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import TransactionDetails from './TransactionDetails.vue'
import Link from '@/components/Controls/Link.vue'

const showForm = ref(false)
const currentTransaction = ref<{ [key: string]: any } | null>(null)
const show = defineModel('show')
const billingName = ref(null)
const paymentReceived = ref(false)
const paymentForCertificate = ref(false)
const member = ref(null)

const props = defineProps({
	label: {
		type: String,
		required: true,
	},
	description: {
		type: String,
		default: '',
	},
})

const transactions = createListResource({
	doctype: 'LMS Payment',
	fields: [
		'name',
		'member',
		'billing_name',
		'source',
		'payment_for_document_type',
		'payment_for_document',
		'payment_received',
		'payment_for_certificate',
		'currency',
		'amount',
		'order_id',
		'payment_id',
		'gstin',
		'pan',
		'address',
	],
	auto: true,
	orderBy: 'modified desc',
})

watch(
	[billingName, member, paymentReceived, paymentForCertificate],
	([
		newBillingName,
		newMember,
		newPaymentReceived,
		newPaymentForCertificate,
	]) => {
		transactions.update({
			filters: [
				newBillingName ? [['billing_name', 'like', `%${newBillingName}%`]] : [],
				newMember ? [['member', '=', newMember]] : [],
				newPaymentReceived
					? [['payment_received', '=', newPaymentReceived]]
					: [],
				newPaymentForCertificate
					? [['payment_for_certificate', '=', newPaymentForCertificate]]
					: [],
			].flat(),
		})
		transactions.reload()
	},
	{ immediate: true }
)

const openForm = (transaction: { [key: string]: any }) => {
	currentTransaction.value = transaction
	showForm.value = true
}

const getCurrencySymbol = (currency: string) => {
	const currencySymbols: Record<string, string> = {
		USD: '$',
		EUR: '€',
		GBP: '£',
		INR: '₹',
		AED: 'د.إ',
		CHF: 'Fr',
		JPY: '¥',
		AUD: '$',
	}
	return currencySymbols[currency] || currency
}

const columns = computed(() => {
	return [
		{
			label: __('Billing Name'),
			icon: 'user',
			key: 'billing_name',
			width: '30%',
		},
		{
			label: __('Amount'),
			icon: 'dollar-sign',
			key: 'amount',
			width: '20%',
			align: 'right',
		},
		{
			label: __('Payment Received'),
			icon: 'check-circle',
			key: 'payment_received',
			width: '25%',
			align: 'center',
		},
		{
			label: __('Payment for Certificate'),
			icon: 'award',
			key: 'payment_for_certificate',
			width: '25%',
			align: 'center',
		},
	]
})
</script>
