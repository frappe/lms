<template>
	<SettingsLayout
		v-model:enabled="paymentReceived"
		:title="title"
		show-back
		:unsaved="isDirty"
		:enabled-label="__('Received')"
		:save-label="__('Save')"
		:saving="saving"
		:can-save="isDirty"
		save-testid="transaction-save"
		@back="emit('back')"
		@save="submit"
	>
		<div v-if="doc" data-testid="transaction-form" class="space-y-4">
			<div class="grid grid-cols-2 gap-4">
				<FormControl
					v-model="doc.billing_name"
					data-testid="billing-name"
					:label="__('Billing Name')"
					type="text"
					:placeholder="__('Ada Lovelace')"
					:required="required('billing_name')"
					autocomplete="off"
				/>
				<FormControl
					v-model="doc.amount"
					data-testid="amount"
					:label="__('Amount')"
					type="number"
					placeholder="0"
					:required="required('amount')"
					autocomplete="off"
				/>
				<FormControl
					v-if="showGst"
					v-model="doc.amount_with_gst"
					data-testid="amount-with-gst"
					:label="__('Amount with GST')"
					type="number"
					placeholder="0"
					:required="required('amount_with_gst')"
					autocomplete="off"
				/>
				<FormControl
					v-model="doc.payment_for_document_type"
					data-testid="document-type"
					:label="__('Paid For')"
					type="select"
					:options="documentTypeOptions()"
					:required="required('payment_for_document_type')"
				/>
				<FormControl
					v-model="doc.payment_id"
					data-testid="payment-id"
					:label="__('Payment ID')"
					type="text"
					:required="required('payment_id')"
					autocomplete="off"
				/>
				<FormControl
					v-model="doc.order_id"
					data-testid="order-id"
					:label="__('Order ID')"
					type="text"
					:required="required('order_id')"
					autocomplete="off"
				/>
			</div>

			<div class="flex flex-col items-start gap-3">
				<Checkbox
					v-model="forCertificate"
					data-testid="payment-for-certificate"
					:label="__('Payment for Certificate')"
				/>
				<Checkbox
					v-model="memberConsent"
					data-testid="member-consent"
					:label="__('Member Consent')"
				/>
			</div>

			<div class="h-px border-t border-outline-elevation-2" />

			<div
				class="flex items-center justify-between gap-8"
				role="group"
				:aria-labelledby="labelIds.member"
			>
				<div class="flex min-w-0 flex-col">
					<InputLabel
						:id="labelIds.member"
						:label="__('Member')"
						:required="required('member')"
						color="gray-7"
						class="font-medium leading-normal"
					/>
					<div class="text-p-sm text-ink-gray-5">
						{{ __('The user this payment is recorded against.') }}
					</div>
				</div>
				<Link
					v-model="doc.member"
					class="w-56"
					doctype="User"
					:aria-label="__('Member')"
					:required="required('member')"
				/>
			</div>

			<div
				v-if="doc.payment_for_document_type"
				class="flex items-center justify-between gap-8"
				role="group"
				:aria-labelledby="labelIds.payment_for_document"
			>
				<div class="flex min-w-0 flex-col">
					<InputLabel
						:id="labelIds.payment_for_document"
						:label="documentTypeLabel(doc.payment_for_document_type)"
						:required="required('payment_for_document')"
						color="gray-7"
						class="font-medium leading-normal"
					/>
					<div class="text-p-sm text-ink-gray-5">
						{{ __('What this payment paid for.') }}
					</div>
				</div>
				<Link
					v-model="doc.payment_for_document"
					class="w-56"
					:doctype="doc.payment_for_document_type"
					:aria-label="documentTypeLabel(doc.payment_for_document_type)"
					:required="required('payment_for_document')"
				/>
			</div>

			<div
				class="flex items-center justify-between gap-8"
				role="group"
				:aria-labelledby="labelIds.currency"
			>
				<div class="flex min-w-0 flex-col">
					<InputLabel
						:id="labelIds.currency"
						:label="__('Currency')"
						:required="required('currency')"
						color="gray-7"
						class="font-medium leading-normal"
					/>
					<div class="text-p-sm text-ink-gray-5">
						{{ __('The currency the amount above is in.') }}
					</div>
				</div>
				<Link
					v-model="doc.currency"
					class="w-56"
					doctype="Currency"
					:aria-label="__('Currency')"
					:required="required('currency')"
				/>
			</div>

			<div
				class="flex items-center justify-between gap-8"
				role="group"
				:aria-labelledby="labelIds.source"
			>
				<div class="flex min-w-0 flex-col">
					<InputLabel
						:id="labelIds.source"
						:label="__('Source')"
						:required="required('source')"
						color="gray-7"
						class="font-medium leading-normal"
					/>
					<div class="text-p-sm text-ink-gray-5">
						{{ __('Where the learner came from.') }}
					</div>
				</div>
				<Link
					v-model="doc.source"
					class="w-56"
					doctype="LMS Source"
					:aria-label="__('Source')"
					:required="required('source')"
				/>
			</div>

			<div
				class="flex items-center justify-between gap-8"
				role="group"
				:aria-labelledby="labelIds.address"
			>
				<div class="flex min-w-0 flex-col">
					<InputLabel
						:id="labelIds.address"
						:label="__('Billing Address')"
						:required="required('address')"
						color="gray-7"
						class="font-medium leading-normal"
					/>
					<div class="text-p-sm text-ink-gray-5">
						{{ __('The address this payment is billed to.') }}
					</div>
				</div>
				<Link
					v-model="doc.address"
					class="w-56"
					doctype="Address"
					:aria-label="__('Billing Address')"
					:required="required('address')"
					:onCreate="openAddressForm"
				/>
			</div>

			<div class="h-px border-t border-outline-elevation-2" />

			<div
				class="flex items-center justify-between gap-8"
				role="group"
				:aria-labelledby="labelIds.coupon"
			>
				<div class="flex min-w-0 flex-col">
					<InputLabel
						:id="labelIds.coupon"
						:label="__('Coupon')"
						:required="required('coupon')"
						color="gray-7"
						class="font-medium leading-normal"
					/>
					<div class="text-p-sm text-ink-gray-5">
						{{ __('The coupon this payment was discounted by.') }}
					</div>
				</div>
				<Link
					v-model="doc.coupon"
					class="w-56"
					doctype="LMS Coupon"
					:aria-label="__('Coupon')"
					:required="required('coupon')"
				/>
			</div>

			<template v-if="doc.coupon">
				<div class="flex items-center justify-between gap-8">
					<div class="flex min-w-0 flex-col">
						<div class="text-p-base-medium text-ink-gray-7">
							{{ __('Coupon Code') }}
						</div>
						<div class="text-p-sm text-ink-gray-5">
							{{ __('Read from the coupon above every time this is saved.') }}
						</div>
					</div>
					<div
						data-testid="coupon-code"
						class="truncate text-p-base text-ink-gray-8"
					>
						{{ doc.coupon_code }}
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<FormControl
						v-model="doc.original_amount"
						data-testid="original-amount"
						:label="__('Original Amount')"
						type="number"
						placeholder="0"
						:required="required('original_amount')"
						autocomplete="off"
					/>
					<FormControl
						v-model="doc.discount_amount"
						data-testid="discount-amount"
						:label="__('Discount Amount')"
						type="number"
						placeholder="0"
						:required="required('discount_amount')"
						autocomplete="off"
					/>
				</div>
			</template>

			<div class="h-px border-t border-outline-elevation-2" />

			<div class="grid grid-cols-2 gap-4">
				<FormControl
					v-model="doc.gstin"
					data-testid="gstin"
					:label="__('GSTIN')"
					type="text"
					:required="required('gstin')"
					autocomplete="off"
				/>
				<FormControl
					v-model="doc.pan"
					data-testid="pan"
					:label="__('PAN')"
					type="text"
					:required="required('pan')"
					autocomplete="off"
				/>
			</div>

			<ErrorMessage v-if="error" class="ms-1" :message="error" />
		</div>

		<div v-else-if="loading" class="flex justify-center pt-8">
			<LoadingIndicator class="size-6 text-ink-gray-5" />
		</div>
	</SettingsLayout>

	<AddressModal v-model:show="showAddress" @created="setAddress" />
