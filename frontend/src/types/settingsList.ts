export type SettingsListRow = Record<string, any>

export interface DropdownOption {
	label: string
	icon?: string
	theme?: 'gray' | 'red'
	onClick: () => void
}

export interface SettingsListAvatar {
	image?: string
	label?: string
}

export type BadgeTheme = 'gray' | 'blue' | 'green' | 'orange' | 'red'

export interface SettingsListBadge {
	label: string
	theme?: BadgeTheme
}

interface ColumnBase {
	key: string
	label: string
	/**
	 * The grid track, e.g. `'8rem'`. Defaults to `minmax(0, 1fr)`.
	 *
	 * Must be a fixed length or an `fr`. The header and every row are separate
	 * grid containers sharing one template, so a content-sized track (`auto`,
	 * `max-content`, `min-content`) is resolved independently in each: the
	 * header sizes it to its label, a row sizes it to its cell, and the two
	 * drift apart by the difference. `settingsList.test.ts` pins this.
	 */
	width?: string
}

export interface StackedColumn extends ColumnBase {
	type: 'stacked'
	primary: (row: SettingsListRow) => string
	/** Omit for a single line that still reads as the row's name. */
	secondary?: (row: SettingsListRow) => string
	avatar?: (row: SettingsListRow) => SettingsListAvatar
	/** Draws the `leading` slot before the text, where the avatar would sit. */
	leading?: boolean
}

export interface TextColumn extends ColumnBase {
	type: 'text'
	value: (row: SettingsListRow) => string
	avatar?: (row: SettingsListRow) => SettingsListAvatar
}

export interface BadgeColumn extends ColumnBase {
	type: 'badge'
	badges: (row: SettingsListRow) => SettingsListBadge[]
	/**
	 * Badges drawn before the rest collapse into a `+N`. Defaults to 3.
	 *
	 * The cell is one line and never widens its track, so a row with more
	 * badges than fit is truncated rather than allowed to push the table wider
	 * than the page. Raise it only for a column wide enough to hold them.
	 */
	maxBadges?: number
}

export interface SwitchColumn extends ColumnBase {
	type: 'switch'
	checked: (row: SettingsListRow) => boolean
	ariaLabel: (row: SettingsListRow) => string
	onChange: (row: SettingsListRow, value: boolean) => void
	/**
	 * Rows whose switch is shown but cannot be flipped. Defaults to none.
	 *
	 * For a row where the control is meaningful enough to display, so the
	 * column still reads as one column, but writing it would do something
	 * other than what the switch says, e.g. create the record it toggles.
	 */
	disabled?: (row: SettingsListRow) => boolean
}

export interface ActionsColumn {
	key: string
	type: 'actions'
	label?: string
	width?: string
	options: (row: SettingsListRow) => DropdownOption[]
	/** Names the row's menu for a screen reader, e.g. "Delete Ada Lovelace". */
	ariaLabel?: (row: SettingsListRow) => string
}

export type SettingsListColumn =
	| StackedColumn
	| TextColumn
	| BadgeColumn
	| SwitchColumn
	| ActionsColumn
