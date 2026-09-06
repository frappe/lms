import { createResource } from 'frappe-ui'
import { computed, type ComputedRef } from 'vue'
import { LMS_PROVIDER, isWireKey } from '@/utils/raven/ruleAdapter'
import type {
	ProviderDeclaration,
	ProviderRuleType,
	RavenMemberRule,
	RuleField,
	RuleFieldValue,
} from '@/types'

/** The declaration fetch itself, shared through `cache` so every rule card reads one instance. */
export function useProviderDeclarations() {
	return createResource<ProviderDeclaration[]>({
		url: 'raven_integration.api.list_providers',
		cache: 'raven-membership-providers',
		auto: true,
	})
}

/** The rule types one provider declares. Pure: retyping a rule needs the provider it moves to. */
export function ruleTypesOf(
	declarations: readonly ProviderDeclaration[] | null | undefined,
	provider: string
): ProviderRuleType[] {
	return (declarations ?? []).find((p) => p.name === provider)?.rule_types ?? []
}

/** The rule types a provider declares. Empty while the fetch is in flight or failed. */
export function useProviderRuleTypes(
	provider: () => string
): ComputedRef<ProviderRuleType[]> {
	const providers = useProviderDeclarations()
	return computed(() => ruleTypesOf(providers.data, provider()))
}

/** One entry of the condition row's Field select: a rule type, and who declares it. */
export interface RuleTypeChoice {
	provider: string
	providerLabel: string
	type: string
	label: string
}

/** Every rule type on offer, flat across providers: picking one decides who evaluates the rule. */
export function useRuleTypeChoices(): ComputedRef<RuleTypeChoice[]> {
	const providers = useProviderDeclarations()
	return computed(() =>
		(providers.data ?? []).flatMap((p) =>
			(p.rule_types ?? []).map((rt) => ({
				provider: p.name,
				providerLabel: p.label ?? p.name,
				type: rt.type,
				label: rt.label ?? rt.type,
			}))
		)
	)
}

/** The fields a rule type declares, or none when the provider does not declare it. */
export function fieldsOf(
	ruleTypes: readonly ProviderRuleType[],
	ruleType: string
): RuleField[] {
	return ruleTypes.find((rt) => rt.type === ruleType)?.fields ?? []
}

/**
 * The declared fields whose `depends_on` is satisfied, in declaration order.
 * Hidden means hidden everywhere: not rendered, not judged for `reqd`, not
 * written. A control the user cannot see must never be what stops a save.
 */
export function visibleFieldsOf(
	ruleTypes: readonly ProviderRuleType[],
	rule: RavenMemberRule
): RuleField[] {
	const fields = fieldsOf(ruleTypes, rule.rule_type)
	// What the control shows, not what the rule stores, so a row already reading
	// "Instructor" shows its scope without the user re-picking the value. Matched
	// to RuleConditionField exactly, `reqd` included: that control shows a `reqd`
	// field empty rather than defaulted, and a cascade hanging off a value nobody
	// can see selected is the one thing worse than an extra click.
	const shown = (fieldname: string): RuleFieldValue | undefined => {
		if (rule[fieldname] !== undefined) return rule[fieldname]
		const declared = fields.find((f) => f.fieldname === fieldname)
		return declared?.reqd ? undefined : declared?.default
	}

	return fields.filter((field) => {
		const dep = field.depends_on
		if (!dep) return true
		const current = shown(dep.field)
		// `value_in` is the set form, for a cascade where one control below applies
		// to several answers above. Mirrors `_dep_satisfied` in the registry, which
		// judges the same declaration on the way in.
		return 'value_in' in dep
			? dep.value_in.includes(current as string)
			: current === dep.value
	})
}

/**
 * The rule with every declared-but-hidden field dropped, so what is stored is
 * what the row showed: a key nobody can see is a key nobody can correct, and
 * switching a Select back would reinstate a scope the user never re-entered.
 * Only declared fields are candidates; another provider's keys are not ours.
 */
export function withoutHiddenFields(
	ruleTypes: readonly ProviderRuleType[],
	rule: RavenMemberRule
): RavenMemberRule {
	// To a fixed point, because dropping a field can hide the one that depended on
	// it. A single pass judged every field against the pre-edit rule, so setting
	// staff_kind to All kept staff_scope_courses: assigned_scope still read
	// "Courses" while it was being deleted in the same sweep.
	let out: RavenMemberRule = { ...rule }
	for (;;) {
		const visible = new Set(
			visibleFieldsOf(ruleTypes, out).map((field) => field.fieldname)
		)
		const hidden = fieldsOf(ruleTypes, out.rule_type).filter(
			(field) =>
				!visible.has(field.fieldname) && out[field.fieldname] !== undefined
		)
		if (!hidden.length) return out
		for (const field of hidden) delete out[field.fieldname]
	}
}

