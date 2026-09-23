<template>
	<div
		class="flex w-full flex-col gap-2 rounded"
		:role="problem ? 'group' : undefined"
		:aria-labelledby="problem ? nameId : undefined"
		:aria-invalid="problem ? 'true' : undefined"
		:aria-describedby="problem ? problemMessageId : undefined"
	>
		<span :id="nameId" class="sr-only">{{ accessibleName }}</span>
		<span :id="typeWordId" class="sr-only">{{ __('Condition') }}</span>

		<div
			class="grid w-full grid-cols-1 items-start gap-2"
			:class="cellCount === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'"
			data-testid="condition-cells"
		>
			<div class="min-w-0" data-testid="condition-type">
				<Select
					v-if="!frozen"
					:model-value="rule.rule_type"
					:options="typeOptions"
					:placeholder="__('Condition')"
					:aria-labelledby="`${nameId} ${typeWordId}`"
					side="bottom"
					align="start"
					class="w-full"
					@update:model-value="setRuleType($event as string)"
				/>
				<p v-else class="pt-1 text-p-base text-ink-gray-7">{{ typeText }}</p>
			</div>

			<div
				v-for="field in slots.inline"
				:key="field.fieldname"
				class="min-w-0"
				data-testid="inline-field"
			>
				<span :id="wordId(field)" class="sr-only">{{ labelOf(field) }}</span>
				<RuleConditionField
					:field="field"
					:model-value="rule[field.fieldname]"
					:frozen="frozen"
					:aria-labelledby="`${nameId} ${wordId(field)}`"
					@update:model-value="setField(field, $event)"
				/>
			</div>
		</div>

		<div
			v-for="field in slots.blocks"
			:key="field.fieldname"
			class="flex w-full min-w-0 flex-wrap items-center gap-2"
			data-testid="block-field"
		>
			<span
				:id="wordId(field)"
				:class="
					frozen ? 'min-w-0 truncate text-p-base text-ink-gray-7' : 'sr-only'
				"
				>{{ labelOf(field) }}</span
			>
			<div class="min-w-0 flex-1 basis-56">
				<RuleConditionField
					:field="field"
					:model-value="rule[field.fieldname]"
					:frozen="frozen"
					:aria-labelledby="`${nameId} ${wordId(field)}`"
					@update:model-value="setField(field, $event)"
				/>
			</div>
		</div>

		<div
			v-if="foreign || paused"
			class="flex items-center gap-2"
			data-testid="row-status"
		>
			<Badge v-if="foreign" theme="gray" :label="managedByLabel" />
			<Badge v-if="paused" theme="orange" :label="__('Paused')" />
		</div>
	</div>
</template>

