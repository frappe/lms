<template>
	<div class="space-y-4">
		<div class="grid gap-3 sm:grid-cols-3">
			<FormControl
				type="number"
				:label="__('Amount')"
				:modelValue="defaults.amount"
				@update:modelValue="setAmount"
			/>
			<Link
				doctype="Currency"
				:label="__('Currency')"
				:modelValue="defaults.currency ?? ''"
				@update:modelValue="(value: string) => setDefault('currency', value)"
			/>
			<Link
				doctype="LMS Source"
				:label="__('Source')"
				:required="true"
				:modelValue="defaults.source ?? ''"
				@update:modelValue="(value: string) => setDefault('source', value)"
			/>
		</div>
		<ul class="flex flex-col gap-1.5">
			<li
				v-for="row in rows"
				:key="row.member"
				class="flex items-center justify-between gap-3 rounded-6 bg-surface-gray-2 px-3 py-1.5"
			>
				<span class="min-w-0 truncate text-base text-ink-gray-8">
					{{ row.full_name || row.member }}
				</span>
				<div
					v-if="row.linkable_payments.length"
					class="flex shrink-0 items-center gap-2"
				>
					<div
						role="group"
						:aria-label="
							__('Payment mode for {0}', [row.full_name || row.member])
						"
					>
						<TabButtons
							:options="modeOptions"
							:modelValue="modeOf(row.member)"
							@update:modelValue="(value) => setMode(row.member, String(value))"
						/>
					</div>
					<Select
						v-if="modeOf(row.member) === 'link'"
						:aria-label="__('Payment for {0}', [row.full_name || row.member])"
						:placeholder="__('Select payment')"
						:options="paymentOptions(row)"
						:modelValue="linkedPayment(row.member)"
						@update:modelValue="(value: string) => setPayment(row.member, value)"
					/>
				</div>
				<span v-else class="shrink-0 text-sm text-ink-gray-6">
					{{ __('New payment') }}
				</span>
			</li>
		</ul>
	</div>
</template>
<script setup lang="ts">
import { FormControl, Select, TabButtons } from 'frappe-ui'
import Link from '@/components/Controls/Link.vue'
import dayjs from '@/utils/dayjs'
import type { EnrollPreviewRow, PaymentChoice, PaymentDefaults } from '@/types'

defineProps<{
	rows: EnrollPreviewRow[]
}>()

const defaults = defineModel<PaymentDefaults>('defaults', { required: true })
const choices = defineModel<Record<string, PaymentChoice>>('choices', {
	default: () => ({}),
})

const modeOptions = [
	{ value: 'create', label: __('Create new') },
	{ value: 'link', label: __('Link existing') },
]

const setDefault = (key: 'currency' | 'source', value: string) => {
	defaults.value = { ...defaults.value, [key]: value || null }
}

const setAmount = (value: string | number | null) => {
	const amount =
		value === null || value === '' || Number.isNaN(Number(value))
			? null
			: Number(value)
	defaults.value = { ...defaults.value, amount }
}

const modeOf = (member: string): string =>
	choices.value[member]?.mode ?? 'create'

const linkedPayment = (member: string): string => {
	const choice = choices.value[member]
	return choice?.mode === 'link' ? choice.payment ?? '' : ''
}

const setMode = (member: string, mode: string) => {
	const choice: PaymentChoice =
		mode === 'link' ? { mode: 'link', payment: null } : { mode: 'create' }
	choices.value = { ...choices.value, [member]: choice }
}

const setPayment = (member: string, payment: string) => {
	choices.value = {
		...choices.value,
		[member]: { mode: 'link', payment: payment || null },
	}
}

const paymentOptions = (row: EnrollPreviewRow) =>
	row.linkable_payments.map((payment) => ({
		value: payment.name,
		label: `${payment.amount} ${payment.currency} · ${dayjs(
			payment.creation
		).format('DD MMM YYYY')}`,
	}))
</script>
