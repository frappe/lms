import type { RouteLocationRaw } from 'vue-router'
import type { ThemePreference } from '@/utils/theme'

// Every grouped list a phone draws is a list of these, and `SettingsRowList` is
// the only thing that knows how one is drawn. A screen declares objects; it does
// not write markup. Adding a row is a line of data, not a block of template.
//
// A row either goes somewhere (`to`, or `href` when the destination is outside
// the SPA) or reports being picked (`action`) — never more than one. Keeping
// the row pure data, with no callback baked in, is what lets the builders below
// be tested as plain functions.
export interface MobileRow {
	key: string
	label: string
	icon?: string
	description?: string
	/** Shown inline on the right — the answer, so the list need not be opened. */
	value?: string
	to?: RouteLocationRaw
	/**
	 * Somewhere the SPA cannot route to: an admin's Contact Us URL, a page
	 * Frappe serves itself. Same shape as `to` — a row that goes somewhere,
	 * drawn with a chevron — but it leaves the app instead of pushing a route.
	 */
	href?: string
	action?: string
	/** Draws a check instead of a chevron. */
	selected?: boolean
}

export interface MobileRowGroup {
	key: string
	label?: string
	rows: MobileRow[]
}

// The shape of a settings panel in settingsStructure.js. Only `seedCheckboxDefaults`
// still reads it, and only for the field types — the desktop dialog is the one
// surface that renders these.
interface SettingsField {
	label: string
	name: string
	type: string
	description?: string
	[key: string]: unknown
}

interface SettingsSection {
	label?: string
	columns: { fields: SettingsField[] }[]
}

// Seed each checkbox's default into the doc where it loads empty, without
// overwriting a value the server already sent.
//
// The settings doc depends on this: a checkbox the user has never touched comes
// back from Frappe as null, and a BooleanSwitch bound to null renders off but
// saves nothing, so a field with `default: 1` would silently flip off the first
// time anything else on the screen was saved. It lives here rather than in
// SettingFields.vue, its one caller, because that file is a plain-JS SFC and
// this is the part worth type-checking and testing on its own.
export const seedCheckboxDefaults = (
	sections: SettingsSection[],
	doc: Record<string, unknown>
): void => {
	for (const section of sections) {
		for (const column of section.columns) {
			for (const field of column.fields) {
				if (field.type !== 'checkbox') continue
				const current = doc[field.name]
				if (current === null || current === undefined || current === '') {
					doc[field.name] = field.default ? 1 : 0
				}
			}
		}
	}
}

const COLOUR_MODES: { value: ThemePreference; label: string }[] = [
	{ value: 'system', label: 'System' },
	{ value: 'light', label: 'Light' },
	{ value: 'dark', label: 'Dark' },
]

const COLOUR_MODE_LABELS: Record<string, string> = {
	system: 'System',
	light: 'Light',
	dark: 'Dark',
}

export const COLOUR_MODE_ACTION = 'colour-mode'

// Exported because the You page lists this row. It reports being picked rather
// than routing somewhere: the picker is a sheet, so there is one way to choose
// from a short list on a phone and no `/settings/appearance` page that exists
// only to hold three options.
export const colourModeRow = (themePreference: ThemePreference): MobileRow => ({
	key: 'colour-mode',
	label: 'Colour mode',
	icon: 'lucide-sun-moon',
	value: COLOUR_MODE_LABELS[themePreference] || 'System',
	action: COLOUR_MODE_ACTION,
})

// What a phone screen needs of `get_user_info` — a subset of its payload, named
// field for field, so a screen reading it is type-checked against what the
// endpoint actually returns rather than against `any`.
export interface SettingsUser {
	full_name?: string
	name?: string
	username?: string
	is_moderator?: boolean | number
	user_image?: string
	/** The one-line "what I do". `bio` is long-form prose and is not this. */
	headline?: string
}

/** The colour-mode picker, as data: one selectable row per mode. */
export const buildAppearanceRows = (
	themePreference: ThemePreference
): MobileRowGroup[] => [
	{
		key: 'colour-mode',
		rows: COLOUR_MODES.map((mode) => ({
			key: mode.value,
			label: mode.label,
			action: mode.value,
			selected: themePreference === mode.value,
		})),
	},
]