<script setup lang="ts">
// One condition row, rendered through ConditionBuilder's `#condition` slot. Our
// rule model is {provider, rule_type, config:{...}} rather than a
// [field, operator, value] triple, so providerSchema.conditionSlots bands the
// declared fields instead of mapping them onto three fixed cells: the rule-type
// picker and every fixed-width control share a grid, and every doctype-backed
// multiselect takes a row of its own. Those chips grow with the site's courses
// and batches, and a control that wide is unreadable in a cell sized for a
// Select.
//
// The grid is two equal tracks, or three when the whole cascade fits on one
// line. That is `cellCount` below, and it is what makes the five shapes this
// provider declares read as pairs rather than as a ragged wrap:
//
//   Student · All            [type][scope]
//   Student · Enrolled       [type][scope] / [payment][enrolled in] / batches / courses
//   Staff · All              [type][kind]
//   Staff · Platform role    [type][kind][roles]
//   Staff · Assigned on      [type][kind] / [as][on] / batches / courses
//
// Equal tracks rather than a wrapping flex line with widths of their own: the
// type picker used to take `flex-1` and grow to whatever was left, which pushed
// the first cascade answer onto a line of its own and made the two controls the
// user reads as a pair the two that looked least alike.
//
// One column below `sm`. A grid does not wrap the way the flex line it replaced
// did, so without this the pairing would hold at 360px too and put two controls
// in about 150px each.
//
// What this row deliberately does NOT render: the leading and/or cell and the
// overflow menu. The component owns both, so a second copy of either would
// appear beside the real one.
//
// Naming is the row's own job, because the component's per-row label is derived
// from a `fieldname` key our leaf does not have, and would come out empty. Every
// control is named by `aria-labelledby` against the row's name plus its cell word
// ("Enrolled in course, Value"): that is the one attribute frappe-ui's Select
// passes through, since it binds its own aria-invalid, aria-describedby and
// aria-errormessage after the caller's attrs and so overwrites all three. The
// cells whose control drops it too are wrapped in a named group instead. See
// below.
//
// The type cell is a Select, the same control every cascade answer beside it
// uses. It was a Combobox for its search box, which two options do not need, and
// that cost a wrapper: Combobox's button trigger binds only `inputAriaAttrs` and
// sends everything else to the popover's own search field, so the row's name had
// to go on a `role="group"` around it. Select takes `aria-labelledby` itself.
// The MultiLink cells still need that wrapper, for the same reason Combobox did.
//
// A row that cannot be saved is therefore not narrated here at all: the wording
// lives in the section message, under the builder. This row carries no visual
// mark of its own, but still becomes a named group holding aria-invalid and a
// reference to that section message, since the controls will not carry either.
//
// A frozen row, another app's or one in a read-only builder, renders as text
// rather than as disabled controls. A disabled control is skipped in a screen
// reader's forms mode and is exempt from the contrast minimum, so the state
// where the user most needs to read the rule is the state where it would be
// least readable.
//
// There is no third cell where the type declares nothing to put in one: the
// condition type is then the whole condition, and an empty cell after it is a
// cell the reader has to rule out.
//
// The value cell takes a whole row of its own rather than a flex basis that
// lets it share line 1 while it is narrow. Its width is the width of whatever
// the user has selected, so a basis makes the row rewrap under the pointer the
// moment they select anything. The cell moved line as its own summary grew.
//
// The row's root carries no padding: ConditionBuilder anchors the and/or of the
// row to its top edge, so any padding here shows up as the conjunction floating
// above the controls it joins.
import { Badge, Select } from 'frappe-ui'
import { computed, useId } from 'vue'
import RuleConditionField from './RuleConditionField.vue'
import {
	conditionSlots,
	defaultsOf,
	fieldsOf,
	isForeignRule,
	ruleTypesOf,
	useProviderDeclarations,
	useRuleTypeChoices,
	withoutHiddenFields,
} from '@/composables/raven/providerSchema'
import type { RuleProblem } from '@/composables/raven/useChannelRules'
import { LMS_PROVIDER } from '@/utils/raven/ruleAdapter'
import type {
	ProviderRuleType,
	RavenMemberRule,
	RuleField,
	RuleFieldValue,
} from '@/types'

interface Option {
	label: string
	value: string
}

const props = defineProps<{
	rule: RavenMemberRule
	/** Id of this row's name, owned by the host so its actions button shares it. */
	nameId: string
	/** Set when this is the row the section's warning is about. Marks it; the text
	 *  is not repeated here. */
	problem?: RuleProblem
	/** Id of the section's one warning, so a marked row can point at it. */
	problemMessageId?: string
	/** The builder's own read-only, handed down through the `#condition` slot. */
	readonly?: boolean
}>()

const emit = defineEmits<{ update: [rule: RavenMemberRule] }>()

const uid = useId()
const typeWordId = `${uid}-type`

const choices = useRuleTypeChoices()

const declarations = useProviderDeclarations()

// A rule renders in its own provider's vocabulary, so a foreign rule reads as
// what it is instead of being mistranslated into LMS terms.
const ruleTypes = computed<ProviderRuleType[]>(() =>
	ruleTypesOf(declarations.data, props.rule.provider ?? LMS_PROVIDER)
)

const foreign = computed<boolean>(() => isForeignRule(props.rule))

// A foreign rule is frozen for good: its own app is where it is edited. A
// read-only builder freezes every row for the same reason it freezes its own:
// the tree can be read but not written. Only the first is a *status*, so only
// it badges the row.
const frozen = computed<boolean>(() => foreign.value || !!props.readonly)

const managedByLabel = computed<string>(() =>
	__('Managed by {0}', [props.rule.provider ?? ''])
)

// Stored as Paused, which raven_integration's engine reads as "skip this rule".
// This screen has no control that turns it back on, so the state is said rather
// than normalised away. See emitEdited.
const paused = computed<boolean>(() => props.rule.status === 'Paused')

