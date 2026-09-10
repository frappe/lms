<template>
	<SettingsLayout
		:title="title"
		show-back
		:unsaved="isDirty"
		v-model:enabled="enabled"
		:save-label="__('Save')"
		:saving="saving"
		:can-save="isDirty"
		@back="emit('back')"
		@save="save"
	>
		<div v-if="doc" class="space-y-4">
			<div class="grid grid-cols-2 gap-4">
				<FormControl
					v-model="code"
					:label="__('Coupon Code')"
					type="text"
					placeholder="WELCOME10"
					required
					autocomplete="off"
				/>
				<FormControl
					v-model="doc.discount_type"
					:label="__('Discount Type')"
					type="select"
					:options="discountTypeOptions()"
					required
				/>
				<FormControl
					v-if="doc.discount_type === 'Fixed Amount'"
					v-model="doc.fixed_amount_discount"
					:label="__('Discount Amount')"
					type="number"
					placeholder="500"
					required
					autocomplete="off"
				/>
				<FormControl
					v-else
					v-model="doc.percentage_discount"
					:label="__('Discount Percentage')"
					type="number"
					placeholder="10"
					required
					autocomplete="off"
				/>
				<FormControl
					v-model="doc.expires_on"
					:label="__('Expires On')"
					type="date"
					autocomplete="off"
				/>
				<FormControl
					v-model="doc.usage_limit"
					:label="__('Usage Limit')"
					type="number"
					:placeholder="__('Unlimited')"
					autocomplete="off"
				/>
			</div>

			<div class="h-px border-t border-outline-elevation-2" />

			<div class="flex items-center justify-between gap-8">
				<div class="flex flex-col">
					<div class="text-p-base-medium text-ink-gray-7">
						{{ __('Redeemed') }}
					</div>
					<div class="text-p-sm text-ink-gray-5">
						{{ __('How many times this code has been used so far') }}
					</div>
				</div>
				<div class="text-p-base text-ink-gray-8">{{ redeemed }}</div>
			</div>

			<div class="h-px border-t border-outline-elevation-2" />

			<div class="space-y-4" role="group" :aria-labelledby="applicableLabelId">
				<div class="flex items-center justify-between gap-8">
					<div class="flex flex-col">
						<InputLabel
							:id="applicableLabelId"
							:label="__('Applicable For')"
							:required="true"
							color="gray-7"
							class="font-medium leading-normal"
						/>
						<div class="text-p-sm text-ink-gray-5">
							{{ __('The courses and batches this coupon can be redeemed on') }}
						</div>
					</div>
					<Button @click="addItem()">
						<template #prefix>
							<span class="lucide-plus size-4" aria-hidden="true" />
						</template>
						{{ __('Add') }}
					</Button>
				</div>

				<div v-if="items.length" class="space-y-3">
					<div
						v-for="(item, index) in items"
						:key="item.name ?? index"
						class="grid grid-cols-[10rem_minmax(0,1fr)_auto] items-center gap-3"
					>
						<Select
							v-model="item.reference_doctype"
							:options="applicableDoctypeOptions()"
							:aria-label="__('Document type')"
							:required="true"
						/>
						<Link
							v-model="item.reference_name"
							:doctype="item.reference_doctype"
							:aria-label="__('Document name')"
							:required="true"
						/>
						<Button
							variant="ghost"
							:aria-label="__('Remove row')"
							@click="removeItem(index)"
						>
							<template #icon>
								<span class="lucide-x size-4" aria-hidden="true" />
							</template>
						</Button>
					</div>
				</div>
				<p v-else class="text-p-sm text-ink-gray-5">
					{{ __('Add at least one course or batch.') }}
				</p>
			</div>

			<ErrorMessage v-if="error" class="ms-1" :message="error" />
		</div>

		<div v-else class="flex flex-1 items-center justify-center py-20">
			<LoadingIndicator class="size-5 text-ink-gray-5" />
		</div>
	</SettingsLayout>
</template>
<script setup lang="ts">
import { ErrorMessage, FormControl, LoadingIndicator, toast } from 'frappe-ui'
import { computed, ref, useId, watch } from 'vue'
import { cleanError } from '@/utils'
import { reloadSettingsLists } from '@/composables/useSettingsListResource'
import { useSettingsRecord } from '@/composables/useSettingsRecord'
import { runSave, useSaveState } from '@/composables/useSettingsSave'
import { InputLabel } from '@/components/Form/labeling'
import Link from '@/components/Controls/Link.vue'
import Select from '@/components/Controls/Select.vue'
import SettingsLayout from '@/components/Layouts/settings/desktop/SettingsLayout.vue'
import {
	applicableDoctypeOptions,
	COUPON_DOCTYPE,
	discountTypeOptions,
	newCoupon,
} from '@/components/Settings/Coupons/coupons'
import type { SettingsListRow } from '@/types'

