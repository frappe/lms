import type {
	ApiRule,
	ApiRuleGroup,
	ApiRuleNode,
	Conjunction,
	RavenMemberRule,
	RuleFieldValue,
	RuleGroup,
	RuleNode,
	RulePath,
} from '@/types'

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

/** True for a key every provider's rule carries, as opposed to one of its own fields. */
export function isWireKey(key: string): boolean {
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

/** True if this node is a group rather than a rule: it is the one with children. */
export function isRuleGroup(node: RuleNode): node is RuleGroup {
	return (
		typeof node === 'object' &&
		node !== null &&
		'conditions' in node &&
		'conjunction' in node
	)
}

/** The same test for a tree that is still in the wire's shape. */
function isApiRuleGroup(node: ApiRuleNode): node is ApiRuleGroup {
	return (
		typeof node === 'object' &&
		node !== null &&
		'conditions' in node &&
		'conjunctions' in node
	)
}

/** An empty tree. `and` is the joiner a group with nothing to join still has. */
export function emptyRuleTree(): RuleGroup {
	return { conjunction: 'and', conditions: [] }
}

/**
 * Flatten a stored tree into the shape the rule row edits, collapsing the wire's
 * per-gap joiners into the one this editor holds. The rest are carried on
 * `storedConjunctions` rather than dropped, so loading a mixed tree written
 * elsewhere does not rewrite it on the next save.
 */
export function fromApiTree(tree: ApiRuleGroup | null | undefined): RuleGroup {
	if (!tree || !isApiRuleGroup(tree)) return emptyRuleTree()
	const conjunctions = tree.conjunctions ?? []
	return {
		conjunction: conjunctions[0] ?? 'and',
		storedConjunctions: conjunctions,
		conditions: (tree.conditions ?? []).map((node) =>
			isApiRuleGroup(node) ? fromApiTree(node) : fromApiRule(node)
		),
	}
}

/**
 * Drop the stored joiners of every group whose control has been moved. One-way,
 * because `heldStoredJoiners` reads "the user acted" off a comparison a round
 * trip undoes: flip a mixed group to `or`, flip it back, and the mixed pair
 * would be written under a control that now says one thing.
 */
export function forgetMovedJoiners(tree: RuleGroup): void {
	const stored = tree.storedConjunctions
	if (stored && stored.length > 0 && stored[0] !== tree.conjunction)
		delete tree.storedConjunctions
	for (const node of tree.conditions)
		if (isRuleGroup(node)) forgetMovedJoiners(node)
}

/** The stored joiners while they still describe this group: one per gap, first still shown. */
function heldStoredJoiners(tree: RuleGroup): Conjunction[] | null {
	const stored = tree.storedConjunctions
	if (!stored) return null
	if (stored.length !== Math.max(0, tree.conditions.length - 1)) return null
	if (stored.length > 0 && stored[0] !== tree.conjunction) return null
	return stored
}

/**
 * Nest every leaf back into {provider, config} and give the group one joiner per
 * gap, the only shape raven_integration's engine reads. A group still holding
 * the joiners it was loaded with keeps them: flattening a mixed level on an
 * unrelated save turns `and` into `or`, which widens membership silently.
 */
export function toApiTree(tree: RuleGroup): ApiRuleGroup {
	const gaps = Math.max(0, tree.conditions.length - 1)
	const held = heldStoredJoiners(tree)
	return {
		conjunctions: held
			? [...held]
			: Array.from({ length: gaps }, () => tree.conjunction),
		conditions: tree.conditions.map((node) =>
			isRuleGroup(node) ? toApiTree(node) : toApiRule(node)
		),
	}
}

/** True when any group was loaded joining its rows with both `and` and `or`. */
export function hasMixedConjunctions(tree: RuleGroup): boolean {
	const stored = tree.storedConjunctions ?? []
	if (stored.some((c) => c !== stored[0])) return true
	return tree.conditions.some(
		(node) => isRuleGroup(node) && hasMixedConjunctions(node)
	)
}

/** Every leaf of the tree with its path, depth first. */
export function ruleLeaves(
	tree: RuleGroup,
	path: RulePath = []
): { path: RulePath; rule: RavenMemberRule }[] {
	const out: { path: RulePath; rule: RavenMemberRule }[] = []
	tree.conditions.forEach((node, index) => {
		if (isRuleGroup(node)) out.push(...ruleLeaves(node, [...path, index]))
		else out.push({ path: [...path, index], rule: node })
	})
	return out
}

/** A path as a map key and as the stable half of an element id. */
export function pathKey(path: RulePath): string {
	return path.join('.')
}

/** The leaf at `path`, or null if nothing is there or a group is. */
export function leafAt(
	tree: RuleGroup,
	path: RulePath
): RavenMemberRule | null {
	let node: RuleNode = tree
	for (const index of path) {
		if (!isRuleGroup(node)) return null
		const child: RuleNode | undefined = node.conditions[index]
		if (child === undefined) return null
		node = child
	}
	return isRuleGroup(node) ? null : node
}
