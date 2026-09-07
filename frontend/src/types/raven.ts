// Wire format of the raven_integration API, plus the rule shapes the settings UI
// works in. Provider-agnostic only. A provider's own rule vocabulary stays in its
// app and crosses as `RavenMemberRule.rule_type: string`, described at runtime by
// the provider declaration (`raven_integration.api.list_providers`).
//
// The `RuleCombinator` union below has a runtime counterpart, `RULE_COMBINATORS`
// in `@/utils/raven/constants`; this module stays free of runtime values so the
// `@/types` barrel pulls no code into its importers' chunks.

export type RuleCombinator = 'Any (OR)' | 'All (AND)'
export type RuleStatus = 'Active' | 'Paused'

export interface RavenWorkspace {
	/** Mapping docname; null on an unmanaged Raven workspace with no mapping yet. */
	name: string | null
	/** False when this is a raw Raven workspace not yet adopted into a mapping. */
	mapped: boolean
	workspace_label: string
	workspace_type: 'Public' | 'Private'
	rule_combinator: RuleCombinator | null
	/** Always present: the Raven workspace id, mapped or not; the adopt target. */
	raven_workspace: string
	enabled: 0 | 1
	/** The linked Raven workspace no longer exists; the mapping has stopped syncing. */
	stale: 0 | 1
}

export interface RavenChannel {
	/** Mapping docname; null on an unmanaged Raven channel with no mapping yet. */
	name: string | null
	/** False when this is a raw Raven channel not yet adopted into a mapping. */
	mapped: boolean
	channel_label: string
	workspace: string
	channel_type: 'Public' | 'Private' | 'Open'
	rule_combinator: RuleCombinator | null
	/** Always present: the Raven channel id, mapped or not; the adopt target. */
	raven_channel: string
	enabled: 0 | 1
	/** The linked Raven channel no longer exists; the mapping has stopped syncing. */
	stale: 0 | 1
}

export interface WorkspaceDetail extends RavenWorkspace {
	member_count: number
	member_rules: ApiRule[]
}

export interface ChannelDetail extends RavenChannel {
	member_count: number
	member_rules: ApiRule[]
}

/** Generic membership rule as the raven_integration API sends/accepts it on the wire. */
export interface ApiRule {
	name?: string
	label?: string
	provider: string
	rule_type: string
	status: RuleStatus
	config: Record<string, unknown>
	matches?: string
}

/** `raven_integration.api.is_setup` response. */
export interface RavenSetupState {
	raven: boolean
	raven_integration: boolean
	enabled: boolean
}

/** `raven_integration.api.compute_rule_diff` response. */
export interface RuleDiff {
	added: number
	removed: number
	removed_users: string[]
}

/** Every value a provider-declared field can hold. */
export type RuleFieldValue = string | string[] | number | null

/** One `fields[]` entry of a declared rule type. */
export interface RuleField {
	fieldname: string
	fieldtype: string
	/** On-screen wording; falls back to the fieldname when the provider omits it. */
	label?: string
	description?: string
	/** A literal option list for `Select`; a doctype name for `MultiSelect`. */
	options?: string | string[]
	reqd?: 0 | 1
	default?: string
}

export interface ProviderRuleType {
	type: string
	label?: string
	fields?: RuleField[]
}

/** One entry of the `raven_integration.api.list_providers` response. */
export interface ProviderDeclaration {
	name: string
	label?: string
	rule_types?: ProviderRuleType[]
}

export interface RavenMemberRule {
	name?: string
	label?: string
	/** Owning provider; absent on a rule this UI just created (defaults to LMS). */
	provider?: string
	rule_type: string
	status: RuleStatus
	/** Read-only human description from the backend (rules table "Matches" column). */
	matches?: string
	/** The provider's declared fields, flat; nested back under `config` on the wire. */
	[field: string]: RuleFieldValue | undefined
}