</template>

<script setup lang="ts">
import {
	Checkbox,
	ErrorMessage,
	FormControl,
	LoadingIndicator,
	createResource,
} from 'frappe-ui'
import { computed, ref, useId } from 'vue'
import AddressModal from '@/components/Settings/Transactions/AddressModal.vue'
import { InputLabel } from '@/components/Form/labeling'
import Link from '@/components/Controls/Link.vue'
import SettingsLayout from '@/components/Layouts/settings/desktop/SettingsLayout.vue'
import {
	DOCTYPE,
	FIELD_META_METHOD,
	REQUIRED_FIELDS,
	documentTypeLabel,
	documentTypeOptions,
} from '@/components/Settings/Transactions/transactions'
import { reloadSettingsLists } from '@/composables/useSettingsListResource'
import { useSettingsRecord } from '@/composables/useSettingsRecord'
import { runSave, useSaveState } from '@/composables/useSettingsSave'
import { cleanError } from '@/utils'
import type { FieldMeta } from '@/types/settingsSchema'

/**
 * One payment, behind both a row and New, edited the same way in both states.
 * coupon_code is the one field the page reads rather than offers: it's
 * read_only and refetched from the coupon on every save. Body is hand-rolled
 * rather than a fields page, following CRM's Telephony/TwilioSettings.vue.
 */

