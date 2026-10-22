<template>
	<div class="space-y-4">
		<div class="flex items-center justify-between gap-2">
			<div class="flex min-w-0 items-center gap-1">
				<Button
					v-if="showBack"
					data-testid="payment-panel-back"
					variant="ghost"
					icon="lucide-chevron-left"
					:aria-label="__('Back')"
					@click="emit('back')"
				/>
				<h3 class="truncate text-base font-semibold text-ink-gray-9">
					{{ title }}
				</h3>
			</div>
			<Button
				v-if="row"
				data-testid="common-details-link"
				variant="outline"
				size="sm"
				:label="__('Common details')"
				@click="emit('common')"
			/>
		</div>
		<template v-if="row && row.linkable_payments.length">
			<div
				role="group"
				:aria-label="__('Payment mode for {0}', [studentName(row)])"
			>
				<TabButtons
					:options="modeOptions"
					:modelValue="choice.mode"
					@update:modelValue="(value) => setMode(row!.member, String(value))"
				/>
			</div>
			<Select
				v-if="choice.mode === 'link'"
				:aria-label="__('Payment for {0}', [studentName(row)])"
				:placeholder="__('Select payment')"
				:options="paymentOptions(row)"
				:modelValue="choice.mode === 'link' ? choice.payment ?? '' : ''"
				@update:modelValue="(value: string) => setPayment(row!.member, value)"
			/>
		</template>
		<template v-if="choice.mode === 'create'">
			<ErrorMessage
				v-if="missing.length"
				data-testid="missing-details"
				:message="__('Missing: {0}', [missing.join(', ')])"
			/>
			<section v-for="section in sections" :key="section.key" class="space-y-3">
				<template v-if="section.key === 'address'">
					<h4
						:id="addressHeadingId"
						class="text-sm font-medium text-ink-gray-7"
					>
						{{ __('Billing address') }}
					</h4>
					<div
						v-if="row"
						role="group"
						:aria-label="__('Billing address for {0}', [studentName(row)])"
					>
						<TabButtons
							:options="addressOptions"
							:modelValue="ownAddress ? 'own' : 'common'"
							@update:modelValue="(value) => setAddressMode(String(value))"
						/>
					</div>
					<p
						v-if="row && !ownAddress"
						data-testid="common-address-summary"
						class="text-p-sm text-ink-gray-7"
					>
						{{ addressSummary(defaults.address) || __('No address') }}
					</p>
					<ErrorMessage
						v-else-if="addressError"
						:id="addressErrorId"
						:message="addressError"
					/>
				</template>
				<div
					v-if="section.fields.length"
					role="group"
					class="space-y-3"
					:aria-labelledby="
						section.key === 'address' ? addressHeadingId : undefined
					"
					:aria-describedby="section.describedBy"
				>
					<div
						v-for="field in section.fields"
						:key="field.key"
						class="space-y-1"
					>
						<Link
							v-if="field.doctype"
							:doctype="field.doctype"
							:label="field.label"
							:required="field.required"
							:placeholder="field.placeholder"
							:modelValue="String(field.value)"
							@update:modelValue="(value: string) => setField(field.key, value)"
						/>
						<FormControl
							v-else
							:type="field.key === 'amount' ? 'number' : 'text'"
							:label="field.label"
							:required="field.required"
							:placeholder="field.placeholder"
							:aria-describedby="section.describedBy"
							:modelValue="field.value"
							@update:modelValue="(value: unknown) => setField(field.key, value)"
						/>
					</div>
				</div>
			</section>
		</template>
	</div>
</template>
<script setup lang="ts">
import {
	Button,
	ErrorMessage,
	FormControl,
	Select,
	TabButtons,
} from 'frappe-ui'
import { computed, useId } from 'vue'
import Link from '@/components/Controls/Link.vue'
import {
	ADDRESS_FIELDS,
	addressSummary,
	emptyAddress,
	emptyOverride,
	missingAddressFields,
	missingPaymentDetails,
	paymentFieldLabel,
} from '@/components/Enrollment/enrollment'
import dayjs from '@/utils/dayjs'
import type {
	AddressField,
	BillingAddress,
	EnrollPreviewRow,
	PaymentChoice,
	PaymentDefaults,
	PaymentField,
	PaymentOverride,
} from '@/types'

interface PanelField {
	key: PaymentField
	label: string
	doctype: string | null
	required: boolean
	value: string | number
	placeholder: string
}

interface PanelSection {
	key: 'payment' | 'address'
	fields: PanelField[]
	describedBy: string | undefined
}

const props = defineProps<{
	row: EnrollPreviewRow | null
	showBack: boolean
}>()

const emit = defineEmits<{
	common: []
	back: []
}>()

const defaults = defineModel<PaymentDefaults>('defaults', { required: true })
const choices = defineModel<Record<string, PaymentChoice>>('choices', {
	default: () => ({}),
})
const overrides = defineModel<Record<string, PaymentOverride>>('overrides', {
	default: () => ({}),
})

const DOCTYPES: Partial<Record<PaymentField, string>> = {
	currency: 'Currency',
	source: 'LMS Source',
	country: 'Country',
}

const REQUIRED_IN_ADDRESS: readonly PaymentField[] = [
	'address_line1',
	'city',
	'country',
]

