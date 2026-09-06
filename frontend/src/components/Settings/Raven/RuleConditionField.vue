<template>
	<p v-if="frozen || !editable" class="pt-1 text-p-base text-ink-gray-6">
		{{ readText }}
	</p>
	<div v-else>
		<div v-if="isMultiLink" role="group" :aria-labelledby="ariaLabelledby">
			<MultiLink
				:model-value="listValue"
				:doctype="doctypeOf"
				:placeholder="fieldLabel"
				allow-select-all
				class="w-full"
				@update:model-value="emit('update:modelValue', $event)"
			/>
		</div>
		<div
			v-else-if="isMultiStatic"
			role="group"
			:aria-labelledby="ariaLabelledby"
		>
			<MultiSelect
				:model-value="listValue"
				:options="staticOptions"
				:placeholder="fieldLabel"
				class="w-full"
				@update:model-value="emit('update:modelValue', $event as string[])"
			/>
		</div>
		<Select
			v-else
			:model-value="selectValue"
			:options="selectOptions"
			:aria-labelledby="ariaLabelledby"
			side="bottom"
			align="start"
			class="w-full"
			@update:model-value="emit('update:modelValue', $event as string)"
		/>
		<p
			v-if="description"
			class="mt-1 text-p-sm text-ink-gray-5"
			data-testid="field-description"
		>
			{{ description }}
		</p>
	</div>
</template>

<script setup lang="ts">
// One provider field rendered as a control: whichever of the row's three cells
// or its wrapped continuation lines is showing it. Shared so a `MultiSelect`
// gets a `MultiLink` and a `Select` gets a `Select` in exactly one place, rather
// than the value cell and the extra fields each carrying their own copy of the
// same fieldtype branch.
//
// A frozen field (the row's own frozen state, handed down by the caller) reads
// as text regardless of its fieldtype, for the same reason the row's other
// cells do: a disabled control is skipped by a screen reader's forms mode and
// exempt from the contrast minimum. A fieldtype this file has no control for
// reads as that same text rather than as a defect notice: a value nobody can
// edit is still a value the reader needs, and naming the fieldtype instead
// dropped it.
//
// The declared `description` is rendered under the control because the scope
// fields' whole meaning is in it: an empty "Batches" reads as "matches nobody"
// where the backend means "every batch".
//
// Select-all is opted into here and nowhere else. A condition names a set the
// reader is deliberately widening. "Every course we currently list" is a real
// answer to "which courses?". The forms that pick instructors or related
// courses are naming a few specific records, and an all-of button beside them
// would only be a way to get it wrong in one click.
import { computed } from 'vue'
import { MultiSelect, Select } from 'frappe-ui'
import MultiLink from '@/components/Controls/MultiLink.vue'
import type { RuleField, RuleFieldValue } from '@/types'

interface Option {
	label: string
	value: string
}

const props = defineProps<{
	field: RuleField
	modelValue: RuleFieldValue | undefined
	frozen: boolean
	/** Id of the label this control is named against. Unset in frozen text mode. */
	ariaLabelledby?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: RuleFieldValue] }>()

const isMultiLink = computed<boolean>(
	() => props.field.fieldtype === 'MultiSelect'
)
// A multiselect whose candidates are declared rather than searched. `options` is
// a literal list here, exactly as a `Select` declares one, so the two share
// `selectOptions` and differ only in how many of it you may pick.
const isMultiStatic = computed<boolean>(
	() => props.field.fieldtype === 'MultiSelectStatic'
)
const isSelect = computed<boolean>(() => props.field.fieldtype === 'Select')
const editable = computed<boolean>(
	() => isMultiLink.value || isMultiStatic.value || isSelect.value
)

const fieldLabel = computed<string>(() =>
	__(props.field.label ?? props.field.fieldname)
)

const description = computed<string>(() =>
	props.field.description ? __(props.field.description) : ''
)

const doctypeOf = computed<string>(() =>
	typeof props.field.options === 'string' ? props.field.options : ''
)

const listValue = computed<string[]>(() =>
	Array.isArray(props.modelValue) ? props.modelValue : []
)

const selectOptions = computed<Option[]>(() => {
	const options = Array.isArray(props.field.options) ? props.field.options : []
	return options.map((value) => ({ label: __(value), value }))
})

// The same declared list, under the name the multiselect branch reads it by. A
// static multiselect and a Select offer identical candidates; only the number
// you may hold at once differs.
const staticOptions = computed<Option[]>(() => selectOptions.value)

// A declared default stands in for an absent value only where the backend does
// the same, on an optional field. A `reqd` field the rule does not carry
// matches nobody, so it reads empty and the row's validation has something to
// act on.
const selectValue = computed<string>(() => {
	if (typeof props.modelValue === 'string') return props.modelValue
	return props.field.reqd ? '' : props.field.default ?? ''
})

// The read-only face of the same field, so it says what the control would have
// said: a Select falls back to its declared default and reads in the user's
// language, exactly as the control's own summary does.
const readText = computed<string>(() => {
	if (isSelect.value) return selectValue.value ? __(selectValue.value) : ''
	// Translated one by one, not joined and translated: the list is a set of
	// declared options, each of which is its own message.
	if (isMultiStatic.value)
		return listValue.value.map((value) => __(value)).join(', ')
	const value = props.modelValue
	if (Array.isArray(value)) return value.join(', ')
	if (typeof value === 'string') return value
	return value === null || value === undefined ? '' : String(value)
})
</script>
