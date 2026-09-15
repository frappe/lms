import { isLinkEnabled, type SidebarVisibility } from '@/utils/mobileNav'

export interface Category {
	/** Sent to search_sqlite, which maps it to a doctype; never a doctype here. */
	id: string
	label: string
	/** A generated `lucide-*` class, the way the rest of the app names icons. */
	icon: string
	/** The category's own list page, and the sidebar entry it is gated by. */
	listRoute: string
}

/**
 * Visibility is taken from the sidebar rather than restated here: a category is
 * offered when the sidebar is offering its page to this user. That covers the
 * authoring surfaces (Quizzes and Assignments are instructor/moderator/evaluator
 * only) and Programs, which is hidden from guests and from students with no
 * programs, and it cannot drift from the sidebar the way a second copy of the
 * rules would. Hiding a row is a convenience either way — `get_grouped_results`
 * is what actually withholds records.
 */
export const CATEGORIES: Category[] = [
	{
		id: 'courses',
		label: 'Courses',
		icon: 'lucide-book-open',
		listRoute: 'Courses',
	},
	{
		id: 'batches',
		label: 'Batches',
		icon: 'lucide-users',
		listRoute: 'Batches',
	},
	{
		id: 'programs',
		label: 'Programs',
		icon: 'lucide-route',
		listRoute: 'Programs',
	},
	{ id: 'jobs', label: 'Jobs', icon: 'lucide-briefcase', listRoute: 'Jobs' },
	{
		id: 'quizzes',
		label: 'Quizzes',
		icon: 'lucide-circle-help',
		listRoute: 'Quizzes',
	},
	{
		id: 'assignments',
		label: 'Assignments',
		icon: 'lucide-pencil',
		listRoute: 'Assignments',
	},
]

interface SidebarItem {
	to?: string
}

interface SidebarGroup {
	items: SidebarItem[]
}

function offeredRoutes(sidebarLinks: SidebarGroup[]): Set<string | undefined> {
	return new Set(
		(sidebarLinks ?? [])
			.flatMap((group) => group.items ?? [])
			.map((item) => item.to)
	)
}

/**
 * Categories whose page this user is being offered in the sidebar.
 *
 * `getSidebarLinks()` is only half of what the sidebar draws: AppSidebar filters
 * its result again against `get_sidebar_settings`, the per-site on/off flags, so
 * reading the first half alone offered a Jobs row on a site with Jobs switched
 * off. `isLinkEnabled` is the phone bar's reading of those same flags, and the
 * same label-to-key convention AppSidebar filters by.
 */
export function visibleCategories(
	sidebarLinks: SidebarGroup[],
	visibility?: SidebarVisibility
): Category[] {
	const offered = offeredRoutes(sidebarLinks)
	return CATEGORIES.filter(
		(category) =>
			offered.has(category.listRoute) &&
			isLinkEnabled(category.label, visibility)
	)
}

export function categoryById(id: string | null): Category | undefined {
	if (!id) return undefined
	return CATEGORIES.find((category) => category.id === id)
}

export interface NavTarget {
	id: string
	label: string
	/** A generated `lucide-*` class, the way the rest of the app names icons. */
	icon: string
	/** Route name. Selecting the row goes straight here. */
	route: string
}

/**
 * Sidebar pages with no records behind them, so there is nothing to scope a
 * search to — the row navigates instead of drilling in.
 *
 * Listed by hand rather than derived from the sidebar, because a sidebar `to`
 * is not always a route name: Contact Us carries a URL or a mailto address,
 * and pushing either as a route name lands nowhere.
 */
export const NAV_TARGETS: NavTarget[] = [
	{ id: 'home', label: 'Home', icon: 'lucide-home', route: 'Home' },
	{
		id: 'certifications',
		label: 'Certifications',
		icon: 'lucide-graduation-cap',
		route: 'CertifiedParticipants',
	},
	{
		id: 'statistics',
		label: 'Statistics',
		icon: 'lucide-trending-up',
		route: 'Statistics',
	},
	{
		id: 'programming-exercises',
		label: 'Programming Exercises',
		icon: 'lucide-code',
		route: 'ProgrammingExercises',
	},
]

/** Nav targets whose page this user is being offered in the sidebar. */
export function visibleNavTargets(
	sidebarLinks: SidebarGroup[],
	visibility?: SidebarVisibility
): NavTarget[] {
	const offered = offeredRoutes(sidebarLinks)
	return NAV_TARGETS.filter(
		(target) =>
			offered.has(target.route) && isLinkEnabled(target.label, visibility)
	)
}