/**
 * One coupon, drawn by hand rather than by SettingsFields: a coupon is a code
 * and a discount and the rows it applies to, not a column of labelled controls.
 */

const props = defineProps<{ name?: string | null }>()

const emit = defineEmits<{ back: [] }>()

const applicableLabelId = useId()

const state = useSaveState()
const saving = state.saving
const error = state.error

const record = computed(() => props.name ?? null)

// A draft is dirty against the defaults it opened on, not against emptiness:
// newCoupon() seeds fields that draftIsDirty would otherwise call dirty,
// which left New Coupon reading "Not saved" before anything was typed.
const pristine = ref('')

const snapshot = (value: SettingsListRow | null) =>
	JSON.stringify(value ?? null)

const { source, doc, isNew, isDirty, enabled } = useSettingsRecord({
	doctype: COUPON_DOCTYPE,
	record,
	dirty: (s) => (s.isNew ? snapshot(s.doc) !== pristine.value : s.isDirty),
})

// `immediate` because the form mounts with the record already chosen, so
// `isNew` never transitions; it is true from setup, and the draft built there
// is what stays. `flush: post` still covers a later transition.
watch(
	() => source.isNew,
	(seeding) => {
		if (!seeding || !doc.value) return
		Object.assign(doc.value, newCoupon())
		pristine.value = snapshot(doc.value)
	},
	{ flush: 'post', immediate: true }
)

const title = computed(() =>
	isNew.value ? __('New Coupon') : doc.value?.code || __('Coupon')
)

// Codes are typed in whatever case and redeemed in one.
const code = computed<string>({
	get: () => doc.value?.code ?? '',
	set: (value) => {
		if (doc.value) doc.value.code = value.toUpperCase()
	},
})

// A coupon with no usage limit has no denominator to count against.
const redeemed = computed(() => {
	const count = doc.value?.redemption_count || 0
	const limit = doc.value?.usage_limit
	return limit ? `${count} / ${limit}` : String(count)
})

const items = computed<SettingsListRow[]>(
	() => doc.value?.applicable_items ?? []
)

const addItem = () => {
	const current = doc.value
	if (!current) return
	if (!Array.isArray(current.applicable_items)) current.applicable_items = []
	current.applicable_items.push({
		reference_doctype: 'LMS Course',
		reference_name: '',
	})
}

const removeItem = (index: number) => {
	doc.value?.applicable_items?.splice(index, 1)
}

// A row with nothing chosen is not an applicable item, and the server requires
// at least one that is.
const filledItems = (): SettingsListRow[] =>
	items.value.filter((item) => item.reference_name)

// Four of these are reqd on the doctype, so the server would reject an
// incomplete coupon anyway, one field per round trip. Naming the first gap
// here is additive: everything past it still has to survive the server.
const validate = (): string => {
	const current = doc.value
	if (!current?.code) return __('Coupon Code is required')
	if (!current.discount_type) return __('Discount Type is required')
	if (current.discount_type === 'Percentage' && !current.percentage_discount)
		return __('Discount Percentage is required')
	if (
		current.discount_type === 'Fixed Amount' &&
		!current.fixed_amount_discount
	)
		return __('Discount Amount is required')
	if (!filledItems().length)
		return __('Add at least one course or batch this coupon applies to')
	return ''
}

// `reloadSettingsLists` rather than a handle on the list: the list lives in the
// parent now, and the registry refetches every list showing this doctype.
const save = () => {
	if (!doc.value) return
	const wasNew = isNew.value
	return runSave(state, {
		validate,
		run: () => {
			doc.value!.applicable_items = filledItems()
			return source.save()
		},
		success: wasNew
			? __('Coupon created successfully')
			: __('Coupon updated successfully'),
		after: async () => {
			await reloadSettingsLists(COUPON_DOCTYPE)
			if (wasNew) emit('back')
		},
		failure: (err: any) =>
			cleanError(err?.messages?.[0] || err?.message || err) ||
			__('Error saving coupon'),
	})
}
</script>