/**
 * True when the rule carries a config key its type does not declare, which is
 * what a rule written against an older vocabulary looks like. Checked as well as
 * the type name, because `staff_role` rules still name the declared type
 * "Staff": on the name alone they read as merely unfinished, and the screen
 * invites the user to complete one into a rule naming different people.
 */
export function hasUndeclaredFields(
	ruleTypes: readonly ProviderRuleType[],
	rule: RavenMemberRule
): boolean {
	const declared = new Set(
		fieldsOf(ruleTypes, rule.rule_type).map((field) => field.fieldname)
	)
	return Object.keys(rule).some(
		(key) => !isWireKey(key) && !declared.has(key) && rule[key] !== undefined
	)
}

/** Whether the declaration covers this rule type at all; false while it is unloaded. */
export function isDeclaredRuleType(
	ruleTypes: readonly ProviderRuleType[],
	ruleType: string
): boolean {
	return ruleTypes.some((rt) => rt.type === ruleType)
}

function isFilled(value: RuleFieldValue | undefined): boolean {
	if (Array.isArray(value)) return value.length > 0
	if (typeof value === 'string') return value.trim() !== ''
	return value !== null && value !== undefined
}

/**
 * True once every field the rule type declares `reqd` carries a value. An undeclared
 * rule type (including every type while the declaration is unloaded) is never
 * complete: `[].every()` would otherwise pass a rule nothing has validated.
 */
export function hasRequiredFields(
	ruleTypes: readonly ProviderRuleType[],
	rule: RavenMemberRule
): boolean {
	if (!isDeclaredRuleType(ruleTypes, rule.rule_type)) return false
	return visibleFieldsOf(ruleTypes, rule).every(
		(field) => !field.reqd || isFilled(rule[field.fieldname])
	)
}

/** Declared defaults for a rule type, seeded when a rule is created or retyped. */
export function defaultsOf(
	ruleTypes: readonly ProviderRuleType[],
	ruleType: string
): Record<string, string> {
	const defaults: Record<string, string> = {}
	for (const field of fieldsOf(ruleTypes, ruleType)) {
		if (field.default !== undefined) defaults[field.fieldname] = field.default
	}
	return defaults
}

/** A rule another app owns: this UI does not know its vocabulary, so it may not edit it. */
export function isForeignRule(rule: RavenMemberRule): boolean {
	return !!rule.provider && rule.provider !== LMS_PROVIDER
}

/** Fieldtypes whose control gets a row to itself. */
const BLOCK_FIELDTYPES = ['MultiSelect', 'MultiSelectStatic']

/**
 * A rule type's visible fields, split into the two bands a condition row draws.
 * Replaced a fixed `Field · Operator · Value` triple: a cascade declares as many
 * selects as it has levels, and the third onwards read as leftovers under the row.
 */
export interface ConditionSlots {
	/** Selects, on one wrapping line: in a cascade each narrows the next. */
	inline: RuleField[]
	/**
	 * Multiselects, one row each. Their chips grow with the selection, so a
	 * control that reflows as you pick is unreadable beside fixed-width ones.
	 */
	blocks: RuleField[]
}

export function conditionSlots(
	ruleTypes: readonly ProviderRuleType[],
	ruleType: string,
	rule?: RavenMemberRule
): ConditionSlots {
	// With no rule, every declared field: the type picker asks what a rule type
	// looks like before one exists to read a cascade off.
	const fields = rule
		? visibleFieldsOf(ruleTypes, rule)
		: fieldsOf(ruleTypes, ruleType)
	return {
		inline: fields.filter((f) => !BLOCK_FIELDTYPES.includes(f.fieldtype)),
		blocks: fields.filter((f) => BLOCK_FIELDTYPES.includes(f.fieldtype)),
	}
}

/**
 * A name for a rule, derived from what the row says: the backend requires a label
 * and the row has no name box. Not unique, and does not need to be: the backend
 * dedupes on provider + rule_type + config.
 */
export function autoRuleLabel(
	ruleTypes: readonly ProviderRuleType[],
	rule: RavenMemberRule
): string {
	const declared = ruleTypes.find((rt) => rt.type === rule.rule_type)
	const base = declared?.label ?? rule.rule_type
	// The first inline field, which in a cascade is the one that decides
	// everything below it, the most useful single word to name a row by.
	const [first] = conditionSlots(ruleTypes, rule.rule_type).inline
	const qualifier = first ? rule[first.fieldname] : undefined
	return typeof qualifier === 'string' && qualifier.trim()
		? `${base} · ${qualifier}`
		: base
}
