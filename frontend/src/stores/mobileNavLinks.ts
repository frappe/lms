import { ref } from 'vue'
import { call } from 'frappe-ui'
import { getSidebarLinks } from '@/utils'
import { useSettings } from '@/stores/settings'
import { isLinkEnabled, type NavLink } from '@/utils/mobileNav'

// The phone's destination list: the bottom bar picks its primaries out of
// `sidebarLinks`, the You page lists what did not make the bar.
//
// Module scope, not provide/inject from MobileLayout — You is a route of its
// own and would get `undefined` on a cold deep link. `stores/members.ts` is the
// same pattern. Both surfaces load through `ensureMobileNavLinks` rather than
// depending on a watcher above them having fired.

export interface MobileNavViewer {
	isSignedIn: boolean
	isModerator: boolean
	isInstructor: boolean
	isEvaluator: boolean
	/**
	 * Whether `get_user_info` has answered yet. `getSidebarLinks` gates Home and
	 * Certifications on that payload, so a viewer the cookie says is signed in
	 * but whose payload has not landed builds a short list — a different viewer,
	 * and part of the memo key for that reason.
	 */
	hasUserInfo?: boolean
}

// Restates `utils/index.js`'s private `isAdmin()` rather than calling it: that
// helper reads `usersStore()`, and this module is told who the viewer is so it
// stays testable without a session. Keep the two on the same three roles.
const canAssess = (viewer: MobileNavViewer): boolean =>
	viewer.isModerator || viewer.isInstructor || viewer.isEvaluator

export const sidebarLinks = ref<NavLink[]>([])
export const otherLinks = ref<NavLink[]>([])

interface SidebarGroup {
	items?: NavLink[]
}

// Which run is allowed to publish. Runs overlap by design — a run awaits twice
// and a new one starts as the viewer becomes better known — so the older one
// stops at its next await rather than writing over the newer one's list.
let latestRun = 0

const addLink = (
	links: NavLink[],
	label: string,
	icon: string,
	to = ''
): void => {
	if (links.some((link) => link.label === label)) return
	links.push({ label, icon, to })
}

// Programs is not admin-configurable; it is spliced in for anyone who can
// reach one. Position 1 keeps it next to Courses.
const addPrograms = async (
	viewer: MobileNavViewer,
	isCurrent: () => boolean
): Promise<void> => {
	if (sidebarLinks.value.some((link) => link.label === 'Programs')) return
	if (!viewer.isSignedIn) return
	if (!viewer.isModerator && !viewer.isInstructor) {
		const programs = await call('lms.lms.utils.get_programs')
		if (!isCurrent()) return
		if (!programs.enrolled.length && !programs.published.length) return
	}
	// Asked again on the far side of the await: the list can have been replaced,
	// and already carry Programs, while the call was in flight.
	if (sidebarLinks.value.some((link) => link.label === 'Programs')) return
	sidebarLinks.value.splice(1, 0, {
		label: 'Programs',
		icon: 'Route',
		to: 'Programs',
		activeFor: ['Programs', 'ProgramDetail'],
	})
}

const addSessionLinks = (links: NavLink[], viewer: MobileNavViewer): void => {
	if (!viewer.isSignedIn) {
		addLink(links, 'Log in', 'LogIn')
		return
	}
	addLink(links, 'Notifications', 'Bell', 'Notifications')
	addLink(links, 'Profile', 'UserRound')
	addLink(links, 'Log out', 'LogOut')
}

/**
 * Rebuild both lists for this viewer. Answers whether it got as far as
 * publishing: a run that found no visibility flags, or that a newer run
 * overtook, left the lists alone and is not something to remember as done.
 */
export async function loadMobileNavLinks(
	viewer: MobileNavViewer
): Promise<boolean> {
	const { sidebarSettings, loadSidebarSettings } = useSettings()
	const run = ++latestRun
	const isCurrent = (): boolean => run === latestRun

	// Published before the first await so the bar starts populated; filtered and
	// republished at the end.
	sidebarLinks.value = (getSidebarLinks(true) as SidebarGroup[]).flatMap(
		(group) => group.items ?? []
	)

	await loadSidebarSettings()
	if (!isCurrent()) return false
	const visibility = sidebarSettings.data
	if (!visibility) return false

	await addPrograms(viewer, isCurrent)
	if (!isCurrent()) return false

	// Collected here and published once at the end, so the You page never shows a
	// half-built group and a previous viewer's rows cannot survive into this run.
	const others: NavLink[] = []

	if (canAssess(viewer)) {
		addLink(others, 'Quizzes', 'CircleHelp', 'Quizzes')
		addLink(others, 'Assignments', 'Pencil', 'Assignments')
		addLink(others, 'Programming Exercises', 'Code', 'ProgrammingExercises')
	}

	addSessionLinks(others, viewer)

	// Last, and over both lists: the flags say what exists on this site, so they
	// must outrank everything added after the sidebar was read. Filtering earlier
	// would reach the admin-configured links only, leaving a disabled Programming
	// Exercises or Notifications on the phone — both arrive in `otherLinks`.
	// Safe over the session rows: `isLinkEnabled` keeps anything the settings do
	// not name, and `get_sidebar_settings` never names profile, log_in or log_out.
	const isEnabled = (link: NavLink): boolean =>
		isLinkEnabled(link.label, visibility)

	sidebarLinks.value = sidebarLinks.value.filter(isEnabled)
	otherLinks.value = others.filter(isEnabled)
	return true
}

// The viewer as a string, so the same viewer asked for twice is one load.
// Coerced, not interpolated: `get_user_info` answers 1 and 0 while the You page
// reads the same payload as booleans, and `1` and `true` are the same viewer.
const viewerKey = (viewer: MobileNavViewer): string =>
	[
		viewer.isSignedIn,
		viewer.isModerator,
		viewer.isInstructor,
		viewer.isEvaluator,
		viewer.hasUserInfo,
	]
		.map((flag) => (flag ? 1 : 0))
		.join('')

let loadedFor: string | null = null
let loaded: Promise<void> | null = null

/**
 * Load the links, unless this exact viewer has been loaded already — in which
 * case the first load's promise comes back and nothing is fetched again. Both
 * phone surfaces call this: the bar's layout, and the You page on mount.
 *
 * Keyed on the viewer alone, so a change to the admin's sidebar flags does not
 * re-run it — no phone surface can change them. Add a second key if that stops
 * being true.
 */
export function ensureMobileNavLinks(viewer: MobileNavViewer): Promise<void> {
	const key = viewerKey(viewer)
	if (loaded && loadedFor === key) return loaded

	const forget = (): void => {
		// Only a run that published is worth remembering. A rejected run would
		// otherwise be handed to every later caller as "done" and the page would
		// stay empty for the session. Guarded because a newer viewer may already
		// own the memo.
		if (loadedFor !== key) return
		loadedFor = null
		loaded = null
	}

	loadedFor = key
	loaded = loadMobileNavLinks(viewer).then((published) => {
		if (!published) forget()
	}, forget)
	return loaded
}
