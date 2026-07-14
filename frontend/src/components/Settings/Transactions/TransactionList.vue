<template>
	<SettingsLayout :title="__(label)" :description="__(description)">
		<template #header-actions>
			<Button variant="solid" @click="emit('updateStep', 'new', null)">
				<template #prefix>
					<span class="lucide-plus h-4 w-4" />
				</template>
				{{ __('New') }}
			</Button>
		</template>

		<template #header-bottom>
			<div class="flex items-center justify-between gap-2">
				<FormControl
					v-model="search"
					type="text"
					:debounce="300"
					class="w-1/3"
					:placeholder="__('Search')"
				>
					<template #prefix>
						<span class="lucide-search size-4 text-ink-gray-5" />
					</template>
				</FormControl>
				<Select
					v-model="paymentType"
					class="w-44"
					:options="paymentTypeOptions"
				/>
			</div>
		</template>

		<div v-if="transactions.data?.length">
			<List :columns="columns" class="list-row-px-3">
				<ListHeader>
					<ListHeaderCell>{{ __('Billing Name') }}</ListHeaderCell>
					<ListHeaderCell>
						{{ __('Amount') }}
					</ListHeaderCell>
					<ListHeaderCell>{{ __('Status') }}</ListHeaderCell>
				</ListHeader>
				<ListRows
					:items="transactions.data as Record<string, any>[]"
					row-key="name"
					v-slot="{ item: row }"
				>
					<ListRow class="py-3" @click="openForm(row)">
						<ListCell class="gap-2">
							<span class="lucide-user size-4 shrink-0 text-ink-gray-5" />
							<div class="flex min-w-0 flex-col">
								<span class="truncate text-p-base-medium text-ink-gray-8">
									{{ row.billing_name }}
								</span>
								<span class="truncate text-p-sm text-ink-gray-5">
									{{ row.member }}
								</span>
							</div>
						</ListCell>
						<ListCell class="text-p-base text-ink-gray-6">
							{{ getCurrencySymbol(row.currency) }} {{ row.amount }}
						</ListCell>
						<ListCell class="gap-2">
							<Badge v-if="row.payment_received" theme="green">
								{{ __('Paid') }}
							</Badge>
							<Badge v-if="row.payment_for_certificate" theme="blue">
								{{ __('Certificate') }}
							</Badge>
						</ListCell>
					</ListRow>
				</ListRows>
			</List>
			<div
				v-if="transactions.data.length && transactions.hasNextPage"
				class="flex justify-center mt-4"
			>
				<Button @click="transactions.next()">
					<template #prefix>
						<span class="lucide-refresh-cw h-3 w-3" />
					</template>
					{{ __('Load More') }}
				</Button>
			</div>
		</div>
		<EmptyStateLayout
			v-else
			name="Transactions"
			:description="__('Add one to get started.')"
			icon="lucide-landmark"
		/>
	</SettingsLayout>
</template>
<script setup lang="ts">
import { Badge, Button, FormControl, Select } from 'frappe-ui'
import {
	List,
	ListCell,
	ListHeader,
	ListHeaderCell,
	ListRow,
	ListRows,
} from 'frappe-ui/list'
import { ref, watch } from 'vue'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import SettingsLayout from '@/components/Layouts/SettingsLayout.vue'

const search = ref('')
const paymentType = ref('All')
const emit = defineEmits(['updateStep'])

const paymentTypeOptions = [
	{ label: __('All Payments'), value: 'All' },
	{ label: __('Paid'), value: 'Paid' },
	{ label: __('Unpaid'), value: 'Unpaid' },
	{ label: __('For Certificate'), value: 'Certificate' },
	{ label: __('For Course'), value: 'Course' },
]

const props = defineProps<{
	label: string
	description: string
	transactions: any
}>()

// One box searches both text fields, so the two clauses are OR'd server-side
// (or_filters); the payment Select stays an AND filter alongside it.
const paymentFilter = (type: string) => {
	switch (type) {
		case 'Paid':
			return [['payment_received', '=', 1]]
		case 'Unpaid':
			return [['payment_received', '=', 0]]
		case 'Certificate':
			return [['payment_for_certificate', '=', 1]]
		case 'Course':
			return [['payment_for_certificate', '=', 0]]
		default:
			return []
	}
}

watch(
	[search, paymentType],
	([newSearch, newPaymentType]) => {
		props.transactions.update({
			orFilters: newSearch
				? [
						['billing_name', 'like', `%${newSearch}%`],
						['member', 'like', `%${newSearch}%`],
				  ]
				: [],
			filters: paymentFilter(newPaymentType),
		})
		props.transactions.reload()
	},
	{ immediate: true }
)

// Grid track sizes shared by the header and every row (--list-columns).
const columns = ['minmax(0, 1fr)', '8rem', '10rem']

const openForm = (transaction: { [key: string]: any }) => {
	emit('updateStep', 'details', { ...transaction })
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
</script>