const props = defineProps<{ name?: string | null }>()

const emit = defineEmits<{ back: [] }>()

const showAddress = ref(false)

// The rows that draw their own label rather than handing one to the control:
// the label is the group's name, so the mark it carries when the field is reqd
// is announced with it.
const labelIds = {
	member: useId(),
	payment_for_document: useId(),
	currency: useId(),
	source: useId(),
	address: useId(),
	coupon: useId(),
}

const state = useSaveState()
const saving = state.saving
const error = state.error

const record = computed(() => props.name ?? null)

// Now a component that mounts only while the record page is, so the
// composable's own guard registration is the whole of it. `payment_received`
// is the header switch, not a body field, like every other settings record.
const {
	source,
	doc,
	isNew,
	isDirty,
	loading,
	name: recordName,
	enabled: paymentReceived,
} = useSettingsRecord({
	doctype: DOCTYPE,
	record,
	enabledField: 'payment_received',
})

const title = computed(() => {
	if (isNew.value) return __('New Transaction')
	return doc.value?.billing_name || recordName.value || __('Transaction')
})

/**
 * The doctype's mandatory fields, as the server reports them. A site is free
 * to relax or tighten `reqd` on any of them.
 */
const fieldMeta = createResource({
	url: FIELD_META_METHOD,
	auto: false,
}) as unknown as { data: FieldMeta | null; fetch: () => Promise<unknown> }

const required = (field: string): boolean => {
	const reported = fieldMeta.data?.[field]?.reqd
	if (reported === undefined) return REQUIRED_FIELDS.includes(field)
	return Boolean(reported)
}

/**
 * GST is the doctype's `currency == "INR"` condition, plus whatever a payment
 * already carries, so correcting the currency later can't hide a recorded figure.
 */
const showGst = computed(
	() => doc.value?.currency === 'INR' || Boolean(doc.value?.amount_with_gst)
)

/**
 * A Check as a control reads and writes it, because the doctype stores 0 and 1
 * and both frappe-ui controls speak booleans. Writing through the document is
 * what makes the toggle dirty, exactly as a text field is.
 */
const flag = (field: string) =>
	computed<boolean>({
		get: () => Boolean(doc.value?.[field]),
		set: (value) => {
			if (doc.value) doc.value[field] = value ? 1 : 0
		},
	})

const forCertificate = flag('payment_for_certificate')
const memberConsent = flag('member_consent')

const openAddressForm = () => {
	showAddress.value = true
}

const setAddress = (name: string) => {
	if (doc.value) doc.value.address = name
}

// The same check in both states, because the same fields are offered in both.
// A read_only field is never among them: the server fills those in.
const validate = (): string => {
	const payment = doc.value
	if (!payment) return ''
	const missing = REQUIRED_FIELDS.filter(
		(field) => required(field) && !payment[field]
	)
	return missing.length ? __('Fill in every required field') : ''
}

const submit = () => {
	// Read before the write: an inserted draft is still a draft afterwards, so
	// this is the only moment the two states can be told apart.
	const wasNew = isNew.value
	return runSave(state, {
		validate,
		run: () => source.save(),
		success: wasNew
			? __('Transaction created successfully')
			: __('Transaction updated successfully'),
		// A draft has no record page to stay on, so going back is what refetches
		// the list; on the update side the registry does it instead.
		after: async () => {
			if (wasNew) emit('back')
			else await reloadSettingsLists(DOCTYPE)
		},
		failure: (err: any) =>
			cleanError(err?.messages?.[0] || err?.message) ||
			__('Error saving transaction'),
	})
}

// Fetched when a record page opens, which is now this component mounting.
if (!fieldMeta.data) fieldMeta.fetch()
</script>
