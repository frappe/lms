<template>
	<div ref="root" class="flex h-full min-h-0 flex-col gap-3">
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
				<h3
					data-testid="panel-title"
					class="truncate text-base font-semibold text-ink-gray-9"
				>
					{{ title }}
				</h3>
			</div>
			<Button
				v-if="!showBack"
				data-testid="payment-panel-close"
				variant="ghost"
				icon="lucide-x"
				:aria-label="__('Close details')"
				@click="emit('close')"
			/>
		</div>
		<p
			v-if="helper"
			data-testid="panel-helper"
			class="text-p-sm text-ink-gray-6"
		>
			{{ helper }}
		</p>
		<div class="-mx-1 min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
			<template v-if="single && single.linkable_payments.length">
				<div
					role="group"
					:aria-label="__('Payment mode for {0}', [studentName(single)])"
				>
					<TabButtons
						:options="modeOptions"
						:modelValue="choice.mode"
						@update:modelValue="(value) => setMode(single!.member, String(value))"
					/>
				</div>
				<Select
					v-if="choice.mode === 'link'"
					:aria-label="__('Payment for {0}', [studentName(single)])"
					:placeholder="__('Select payment')"
					:options="paymentOptions(single)"
					:modelValue="choice.mode === 'link' ? choice.payment ?? '' : ''"
					@update:modelValue="(value: string) => setPayment(single!.member, value)"
				/>
			</template>
			<template v-if="editsPayment">
				<ErrorMessage
					v-if="missing.length"
					data-testid="missing-details"
					:message="__('Missing: {0}', [missing.join(', ')])"
				/>
				<section class="space-y-3">
					<template v-for="field in paymentFields" :key="field.key">
						<div class="space-y-1">
							<Link
								v-if="field.doctype"
								:doctype="field.doctype"
								:label="field.label"
								:required="field.required"
								:error="field.error"
								:placeholder="field.placeholder"
								:modelValue="String(field.value)"
								@update:modelValue="(value: string) => setField(field.key, value)"
							/>
							<FormControl
								v-else
								:type="field.key === 'amount' ? 'number' : 'text'"
								:label="field.label"
								:required="field.required"
								:error="field.error"
								:placeholder="field.placeholder"
								:modelValue="field.value"
								@update:modelValue="(value: unknown) => setField(field.key, value)"
							/>
						</div>
						<FormControl
							v-if="
								field.key === 'source' && !savedAddress && !addressCollapsed
							"
							type="text"
							:label="__('Phone')"
							:modelValue="typedAddress?.phone ?? ''"
							@update:modelValue="(value: unknown) => setField('phone', value)"
						/>
					</template>
				</section>
				<section
					role="group"
					class="space-y-3"
					:aria-labelledby="addressHeadingId"
				>
					<h4
						:id="addressHeadingId"
						class="text-sm font-medium text-ink-gray-7"
					>
						{{ __('Billing address') }}
					</h4>
					<div v-if="picking" class="space-y-2">
						<Link
							doctype="Address"
							query="frappe.contacts.doctype.address.address.address_query"
							:filters="addressFilters"
							:label="__('Existing address')"
							:modelValue="savedAddress?.name ?? ''"
							@update:modelValue="pickAddress"
						/>
						<div class="flex items-center gap-1">
							<Button
								data-testid="address-add-new"
								variant="ghost"
								:label="__('Add new address')"
								@click="addNewAddress"
							/>
							<Button
								v-if="overwriting"
								data-testid="address-cancel"
								variant="ghost"
								:label="__('Cancel')"
								@click="cancelOverwrite"
							/>
						</div>
					</div>
					<div
						v-else-if="savedAddress"
						data-testid="saved-address"
						class="flex items-center justify-between gap-2"
					>
						<p class="min-w-0 truncate text-p-sm text-ink-gray-8">
							{{ addressSummary(savedAddress) }}
						</p>
						<div class="flex shrink-0 items-center gap-1">
							<Button
								data-testid="address-change"
								variant="ghost"
								:label="__('Change')"
								@click="picking = true"
							/>
							<Button
								data-testid="address-add-new"
								variant="ghost"
								:label="__('Add new address')"
								@click="addNewAddress"
							/>
							<Button
								v-if="overwriting"
								data-testid="address-cancel"
								variant="ghost"
								:label="__('Cancel')"
								@click="cancelOverwrite"
							/>
						</div>
					</div>
					<div
						v-else-if="addressCollapsed"
						data-testid="address-differs"
						class="flex items-center justify-between gap-2"
					>
						<p class="min-w-0 text-p-sm text-ink-gray-6">
							{{
								__('Different addresses for these {0} students', [
									members.length,
								])
							}}
						</p>
						<Button
							ref="overwriteRef"
							data-testid="address-overwrite"
							class="shrink-0"
							variant="ghost"
							:label="__('Overwrite')"
							@click="overwrite"
						/>
					</div>
					<template v-else>
						<div
							ref="addressFieldsRef"
							data-testid="address-fields"
							class="grid grid-cols-2 gap-2"
						>
							<div
								v-for="field in addressFields"
								:key="field.key"
								:class="HALF_WIDTH.includes(field.key) ? '' : 'col-span-2'"
							>
								<Link
									v-if="field.doctype"
									:doctype="field.doctype"
									:aria-label="field.label"
									:placeholder="field.placeholder"
									:required="field.required"
									:error="field.error"
									:modelValue="String(field.value)"
									@update:modelValue="(value: string) => setField(field.key, value)"
								/>
								<FormControl
									v-else
									type="text"
									:aria-label="field.label"
									:placeholder="field.placeholder"
									:required="field.required"
									:error="field.error"
									:modelValue="field.value"
									@update:modelValue="(value: unknown) => setField(field.key, value)"
								/>
							</div>
						</div>
						<div class="flex items-center gap-1">
							<Button
								data-testid="address-use-existing"
								variant="subtle"
								:label="__('Use existing address')"
								@click="picking = true"
							/>
							<Button
								v-if="overwriting"
								data-testid="address-cancel"
								variant="ghost"
								:label="__('Cancel')"
								@click="cancelOverwrite"
							/>
						</div>
					</template>
				</section>
			</template>
		</div>
	</div>