const addressHeadingId = useId()
const addressErrorId = useId()

const modeOptions = [
	{ value: 'create', label: __('Create new') },
	{ value: 'link', label: __('Link existing') },
]

const addressOptions = [
	{ value: 'common', label: __('Same as common address') },
	{ value: 'own', label: __('Different address') },
]

const studentName = (row: EnrollPreviewRow): string =>
	row.full_name || row.member

const title = computed<string>(() =>
	props.row ? studentName(props.row) : __('Common details')
)

const choice = computed<PaymentChoice>(() =>
	props.row
		? choices.value[props.row.member] ?? { mode: 'create' }
		: { mode: 'create' }
)

const override = computed<PaymentOverride | null>(() =>
	props.row ? overrides.value[props.row.member] ?? emptyOverride() : null
)

const ownAddress = computed<BillingAddress | null>(
	() => override.value?.address ?? null
)

const missing = computed<string[]>(() =>
	missingPaymentDetails(defaults.value, override.value)
)

const commonValue = (key: PaymentField): string => {
	if (key === 'billing_name') return props.row ? studentName(props.row) : ''
	if (key === 'amount') return defaults.value.amount?.toString() ?? ''
	if (key === 'currency' || key === 'source') return defaults.value[key] ?? ''
	return defaults.value.address[key]
}

const ownValue = (
	key: 'amount' | 'currency' | 'source' | 'billing_name'
): string | number | null => override.value?.[key] ?? null

const paymentFields = computed<PanelField[]>(() => {
	const keys = props.row
		? (['billing_name', 'amount', 'currency', 'source'] as const)
		: (['amount', 'currency', 'source'] as const)
	return keys.map((key) => {
		const own = ownValue(key)
		const common = commonValue(key)
		return {
			key,
			label: paymentFieldLabel(key),
			doctype: DOCTYPES[key] ?? null,
			required: !props.row && (key === 'amount' || key === 'currency'),
			value: props.row
				? own ?? ''
				: key === 'amount'
				? defaults.value.amount ?? ''
				: common,
			placeholder: props.row ? common : '',
		}
	})
})

const editedAddress = computed<BillingAddress>(
	() => ownAddress.value ?? defaults.value.address
)

const addressMissing = computed<AddressField[]>(() =>
	missingAddressFields(editedAddress.value, !!ownAddress.value)
)

const addressError = computed<string>(() =>
	addressMissing.value.length
		? __('An address needs address line 1, city and country.')
		: ''
)

const addressFields = computed<PanelField[]>(() => {
	if (props.row && !ownAddress.value) return []
	const filled =
		!!ownAddress.value ||
		ADDRESS_FIELDS.some((key) => editedAddress.value[key].trim())
	return ADDRESS_FIELDS.map((key) => ({
		key,
		label: paymentFieldLabel(key),
		doctype: DOCTYPES[key] ?? null,
		required: filled && REQUIRED_IN_ADDRESS.includes(key),
		value: editedAddress.value[key],
		placeholder: '',
	}))
})

const sections = computed<PanelSection[]>(() => [
	{ key: 'payment', fields: paymentFields.value, describedBy: undefined },
	{
		key: 'address',
		fields: addressFields.value,
		describedBy: addressError.value ? addressErrorId : undefined,
	},
])

const toAmount = (value: unknown): number | null => {
	if (value === null || value === '' || value === undefined) return null
	const amount = Number(value)
	return Number.isNaN(amount) ? null : amount
}

const toText = (value: unknown): string =>
	typeof value === 'string' ? value : ''

const isAddressField = (key: PaymentField): key is AddressField =>
	(ADDRESS_FIELDS as readonly string[]).includes(key)

const setCommon = (key: PaymentField, value: unknown) => {
	if (key === 'billing_name') return
	if (key === 'amount') {
		defaults.value = { ...defaults.value, amount: toAmount(value) }
	} else if (key === 'currency' || key === 'source') {
		defaults.value = { ...defaults.value, [key]: toText(value) || null }
	} else {
		defaults.value = {
			...defaults.value,
			address: { ...defaults.value.address, [key]: toText(value) },
		}
	}
}

const updateOwn = (
	member: string,
	change: (current: PaymentOverride) => PaymentOverride
) => {
	const current = overrides.value[member] ?? emptyOverride()
	overrides.value = { ...overrides.value, [member]: change(current) }
}

const setOwn = (member: string, key: PaymentField, value: unknown) => {
	updateOwn(member, (current) => {
		if (key === 'amount') return { ...current, amount: toAmount(value) }
		if (!isAddressField(key))
			return { ...current, [key]: toText(value) || null }
		const address = current.address ?? emptyAddress()
		return { ...current, address: { ...address, [key]: toText(value) } }
	})
}

const setField = (key: PaymentField, value: unknown) => {
	if (props.row) setOwn(props.row.member, key, value)
	else setCommon(key, value)
}

const setAddressMode = (mode: string) => {
	if (!props.row) return
	updateOwn(props.row.member, (current) => ({
		...current,
		address: mode === 'own' ? current.address ?? emptyAddress() : null,
	}))
}

const setMode = (member: string, mode: string) => {
	const next: PaymentChoice =
		mode === 'link' ? { mode: 'link', payment: null } : { mode: 'create' }
	choices.value = { ...choices.value, [member]: next }
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
