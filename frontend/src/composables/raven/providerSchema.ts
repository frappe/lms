import { createResource } from 'frappe-ui'
import { computed, type ComputedRef } from 'vue'
import { LMS_PROVIDER } from '@/utils/raven/ruleAdapter'
import type {
	ProviderDeclaration,
	ProviderRuleType,
	RavenMemberRule,
	RuleField,
	RuleFieldValue,
} from '@/types'

/**
 * The declaration fetch itself, for callers that must tell "not loaded yet" from
 * "declares nothing". The declaration is static for the session and every rule card
 * wants it, so the shared `cache` key hands them all one instance.
 */
export function useProviderDeclarations() {
	return createResource<ProviderDeclaration[]>({
		url: 'raven_integration.api.list_providers',
		cache: 'raven-membership-providers',
		auto: true,
	})
}

/** The rule types a provider declares. Empty while the fetch is in flight or failed. */
export function useProviderRuleTypes(
	provider: () => string
): ComputedRef<ProviderRuleType[]> {
	const providers = useProviderDeclarations()
	return computed(() => {
		const declared = providers.data ?? []
		return declared.find((p) => p.name === provider())?.rule_types ?? []
	})
}

/** The fields a rule type declares, or none when the provider does not declare it. */
export function fieldsOf(
	ruleTypes: readonly ProviderRuleType[],
	ruleType: string
): RuleField[] {
	return ruleTypes.find((rt) => rt.type === ruleType)?.fields ?? []
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
	return fieldsOf(ruleTypes, rule.rule_type).every(
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
