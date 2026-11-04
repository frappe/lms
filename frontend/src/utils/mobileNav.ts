// Nav taxonomy for the phone layout: which destinations stay on the fixed
// bottom bar, and how the rest are grouped on the You page.

export interface NavLink {
	label: string
	icon: string
	to?: string
	activeFor?: string[]
	/** Drawn as the user's avatar rather than as `icon`. Only the You tab is. */
	avatar?: boolean
}

// Primaries are picked out of the admin-configured sidebar links, so disabling
// a link in settings drops its tab too.
export const PRIMARY_LABELS: readonly string[] = [
	'Home',
	'Courses',
	'Batches',
	'Programs',
]

// Hardcoded rather than matched against `sidebarLinks`, which arrive
// asynchronously and left a signed-out visitor with an empty bar until the
// settings call resolved. Mirrors CRM's components/Mobile/MobileSidebar.vue.
// `pickPrimaryTabs` still hides any the admin has switched off.
export const GUEST_TABS: readonly NavLink[] = [
	{
		label: 'Courses',
		icon: 'BookOpen',
		to: 'Courses',
		activeFor: ['Courses', 'CourseDetail', 'Lesson'],
	},
	{
		label: 'Batches',
		icon: 'Users',
		to: 'Batches',
		activeFor: ['Batches', 'BatchDetail'],
	},
	{
		label: 'Jobs',
		icon: 'Briefcase',
		to: 'Jobs',
		activeFor: ['Jobs', 'JobDetail'],
	},
	{
		label: 'Statistics',
		icon: 'TrendingUp',
		to: 'Statistics',
		activeFor: ['Statistics'],
	},
	// No route: it leaves the SPA, so MobileLayout sends this one to Frappe's
	// server-rendered /login rather than through vue-router.
	{ label: 'Log in', icon: 'LogIn' },
]

// The last slot on the bar. It is the user's own face rather than a glyph,
// which is what makes the bar read as "you" instead of "menu", the detail
// Gameplan's /g/more gets right and an ellipsis does not.
const YOU_TAB: NavLink = {
	label: 'You',
	icon: 'UserRound',
	to: 'MobileYou',
	activeFor: ['MobileYou'],
	avatar: true,
}

// Five slots: the four PRIMARY_LABELS plus YOU_TAB. A ceiling on the whole bar,
// and YOU_TAB is pushed last, so a fifth primary would cost the You tab its
// place — widen this and the column widths together, or not at all.
const MAX_PRIMARY_TABS = 5

const SECTION_MAP: Record<string, readonly string[]> = {
	LEARN: [
		'Programs',
		'Batches',
		'Quizzes',
		'Assignments',
		'Programming Exercises',
	],
	DISCOVER: ['Jobs', 'Statistics'],
}

// Session actions belong to the account group no matter which list they
// arrived in. Quizzes and friends reach us through the same `otherLinks`
// array, and they are course content, not account settings.
const ACCOUNT_LABELS: readonly string[] = [
	'Notifications',
	'Profile',
	'Log in',
	'Log out',
]

export function sectionFor(label: string): string {
	if (ACCOUNT_LABELS.includes(label)) return 'ACCOUNT'
	for (const [section, labels] of Object.entries(SECTION_MAP)) {
		if (labels.includes(label)) return section
	}
	return 'MORE'
}

// Five columns on a 375px phone leave ~67px of text each: roughly ten
// characters at 12px, which every default tab clears. The map is the one place
// to shorten a label that does not fit, rather than letting `truncate` clip a
// word.
const SHORT_TAB_LABELS: Record<string, string> = {
	'Programming Exercises': 'Exercises',
}

export function tabLabel(label: string): string {
	return SHORT_TAB_LABELS[label] || label
}

// What `get_sidebar_settings` can hand back, and what each shape means.
export type SidebarVisibility = Record<string, unknown> | unknown[] | null

// `get_sidebar_settings` returns a bare `[]` (a list, where the settled case
// is an object) when the caller is a guest and guest access is off. That is an
// answer, not a silence: nothing in the app is browsable at all, so it must not
// be read as "no flags matched, keep everything".
export function isGuestAccessRevoked(visibility?: SidebarVisibility): boolean {
	return Array.isArray(visibility)
}

// Otherwise the flags are keyed by the lowercased, underscored label, the same
// convention the mobile nav store uses to drop a link from the bar. A label the
// settings say nothing about always stays, and so does everything while
// `visibility` is still unresolved: an empty bar is worse than one showing a
// destination for a moment.
export function isLinkEnabled(
	label: string,
	visibility?: SidebarVisibility
): boolean {
	if (!visibility || isGuestAccessRevoked(visibility)) return true
	const key = label.toLowerCase().split(' ').join('_')
	if (!(key in visibility)) return true
	return Boolean(parseInt(String((visibility as Record<string, unknown>)[key])))
}

export function pickPrimaryTabs(
	sidebarLinks: readonly NavLink[],
	isSignedIn: boolean,
	// Signed-in tabs are matched against `sidebarLinks`, which the caller has
	// already filtered; only the guest set needs this.
	visibility?: SidebarVisibility
): NavLink[] {
	if (!isSignedIn) {
		// Guest access withdrawn: every in-app destination goes. Only Log in
		// survives, because it leaves the SPA for Frappe's own /login and is the
		// one thing such a visitor can still do.
		if (isGuestAccessRevoked(visibility))
			return GUEST_TABS.filter((tab) => !tab.to)
		return GUEST_TABS.filter((tab) => isLinkEnabled(tab.label, visibility))
	}

	const picked: NavLink[] = []
	for (const label of PRIMARY_LABELS) {
		const link = sidebarLinks.find((item) => item.label === label)
		if (link) picked.push(link)
	}
	picked.push(YOU_TAB)
	return picked.slice(0, MAX_PRIMARY_TABS)
}

// Everything that did not make the bottom bar, in the order it arrived.
//
// `sidebarLinks` and `otherLinks` overlap. Programs is spliced into the
// sidebar list while the moderator extras are appended to the other list, and
// a re-entrant reload can leave the same label in both. Dedupe by label so a
// destination is never offered twice.
export function overflowLinks(
	sidebarLinks: readonly NavLink[],
	otherLinks: readonly NavLink[],
	primaryLabels: readonly string[]
): NavLink[] {
	const primary = new Set(primaryLabels)
	const seen = new Set<string>()
	const items: NavLink[] = []

	for (const link of [...sidebarLinks, ...otherLinks]) {
		if (primary.has(link.label) || seen.has(link.label)) continue
		seen.add(link.label)
		items.push(link)
	}

	return items
}