</template>
<script setup lang="ts">
import {
	Button,
	ErrorMessage,
	FormControl,
	Select,
	TabButtons,
	call,
} from 'frappe-ui'
import { computed, nextTick, ref, useId, watch } from 'vue'
import Link from '@/components/Controls/Link.vue'
import {
	ADDRESS_FIELDS,
	addressSummary,
	emptyAddress,
	emptyOverride,
	formatMoney,
	isSavedAddress,
	missingKeyLabel,
	missingPaymentKeys,
	paymentFieldLabel,
	REQUIRED_ADDRESS_FIELDS,
	sharedAddress,
	sharedValue,
} from '@/components/Enrollment/enrollment'
import type { MissingKey } from '@/components/Enrollment/enrollment'
import dayjs from '@/utils/dayjs'
import type {
	AddressChoice,
	AddressField,
	BillingAddress,
	EnrollPreviewRow,
	PaymentChoice,
	PaymentDefaults,
	PaymentField,
	PaymentOverride,
	SavedAddress,
} from '@/types'

interface PanelField {
	key: PaymentField
	label: string
	doctype: string | null
	required: boolean
	error: string | undefined
	value: string | number
	placeholder: string
}

type OwnKey = 'amount' | 'currency' | 'source' | 'billing_name'

const OWN_KEYS: readonly string[] = [
	'amount',
	'currency',
	'source',
	'billing_name',
]

const isOwnKey = (key: string): key is OwnKey => OWN_KEYS.includes(key)

const props = withDefaults(
	defineProps<{
		rows: EnrollPreviewRow[]
		total: number
		showBack: boolean
		/** Marks every compulsory field that is still empty. */
		flagMissing?: boolean
		/** The rows are everyone, so the details for all are edited. */
		common?: boolean
		/** Some student falls back on the common address, so it is required. */
		commonAddressUsed?: boolean
	}>(),
	{ commonAddressUsed: true }
)

