/** frappe-ui's ghost input: no border until focus, so in-place text reads as text. */
export const GHOST_FIELD =
	'rounded-4 border border-transparent bg-transparent transition-colors placeholder:text-ink-gray-4 hover:bg-surface-gray-2 focus:border-outline-gray-4 focus:bg-surface-base focus:shadow-sm focus:outline-none focus:ring-0'

/** Bare text for a field inside a row that draws its own hover and focus fill. */
export const PLAIN_FIELD =
	'border-0 bg-transparent px-0 placeholder:text-ink-gray-4 focus:outline-none focus:ring-0'

/** The same, as classes for controls frappe-ui offers no ghost variant for. */
export const ghostFieldClasses = GHOST_FIELD

/**
 * Pulls a ghost field out by its padding and border so its text lines up with
 * the headings around it; the hover fill spills into the margin instead.
 */
export const BLEED_TEXT = '-mx-[11px] w-[calc(100%+22px)]'
export const BLEED_RICH_TEXT = '-mx-[13px]'

/** Rings a required field that is still empty while the form shows its gaps. */
export const MISSING_RING = 'bg-surface-red-1 ring-2 ring-outline-red-3'

export const missingRing = (missing?: boolean): string =>
	missing ? MISSING_RING : ''
