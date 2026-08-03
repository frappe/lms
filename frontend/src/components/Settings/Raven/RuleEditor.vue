<template>
	<div class="flex flex-col space-y-1">
		<div class="flex items-center justify-between gap-4 py-2 px-2">
			<div class="flex flex-col">
				<div class="text-p-base font-medium text-ink-gray-7 truncate">
					{{ __('Rule type') }}
				</div>
			</div>
			<div class="w-72">
				<Combobox
					:model-value="rule.rule_type"
					@update:model-value="setRuleType($event as string)"
					:options="ruleTypeOptions"
					:placeholder="__('Rule type')"
					:aria-label="__('Rule type')"
					:disabled="disabled"
					class="w-full"
				/>
			</div>
		</div>

		<!-- One row per declared field: which fields a rule type has, and when they
			 apply, is the provider's statement, not this component's. -->
		<div
			v-for="field in fields"
			:key="field.fieldname"
			class="flex items-center justify-between gap-4 py-2 px-2"
		>
			<div class="flex flex-col">
				<div class="text-p-base font-medium text-ink-gray-7 truncate">
					{{ labelOf(field) }}
				</div>
				<div v-if="field.description" class="text-p-sm text-ink-gray-5">
					{{ __(field.description) }}
				</div>
			</div>
			<div class="w-72">
				<Combobox
					v-if="field.fieldtype === 'Select'"
					:model-value="selectValue(field)"
					@update:model-value="setField(field, $event as string)"
					:options="selectOptions(field)"
					:placeholder="labelOf(field)"
					:aria-label="labelOf(field)"
					:disabled="disabled"
					class="w-full"
				/>
				<MultiLink
					v-else-if="field.fieldtype === 'MultiSelect'"
					:model-value="listValue(field)"
					@update:model-value="setField(field, $event)"
					:doctype="doctypeOf(field)"
					:placeholder="labelOf(field)"
					:aria-label="labelOf(field)"
					:disabled="disabled"
					class="w-full"
				/>
				<!-- A fieldtype this UI cannot render is shown as an inert row: dropping
					 it would hide part of the rule the backend still evaluates. -->
				<TextInput
					v-else
					disabled
					model-value=""
					:placeholder="unsupportedText(field)"
					:aria-label="labelOf(field)"
					data-testid="unsupported-field"
					class="w-full"
				/>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { Combobox, TextInput } from 'frappe-ui'
import { computed } from 'vue'
import MultiLink from '@/components/Controls/MultiLink.vue'
import {
	defaultsOf,
	fieldsOf,
	useProviderRuleTypes,
} from '@/composables/raven/providerSchema'
import { LMS_PROVIDER } from '@/utils/raven/ruleAdapter'
import type { RavenMemberRule, RuleField, RuleFieldValue } from '@/types'

interface SelectOption {
	label: string
	value: string
}

const props = withDefaults(
	defineProps<{ modelValue: RavenMemberRule; disabled?: boolean }>(),
	{ disabled: false }
)
const emit = defineEmits<{ 'update:modelValue': [RavenMemberRule] }>()

const rule = computed({
	get: (): RavenMemberRule => props.modelValue,
	set: (v: RavenMemberRule) => emit('update:modelValue', v),
})

// A rule is rendered from its own provider's declaration; a foreign rule is shown
// in its own vocabulary (read-only, the panel disables it) rather than in LMS terms.
const ruleTypes = useProviderRuleTypes(
	() => rule.value.provider ?? LMS_PROVIDER
)

const ruleTypeOptions = computed((): SelectOption[] =>
	ruleTypes.value.map((rt) => ({
		label: __(rt.label ?? rt.type),
		value: rt.type,
	}))
)

const fields = computed((): RuleField[] =>
	fieldsOf(ruleTypes.value, rule.value.rule_type)
)

function labelOf(field: RuleField): string {
	return __(field.label ?? field.fieldname)
}

function unsupportedText(field: RuleField): string {
	return `${__('Unsupported field type')}: ${field.fieldtype}`
}

function selectOptions(field: RuleField): SelectOption[] {
	const options = Array.isArray(field.options) ? field.options : []
	return options.map((value) => ({ label: __(value), value }))
}

function doctypeOf(field: RuleField): string {
	return typeof field.options === 'string' ? field.options : ''
}

// A declared default stands in for an absent value only where the backend does the
// same, on an optional field. A `reqd` field the rule does not carry matches nobody,
// so it reads empty rather than complete, and the panel's warning has something to act on.
function selectValue(field: RuleField): string {
	const value = rule.value[field.fieldname]
	if (typeof value === 'string') return value
	return field.reqd ? '' : field.default ?? ''
}

function listValue(field: RuleField): string[] {
	const value = rule.value[field.fieldname]
	return Array.isArray(value) ? value : []
}

function setField(field: RuleField, value: RuleFieldValue): void {
	rule.value = { ...rule.value, [field.fieldname]: value }
}

// Retyping keeps only what the new type also declares: a leftover key would still be
// sent as config, and still count towards the backend's duplicate check.
function setRuleType(ruleType: string): void {
	const next: RavenMemberRule = {
		name: rule.value.name,
		label: rule.value.label,
		provider: rule.value.provider,
		rule_type: ruleType,
		status: rule.value.status,
		matches: rule.value.matches,
		...defaultsOf(ruleTypes.value, ruleType),
	}
	for (const field of fieldsOf(ruleTypes.value, ruleType)) {
		const carried = rule.value[field.fieldname]
		if (carried !== undefined) next[field.fieldname] = carried
	}
	rule.value = next
}
</script>