const emit = defineEmits<{
	close: []
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

const ADDRESS_LAYOUT: readonly AddressField[] = [
	'address_line1',
	'city',
	'country',
	'address_line2',
	'state',
	'pincode',
]

const HALF_WIDTH: readonly PaymentField[] = [
	'city',
	'country',
	'state',
	'pincode',
]

const addressHeadingId = useId()
const picking = ref<boolean>(false)

const modeOptions = [
	{ value: 'create', label: __('New payment') },
	{ value: 'link', label: __('Link existing') },
]

const studentName = (row: EnrollPreviewRow): string =>
	row.full_name || row.member

const mode = computed<'all' | 'one' | 'some'>(() => {
	if (props.common || !props.rows.length) return 'all'
	return props.rows.length === 1 ? 'one' : 'some'
})

const single = computed<EnrollPreviewRow | null>(() =>
	props.rows.length === 1 ? props.rows[0] : null
)

/** The ticked students edited as a group; a linked payment needs no details. */
const members = computed<string[]>(() =>
	mode.value === 'all'
		? []
		: props.rows
				.map((row) => row.member)
				.filter((member) => choices.value[member]?.mode !== 'link')
)

const title = computed<string>(() => {
	if (single.value) return studentName(single.value)
	if (mode.value === 'some')
		return __('Details for {0} students', [props.rows.length])
	return __('Details for all {0} students', [props.total])
})

const helper = computed<string>(() => {
	if (mode.value === 'one') return __('Empty fields use the details for all.')
	if (mode.value === 'some')
		return __(
			'What you enter applies to these {0}. Empty fields use the details for all.',
			[props.rows.length]
		)
	return ''
})

const choice = computed<PaymentChoice>(() =>
	single.value
		? choices.value[single.value.member] ?? { mode: 'create' }
		: { mode: 'create' }
)

const editsPayment = computed<boolean>(
	() =>
		choice.value.mode === 'create' &&
		(mode.value === 'all' || members.value.length > 0)
)

const ownOf = (member: string): PaymentOverride =>
	overrides.value[member] ?? emptyOverride()

/** Each ticked student's own address, else the common one. */
const effectiveAddresses = computed<(AddressChoice | null)[]>(() =>
	members.value.map((member) => ownOf(member).address ?? defaults.value.address)
)

const groupAddress = computed(() => sharedAddress(effectiveAddresses.value))

const ownAddress = computed<AddressChoice | null>(
	() => groupAddress.value.address
)

/** The ticked students have addresses, and not all the same one. */
const addressesDiffer = computed<boolean>(() => groupAddress.value.differs)

const overwriting = ref<boolean>(false)
const addressFieldsRef = ref<HTMLElement | null>(null)
const overwriteRef = ref<{ $el: HTMLElement } | null>(null)

/** The ticked students' own overrides from before Overwrite. */
let beforeOverwrite: Record<string, PaymentOverride | undefined> = {}

const addressCollapsed = computed<boolean>(
	() => addressesDiffer.value && !overwriting.value
)

/** Fields the user emptied, so an inherited value doesn't refill them. */
const cleared = ref<Set<OwnKey>>(new Set())

watch(
	() => [mode.value, ...props.rows.map((row) => row.member)].join(),
	() => {
		overwriting.value = false
		picking.value = false
		cleared.value = new Set()
	}
)

const overwrite = async () => {
	beforeOverwrite = Object.fromEntries(
		members.value.map((member) => [member, overrides.value[member]])
	)
	overwriting.value = true
	await nextTick()
	addressFieldsRef.value?.querySelector<HTMLElement>('input')?.focus()
}

const cancelOverwrite = async () => {
	const next = { ...overrides.value }
	for (const [member, before] of Object.entries(beforeOverwrite)) {
		const restored = { ...ownOf(member), address: before?.address ?? null }
		const empty = Object.values(restored).every((value) => value === null)
		if (!before && empty) delete next[member]
		else next[member] = restored
	}
	overrides.value = next
	overwriting.value = false
	picking.value = false
	await nextTick()
	overwriteRef.value?.$el?.focus()
}

const missingKeys = computed<MissingKey[]>(() => {
	if (mode.value === 'all') {
		return missingPaymentKeys(defaults.value, null, props.commonAddressUsed)
	}
	const keys = new Set<MissingKey>()
	for (const member of members.value) {
		const own = overrides.value[member] ?? null
		for (const key of missingPaymentKeys(defaults.value, own)) keys.add(key)
	}
	return Array.from(keys)
})

const missing = computed<string[]>(() => missingKeys.value.map(missingKeyLabel))

const errorFor = (key: PaymentField): string | undefined => {
	if (!props.flagMissing) return undefined
	const keys = missingKeys.value
	const empty =
		keys.includes(key) ||
		(keys.includes('address') && REQUIRED_ADDRESS_FIELDS.includes(key))
	return empty ? __('Required') : undefined
}

const commonValue = (key: OwnKey): string | number => {
	if (key === 'billing_name') {
		return single.value ? studentName(single.value) : __("Each student's name")
	}
	if (key === 'amount') return defaults.value.amount ?? ''
	return defaults.value[key] ?? ''
}

/**
 * What a field shows: the common value, or the value the ticked students
 * share once their own values are applied. The billing name has no common
 * value, so only an own one shows.
 */
const fieldState = (key: OwnKey) => {
	if (key === 'billing_name') {
		const solo = single.value ? [single.value.member] : []
		const owners = mode.value === 'all' ? solo : members.value
		return sharedValue(owners.map((member) => ownOf(member).billing_name))
	}
	if (mode.value === 'all') return { value: defaults.value[key], varies: false }
	return sharedValue(
		members.value.map((member) => ownOf(member)[key] ?? defaults.value[key])
	)
}

const paymentFields = computed<PanelField[]>(() => {
	const keys: readonly OwnKey[] =
		mode.value === 'all' && !single.value
			? ['amount', 'currency', 'source']
			: ['amount', 'currency', 'source', 'billing_name']
	return keys.map((key) => {
		const state = fieldState(key)
		return {
			key,
			label: paymentFieldLabel(key),
			doctype: DOCTYPES[key] ?? null,
			required:
				mode.value === 'all' && (key === 'amount' || key === 'currency'),
			error: errorFor(key),
			value: state.varies || cleared.value.has(key) ? '' : state.value ?? '',
			placeholder: state.varies ? __('Varies') : String(commonValue(key)),
		}
	})
})

const editedAddress = computed<AddressChoice | null>(() =>
	mode.value === 'all' ? defaults.value.address : ownAddress.value
)

const typedAddress = computed<BillingAddress | null>(() => {
	const address = editedAddress.value
	return address && !isSavedAddress(address) ? address : null
})

const savedAddress = computed<SavedAddress | null>(() => {
	const address = editedAddress.value
	return isSavedAddress(address) ? address : null
})

const addressFields = computed<PanelField[]>(() =>
	ADDRESS_LAYOUT.map((key) => ({
		key,
		label: paymentFieldLabel(key),
		doctype: DOCTYPES[key] ?? null,
		required: REQUIRED_ADDRESS_FIELDS.includes(key),
		error: errorFor(key),
		value: typedAddress.value?.[key] ?? '',
		placeholder: REQUIRED_ADDRESS_FIELDS.includes(key)
			? `${paymentFieldLabel(key)} *`
			: paymentFieldLabel(key),
	}))
)

const root = ref<HTMLElement | null>(null)

const focusFirst = () => {
	const el = root.value
	const target =
		el?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
		el?.querySelector<HTMLElement>('input') ??
		el?.querySelector<HTMLElement>('button')
	target?.scrollIntoView?.({ block: 'nearest' })
	target?.focus()
}

defineExpose({ focusFirst })

const addressFilters = computed<Record<string, string>>(() =>
	single.value
		? { link_doctype: 'User', link_name: single.value.member }
		: { address_type: 'Billing' }
)

const toAmount = (value: unknown): number | null => {
	if (value === null || value === '' || value === undefined) return null
	const amount = Number(value)
	return Number.isNaN(amount) ? null : amount
}

const toText = (value: unknown): string =>
	typeof value === 'string' ? value : ''

const typedOrEmpty = (address: AddressChoice | null): BillingAddress =>
	address && !isSavedAddress(address) ? address : emptyAddress()

const withAddressField = (
	address: AddressChoice | null | undefined,
	key: AddressField,
	value: unknown
): BillingAddress | null => {
	const base = address ?? (mode.value === 'all' ? null : defaults.value.address)
	const next = { ...typedOrEmpty(base), [key]: toText(value) }
	if (ADDRESS_FIELDS.some((field) => next[field])) return next
	// Emptied for ticked students, it stays their own blank address rather than
	// falling back on, and refilling with, the common one.
	return mode.value !== 'all' && defaults.value.address ? emptyAddress() : null
}

const isAddressField = (key: PaymentField): key is AddressField =>
	(ADDRESS_FIELDS as readonly string[]).includes(key)

const setCommon = (key: PaymentField, value: unknown) => {
	if (key === 'billing_name') {
		const member = single.value?.member
		if (member) setOwnBillingName(value, [member])
		return
	}
	if (key === 'amount') {
		defaults.value = { ...defaults.value, amount: toAmount(value) }
	} else if (key === 'currency' || key === 'source') {
		defaults.value = { ...defaults.value, [key]: toText(value) || null }
	} else {
		defaults.value = {
			...defaults.value,
			address: withAddressField(defaults.value.address, key, value),
		}
	}
}

const updateOwn = (
	change: (current: PaymentOverride) => PaymentOverride,
	targets: readonly string[] = members.value
) => {
	const next = { ...overrides.value }
	for (const member of targets) next[member] = change(ownOf(member))
	overrides.value = next
}

const setOwnBillingName = (value: unknown, targets: readonly string[]) =>
	updateOwn(
		(current) => ({ ...current, billing_name: toText(value) || null }),
		targets
	)

const setOwn = (key: PaymentField, value: unknown) => {
	const fresh = addressesDiffer.value ? emptyAddress() : null
	updateOwn((current) => {
		if (key === 'amount') {
			const amount = toAmount(value)
			return {
				...current,
				amount: amount === defaults.value.amount ? null : amount,
			}
		}
		if (key === 'currency' || key === 'source') {
			const text = toText(value) || null
			return { ...current, [key]: text === defaults.value[key] ? null : text }
		}
		if (!isAddressField(key))
			return { ...current, [key]: toText(value) || null }
		return {
			...current,
			address: withAddressField(fresh ?? current.address, key, value),
		}
	})
}

const setField = (key: PaymentField, value: unknown) => {
	if (isOwnKey(key)) {
		const next = new Set(cleared.value)
		if (value === '' || value === null || value === undefined) next.add(key)
		else next.delete(key)
		cleared.value = next
	}
	if (mode.value === 'all') setCommon(key, value)
	else setOwn(key, value)
}

const addressSetter = () => {
	const targets = mode.value === 'all' ? null : [...members.value]
	return (address: AddressChoice | null) => {
		picking.value = false
		if (!targets) defaults.value = { ...defaults.value, address }
		else updateOwn((current) => ({ ...current, address }), targets)
	}
}

const setAddress = (address: AddressChoice | null) => addressSetter()(address)

/** Blank fields; for ticked students, also not the common address. */
const addNewAddress = () =>
	setAddress(mode.value === 'all' ? null : emptyAddress())

const pickAddress = async (name: string) => {
	if (!name) {
		picking.value = false
		return
	}
	const apply = addressSetter()
	const fields: Partial<Record<AddressField, string | null>> | null =
		await call('frappe.client.get_value', {
			doctype: 'Address',
			filters: name,
			fieldname: ADDRESS_FIELDS,
		}).catch(() => null)
	const address = emptyAddress()
	for (const key of ADDRESS_FIELDS) address[key] = fields?.[key] ?? ''
	apply({ name, summary: addressSummary(address) })
}

const setMode = (member: string, value: string) => {
	const next: PaymentChoice =
		value === 'link' ? { mode: 'link', payment: null } : { mode: 'create' }
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
		label: `${formatMoney(payment.amount, payment.currency)} · ${dayjs(
			payment.creation
		).format('DD MMM YYYY')}`,
	}))
</script>
