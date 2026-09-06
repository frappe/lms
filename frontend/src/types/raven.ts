// Wire format of the raven_integration API, plus the rule shapes the settings UI
// works in. Provider-agnostic only. A provider's own rule vocabulary stays in its
// app and crosses as `RavenMemberRule.rule_type: string`, described at runtime by
// the provider declaration (`raven_integration.api.list_providers`).
//
// The `RuleCombinator` union below has a runtime counterpart, `RULE_COMBINATORS`
// in `@/utils/raven/constants`; this module stays free of runtime values so the
// `@/types` barrel pulls no code into its importers' chunks.

/** What a group joins its children with. One per gap between two conditions. */
export type Conjunction = 'and' | 'or'
export type WorkspaceVisibility = 'Public' | 'Private'
export type ChannelVisibility = 'Public' | 'Private' | 'Open'
export type RuleStatus = 'Active' | 'Paused'

export interface RavenWorkspace {
	/** Mapping docname; null on an unmanaged Raven workspace with no mapping yet. */
	name: string | null
	/** False when this is a raw Raven workspace not yet adopted into a mapping. */
	mapped: boolean
	workspace_label: string
	workspace_type: WorkspaceVisibility
	/** Always present: the Raven workspace id, mapped or not; the adopt target. */
	raven_workspace: string
	/** The linked Raven workspace no longer exists; the mapping has stopped syncing. */
	stale: 0 | 1
	/** Channel mappings under this workspace; null when nothing is managed yet. */
	channel_count?: number | null
}

export interface RavenChannel {
	/** Mapping docname; null on an unmanaged Raven channel with no mapping yet. */
	name: string | null
	/** False when this is a raw Raven channel not yet adopted into a mapping. */
	mapped: boolean
	channel_label: string
	workspace: string
	channel_type: ChannelVisibility
	/** Always present: the Raven channel id, mapped or not; the adopt target. */
	raven_channel: string
	enabled: 0 | 1
	/** The linked Raven channel no longer exists; the mapping has stopped syncing. */
	stale: 0 | 1
}

export interface WorkspaceDetail extends RavenWorkspace {
	/** Derived: how many people are in at least one of the workspace's channels. */
	member_count: number
	channels_active: number
	channels_paused: number
	creation: string
}

/**
 * One row of `raven_integration.api.list_workspace_members`. Read-only by
 * construction, membership is a consequence of `channels`, not a stored fact.
 */
export interface WorkspaceMember {
	user: string
	full_name: string
	/** The User's avatar; null when they never set one. */
	user_image: string | null
	/** The channels that put this person in the workspace; never empty. */
	channels: string[]
	/** At least one of those channel memberships was created by a rule. */
	added_by_rule: boolean
}

export interface ChannelDetail extends RavenChannel {
	member_count: number
	/**
	 * The count above could not be worked out, no provider could evaluate the
	 * channel's tree, so it reads 0 rather than a real total. Kept an int with a
	 * flag beside it so a consumer that ignores this still gets a number.
	 */
	member_count_unknown: boolean
	/** The channel's condition tree, exactly as ConditionBuilder models one. */
	rules: ApiRuleGroup
}

/**
 * A group of conditions as raven_integration stores one: joined by `conjunctions`,
 * one joiner per gap, `conditions.length - 1` of them. A child is a rule or another
 * group; the two are told apart structurally, with no discriminator field to keep in
 * sync, which is what lets the tree survive a JSON round-trip untouched.
 */
export interface ApiRuleGroup {
	conjunctions: Conjunction[]
	conditions: ApiRuleNode[]
}

export type ApiRuleNode = ApiRule | ApiRuleGroup

/**
 * The same tree as the editor holds one: every leaf flattened into the shape the
 * rule row edits, and one `conjunction` for the whole group rather than one per
 * gap. That is ConditionBuilder's model, a level is all-and or all-or, and mixing
 * is spelled by nesting, so this is the shape the component reads and writes.
 * `ruleAdapter` collapses and re-expands the wire's array at the boundary.
 */
export interface RuleGroup {
	conjunction: Conjunction
	conditions: RuleNode[]
	/**
	 * The per-gap joiners this group was loaded with, carried so a group the user
	 * never touched can be written back exactly as it was stored. A tree authored
	 * outside this UI can mix `and` with `or` at one level, which the single
	 * `conjunction` above cannot say; without this, re-expanding that one token
	 * across every gap rewrote the stored tree on any save at all, a rename
	 * included. Absent on a group this editor made, there is nothing to preserve.
	 */
	storedConjunctions?: Conjunction[]
}

export type RuleNode = RavenMemberRule | RuleGroup

/** Child indices from the root of a tree. `[]` addresses the root itself. */
export type RulePath = number[]

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
	/**
	 * No provider could evaluate the proposed tree, so the counts above are zero
	 * because nothing could be worked out, not because nobody moves. A channel
	 * that is switched off, stale, or has no active rule reports zeros with this
	 * false: those genuinely move nobody.
	 */
	unknown: boolean
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
	/**
	 * Renders this field only while `field` holds one of the named values.
	 *
	 * `value` names one, a provider uses it when a single choice of a Select is
	 * the only one the field applies to. `value_in` names a set, which is what a
	 * cascade needs: a scope of "Both" applies to the same two multiselects that
	 * "Batches" and "Courses" apply to one of each, and saying that with
	 * equalities alone would mean declaring each multiselect twice under two
	 * fieldnames.
	 */
	depends_on?:
		| { field: string; value: string }
		| { field: string; value_in: string[] }
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
