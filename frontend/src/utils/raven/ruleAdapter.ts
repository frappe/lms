import type { ApiRule, RavenMemberRule, RuleFieldValue } from '@/types'

/** This app's provider name. A rule from any other provider is read-only here. */
export const LMS_PROVIDER = 'LMS'

// The keys every provider's rule carries on the wire. Anything else on a flat rule is
// one of the fields that provider's declaration named, and belongs inside `config`.
const WIRE_KEYS: readonly string[] = [
	'name',
	'label',
	'provider',
	'rule_type',
	'status',
	'matches',
]

function isWireKey(key: string): boolean {
	return WIRE_KEYS.includes(key)
}

/** Flatten a backend rule ({provider, rule_type, config:{…}}) into the flat UI shape. */
export function fromApiRule(r: ApiRule): RavenMemberRule {
	const rule: RavenMemberRule = {
		name: r.name,
		label: r.label,
		provider: r.provider,
		rule_type: r.rule_type,
		status: r.status,
		matches: r.matches,
	}
	// Config keys are copied through, not filtered against an LMS list: a rule this
	// UI does not own must survive the round-trip byte-for-byte.
	for (const [key, value] of Object.entries(r.config ?? {})) {
		if (!isWireKey(key)) rule[key] = value as RuleFieldValue
	}
	return rule
}

/** Nest the flat rule's provider fields back into the generic {provider, config} shape. */
export function toApiRule(r: RavenMemberRule): ApiRule {
	const config: Record<string, unknown> = {}
	for (const [key, value] of Object.entries(r)) {
		if (!isWireKey(key) && value !== undefined) config[key] = value
	}
	return {
		name: r.name,
		label: r.label,
		provider: r.provider ?? LMS_PROVIDER,
		rule_type: r.rule_type,
		status: r.status,
		config,
	}
}

/**
 * Identity of a rule's *membership effect* — everything but the cosmetic `label`/
 * `name`, so callers can tell a rename apart from a change that moves people.
 */
export function membershipSignature(rules: readonly RavenMemberRule[]): string {
	return JSON.stringify(
		rules.map((r) => {
			const { provider, rule_type, status, config } = toApiRule(r)
			// Canonicalize config like ruleIdentity does, so key order never
			// spuriously changes the signature and forces an avoidable diff.
			return { provider, rule_type, status, config: canonicalJson(config) }
		}),
	)
}

/** JSON.stringify with object keys sorted, so key order never affects equality. */
function canonicalJson(value: unknown): string {
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		const obj = value as Record<string, unknown>
		const sorted: Record<string, unknown> = {}
		for (const key of Object.keys(obj).sort()) sorted[key] = obj[key]
		return JSON.stringify(sorted)
	}
	return JSON.stringify(value)
}

/**
 * Mirrors `engine.validate_unique_member_rules`: provider + rule_type + config, key
 * order aside. `status` is excluded there too — a Paused rule collides with Active.
 */
export function ruleIdentity(r: RavenMemberRule): string {
	const { provider, rule_type, config } = toApiRule(r)
	return JSON.stringify([provider, rule_type, canonicalJson(config)])
}