// One flat list across every provider: choosing a condition is also what decides
// which provider will evaluate the rule.
const typeOptions = computed<Option[]>(() =>
	choices.value.map((choice) => ({
		label:
			choices.value.some((c) => c.provider !== choice.provider) &&
			choice.providerLabel
				? `${__(choice.label)} · ${choice.providerLabel}`
				: __(choice.label),
		value: choice.type,
	}))
)

const slots = computed(() =>
	conditionSlots(ruleTypes.value, props.rule.rule_type, props.rule)
)

// The type picker plus the cascade answers beside it. Three of them fit a line;
// more than that pairs up, so a four-cell cascade reads as two rows of two
// rather than three and an orphan.
const cellCount = computed<number>(() => slots.value.inline.length + 1)

function labelOf(field: RuleField): string {
	return __(field.label ?? field.fieldname)
}

// Per field, not per slot. The row used to have three fixed cells with three
// fixed words; a cascade has as many controls as it has levels, and each still
// needs its own accessible name.
function wordId(field: RuleField): string {
	return `${uid}-field-${field.fieldname}`
}

const typeText = computed<string>(
	() =>
		choices.value.find((c) => c.type === props.rule.rule_type)?.label ??
		props.rule.rule_type ??
		''
)

/**
 * What a row is called in a list of eight: its type, plus its status where it has
 * one. Read-only is not a status. It says nothing about this row that is not
 * already true of every other, so it is left out here as it is left out of the
 * badge.
 */
const accessibleName = computed<string>(() => {
	const parts = [typeText.value]
	if (foreign.value) parts.push(managedByLabel.value)
	if (paused.value) parts.push(__('Paused'))
	return parts.join(', ')
})

// The one way out of this row. Every edit, the type and the operator and the
// value and any extra field, is emitted through here.
//
// Whole-object emit, because a nested write into `rule` does not reach the tree
// the builder holds, so the edit would vanish on the next render.
//
// The status is carried, never rewritten. This used to stamp every edit
// `Active` on the grounds that the LMS no longer offers a pause control, but
// `status === 'Paused'` is what raven_integration's engine reads to skip a rule
// (engine.py), so that turned any unrelated edit into a membership change:
// renaming the channel, or touching a different row, added everyone the paused
// rule matches. An addition never reaches the removal confirmation, which only
// asks on a removal or an uncomputable diff, so nothing said so. The row badges
// the state instead, and a rule the user never opened still round-trips
// verbatim. A missing status defaults to Active in `_serialize_rule_for_ui`.
function emitEdited(rule: RavenMemberRule): void {
	emit('update', { ...rule })
}

// Through withoutHiddenFields, because this is the edit that can hide another
// field: setting `staff_role` away from Instructor drops the course and batch
// scopes with it. Leaving them behind stored a scope the row no longer shows,
// and switching back reinstated it without the user re-entering it.
function setField(field: RuleField | null, value: RuleFieldValue): void {
	if (!field) return
	emitEdited(
		withoutHiddenFields(ruleTypes.value, {
			...props.rule,
			[field.fieldname]: value,
		})
	)
}

// Retyping keeps only what the new type also declares: a leftover key would
// still be sent as config, describing a rule the new type never asked for.
//
// "What the new type declares" is read off the provider that declares *it*, not
// off the row's current one. The picker lists every provider's types, so a retype
// crosses providers; looking the new type up in the old declaration found nothing,
// so the row arrived with no defaults seeded and nothing carried over.
function setRuleType(ruleType: string): void {
	const choice = choices.value.find((c) => c.type === ruleType)
	const provider = choice?.provider ?? props.rule.provider ?? LMS_PROVIDER
	const declared = ruleTypesOf(declarations.data, provider)
	const next: RavenMemberRule = {
		label: props.rule.label,
		provider,
		rule_type: ruleType,
		// Carried: retyping a row is not a decision to switch it back on.
		status: props.rule.status,
		matches: props.rule.matches,
		...defaultsOf(declared, ruleType),
	}
	for (const field of fieldsOf(declared, ruleType)) {
		const carried = props.rule[field.fieldname]
		if (carried !== undefined) next[field.fieldname] = carried
	}
	emitEdited(next)
}
</script>
