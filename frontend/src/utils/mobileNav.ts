// Nav taxonomy for the phone layout: which destinations stay on the fixed
// bottom bar, and how the rest are grouped inside the More sheet.

export interface NavLink {
	label: string
	icon: string
	to?: string
	activeFor?: string[]
}

export interface NavSection {
	title: string
	items: NavLink[]
}

// Primaries are picked out of the admin-configured sidebar links, so disabling
// a link in settings drops its tab too.
export const PRIMARY_LABELS: readonly string[] = [
	'Home',
	'Courses',
	'Certifications',
]

// A signed-out visitor's whole destination set fits on the bar, so these are
// hardcoded instead of matched against `sidebarLinks`. Those links are
// admin-configured and arrive asynchronously; matching against them left the
// guest bar holding nothing but the More button until the settings call
// resolved, and sometimes it never did. Static list mirrors CRM's
// `components/Mobile/MobileSidebar.vue`.
//
// Static is the starting set, not the final one: `pickPrimaryTabs` still hides
// any of these the admin has switched off, once the settings actually arrive.
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
	// No route: MobileLayout sends this one to Frappe's server-rendered
	// /login, the same way the More sheet's Log in entry does.
	{ label: 'Log in', icon: 'LogIn' },
]

export const PROFILE_TAB: NavLink = {
	label: 'Profile',
	icon: 'UserRound',
	to: 'Profile',
	activeFor: ['Profile'],
}

const MAX_PRIMARY_TABS = 4

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
	'Settings',
	'Log in',
	'Log out',
]

const SUBTITLES: Record<string, string> = {
	Programs: 'Multi-course learning tracks',
	Batches: 'Cohort-based sessions',
	Quizzes: 'Across all your courses',
	Assignments: 'Due, in review, submitted',
	'Programming Exercises': 'Coding practice & solutions',
	Jobs: 'Open roles, hiring partners',
	Statistics: 'Your learning trends',
	Settings: 'Branding, members, payments',
}

const SECTION_ORDER: readonly string[] = [
	'LEARN',
	'DISCOVER',
	'MORE',
	'ACCOUNT',
]

export function sectionFor(label: string): string {
	if (ACCOUNT_LABELS.includes(label)) return 'ACCOUNT'
	for (const [section, labels] of Object.entries(SECTION_MAP)) {
		if (labels.includes(label)) return section
	}
	return 'MORE'
}

export function subtitleFor(label: string): string {
	return SUBTITLES[label] || ''
}

// Five equal-width tabs leave roughly 78px each. "Certifications" fills its
// column edge to edge while "Home" floats in the middle of one, which reads as
// uneven spacing. The design's own label for this tab is the shorter word.
const SHORT_TAB_LABELS: Record<string, string> = {
	Certifications: 'Certified',
	'Programming Exercises': 'Exercises',
}

export function tabLabel(label: string): string {
	return SHORT_TAB_LABELS[label] || label
}

// The bar only needs a More tab when there are destinations left to overflow
// into the sheet. A signed-out visitor's five fit exactly.
export function hasMoreTab(isSignedIn: boolean): boolean {
	return isSignedIn
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
// convention MobileLayout's `filterLinksToShow` uses to drop a link from the
// sheet. A label the settings say nothing about always stays, and so does
// everything while `visibility` is still unresolved: an empty bar is worse than
// one showing a destination for a moment.
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
	picked.push(PROFILE_TAB)
	return picked.slice(0, MAX_PRIMARY_TABS)
}

// `sidebarLinks` and `otherLinks` overlap. Programs is spliced into the
// sidebar list while the moderator extras are appended to the other list, and
// a re-entrant reload can leave the same label in both. Dedupe by label so the
// sheet never shows a destination twice.
export function buildMenuSections(
	sidebarLinks: readonly NavLink[],
	otherLinks: readonly NavLink[],
	primaryLabels: readonly string[],
	// The sheet no longer offers a search box; the filter stays because the
	// grouping is what it exists to test and a caller may want it back.
	search = ''
): NavSection[] {
	const primary = new Set(primaryLabels)
	const seen = new Set<string>()
	const items: NavLink[] = []

	for (const link of [...sidebarLinks, ...otherLinks]) {
		if (primary.has(link.label) || seen.has(link.label)) continue
		seen.add(link.label)
		items.push(link)
	}

	const query = search.trim().toLowerCase()
	const matched = query
		? items.filter((item) => item.label.toLowerCase().includes(query))
		: items

	return SECTION_ORDER.map((title) => ({
		title,
		items: matched.filter((item) => sectionFor(item.label) === title),
	})).filter((section) => section.items.length > 0)
}
