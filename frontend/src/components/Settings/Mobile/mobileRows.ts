import type { RouteLocationRaw } from 'vue-router'
import type { ThemePreference } from '@/utils/theme'
import { overflowLinks, sectionFor, type NavLink } from '@/utils/mobileNav'
import type { FieldsSection } from '@/types/settingsSchema'

// Every grouped list a phone draws is a list of these, and `SettingsRowList`
// is the only thing that knows how one is drawn. A row either goes somewhere
// (`to`/`href`) or reports being picked (`action`), never more than one.
export interface MobileRow {
	key: string
	label: string
	icon?: string
	description?: string
	/** Shown inline on the right: the answer, so the list need not be opened. */
	value?: string
	to?: RouteLocationRaw
	/**
	 * Somewhere the SPA cannot route to: an admin's Contact Us URL, a page
	 * Frappe serves itself. Same shape as `to`, a row drawn with a chevron,
	 * but it leaves the app instead of pushing a route.
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

// The shape of a settings panel in settings.ts. Only `seedCheckboxDefaults`
// still reads it, and only for the field types.

// Seed each checkbox's default into the doc where it loads empty, without
// overwriting a value the server already sent: an untouched checkbox comes
// back as null, which a field with `default: 1` would otherwise flip off.
export const seedCheckboxDefaults = (
	sections: FieldsSection[],
	doc: Record<string, unknown>
): void => {
	for (const section of sections) {
		for (const field of section.fields) {
			if (field.type !== 'checkbox') continue
			// Only a field that states a default is seeded. Seeding one that does
			// not was writing 0 over every checkbox Frappe returns as null, making
			// the document dirty against originalDoc the instant a panel mounted.
			if (!('default' in field)) continue
			const current = doc[field.name]
			if (current === null || current === undefined || current === '') {
				doc[field.name] = field.default ? 1 : 0
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

// Exported because the You page lists this row. It reports being picked
// rather than routing somewhere: the picker is a sheet, not a page that
// exists only to hold three options.
export const colourModeRow = (themePreference: ThemePreference): MobileRow => ({
	key: 'colour-mode',
	label: 'Colour mode',
	icon: 'lucide-sun-moon',
	value: COLOUR_MODE_LABELS[themePreference] || 'System',
	action: COLOUR_MODE_ACTION,
})

// What a phone screen needs of `get_user_info`, a subset of its payload,
// named field for field so a screen reading it is type-checked against the
// endpoint's actual return rather than `any`.
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

// The You page, as data. The bar is five fixed routes with no More sheet, so
// this page is the only way to reach anything else.

// Nav links name a lucide *component* (`BookOpen`), settings rows a lucide
// *utility class* (`lucide-book-open`). Handing a component name to SettingsRow
// puts `BookOpen` in a class attribute, rendering an invisible icon rather than erroring.
export const iconClass = (icon?: string): string | undefined =>
	icon
		? `lucide-${icon.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`
		: undefined

// The sections survive as a sort order, not as three headings: one "Pages"
// list, course content first, keeping related rows adjacent (arrival order
// would interleave the sidebar and moderator extras). ACCOUNT is absent deliberately.
const DESTINATION_SECTIONS: readonly string[] = ['LEARN', 'DISCOVER', 'MORE']

// -1 for ACCOUNT, which is how a session row is recognised and dropped.
const sectionRank = (link: NavLink): number =>
	DESTINATION_SECTIONS.indexOf(sectionFor(link.label))

// `contact_us_url` is free text an admin typed into a settings field, and it
// ends up in an href. Matched against the scheme rather than
// SidebarLink.vue's `startsWith('http')`, so nothing else is handed to the browser as an absolute location.
const ABSOLUTE_URL = /^https?:\/\//i

// A nav link's `to` is not always a route name. `getSidebarItems` sets
// Contact Us's to an admin-typed URL or email address, so `{ name: link.to }`
// was a router error on every site with a contact URL set.
const destinationRow = (
	link: NavLink,
	hasRoute: (name: string) => boolean
): MobileRow => {
	const row: MobileRow = {
		key: link.label,
		label: link.label,
		icon: iconClass(link.icon),
	}

	if (!link.to) return row
	if (hasRoute(link.to)) return { ...row, to: { name: link.to } }
	if (ABSOLUTE_URL.test(link.to)) return { ...row, href: link.to }
	if (link.to.includes('@')) return { ...row, href: `mailto:${link.to}` }
	return { ...row, href: `/${link.to}` }
}

export const buildYouRows = (options: {
	sidebarLinks: readonly NavLink[]
	otherLinks: readonly NavLink[]
	primaryLabels: readonly string[]
	themePreference: ThemePreference
	unreadCount?: number
	/**
	 * `router.hasRoute`. Required rather than defaulted: a default of "yes,
	 * everything is a route" is what made Contact Us throw in the first place.
	 */
	hasRoute: (name: string) => boolean
}): MobileRowGroup[] => {
	const {
		sidebarLinks,
		otherLinks,
		primaryLabels,
		themePreference,
		unreadCount,
		hasRoute,
	} = options

	const overflow = overflowLinks(sidebarLinks, otherLinks, primaryLabels)

	// `sort` is stable, so links that share a section keep the order they
	// arrived in. `filter` already copied the array, so `overflow` is not reordered under its other reader.
	const pageRows: MobileRow[] = overflow
		.filter((link) => sectionRank(link) >= 0)
		.sort((a, b) => sectionRank(a) - sectionRank(b))
		.map((link) => destinationRow(link, hasRoute))

	// No rows, no heading: a bar that already holds every destination should not
	// leave an empty "Pages" behind.
	const pages: MobileRowGroup[] = pageRows.length
		? [{ key: 'Pages', label: 'Pages', rows: pageRows }]
		: []

	const settingsRows: MobileRow[] = []

	// Notifications is a panel, not a route, so it reports being picked and the
	// page decides what that means. It sits with the session rows rather than
	// under a heading of its own: one row is not a group.
	if (overflow.some((link) => link.label === 'Notifications')) {
		settingsRows.push({
			key: 'Notifications',
			label: 'Notifications',
			icon: 'lucide-bell',
			value: unreadCount ? String(unreadCount) : undefined,
			action: 'notifications',
		})
	}

	settingsRows.push(colourModeRow(themePreference))
	settingsRows.push({
		key: 'Log out',
		label: 'Log out',
		icon: 'lucide-log-out',
		action: 'logout',
	})

	// "Account", not "Settings": since 59d5a036a and e36397350 the phone has no
	// settings surface at all, so a heading named after one points at nothing.
	// The key is left as it was; tests match a group by it, and renaming it changes no pixel.
	return [...pages, { key: 'Settings', label: 'Account', rows: settingsRows }]
}
