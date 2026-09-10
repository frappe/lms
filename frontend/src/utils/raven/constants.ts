// Runtime constants for the Raven settings UI, kept out of `@/types` so that
// barrel stays type-only. `RULE_COMBINATORS` is the runtime form of the
// `RuleCombinator` union declared there.

export const RULE_COMBINATORS = ['Any (OR)', 'All (AND)'] as const

/** A change dropping at least this many members needs an explicit confirmation. */
export const MASS_REMOVAL_THRESHOLD = 25
