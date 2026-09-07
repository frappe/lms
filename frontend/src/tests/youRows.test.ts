/**
 * The You page, as data.
 *
 * The bottom bar is five fixed routes with no More sheet, so this page is the
 * only way to reach anything that is not one of them. The things worth pinning
 * are the ones a merge could quietly undo: a destination must never sit on the
 * bar *and* in this list, an unrecognised destination must land somewhere rather
 * than be dropped, and the theme control must be the same row the shared builder
 * draws rather than a second one that can disagree.
 *
 * The icon check earns its place. Nav links name a lucide *component*
 * (`BookOpen`); a settings row wants a lucide *utility class*
 * (`lucide-book-open`). Hand SettingsRow the wrong one and it puts `BookOpen`
 * in a class attribute, which compiles to nothing and renders an invisible
 * icon — no error, no warning, same failure mode deadDesignTokens.test.ts
 * exists for. So the emitted classes are checked against the SVGs that
 * frappe-ui's lucideIconsPlugin actually reads.
 */
import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { buildYouRows, iconClass } from '@/components/Settings/youRows'
import {
	colourModeRow,
	type MobileRow,
	type MobileRowGroup,
} from '@/components/Settings/mobileSettings'
import type { NavLink } from '@/utils/mobileNav'

const link = (label: string, icon: string, to?: string): NavLink => ({
	label,
	icon,
	to,
})

// What stores/mobileNavLinks holds once it has settled for a moderator. No
// Settings link: the phone has no settings surface for one to point at.
const SIDEBAR = [
	link('Home', 'Home', 'Home'),
	link('Programs', 'Route', 'Programs'),
	link('Courses', 'BookOpen', 'Courses'),
	link('Batches', 'Users', 'Batches'),
	link('Certifications', 'GraduationCap', 'Certifications'),
	link('Jobs', 'Briefcase', 'Jobs'),
	link('Statistics', 'TrendingUp', 'Statistics'),
]
const OTHER = [
	link('Quizzes', 'CircleHelp', 'Quizzes'),
	link('Assignments', 'Pencil', 'Assignments'),
	link('Programming Exercises', 'Code', 'ProgrammingExercises'),
	link('Notifications', 'Bell', 'Notifications'),
	link('Profile', 'UserRound'),
	link('Log out', 'LogOut'),
]
const PRIMARY = ['Home', 'Courses', 'Certifications', 'You']

// Every fixture above names a real route, so the default answer is yes. A test
// that cares about the other shapes — an admin's URL, a page Frappe serves —
// passes its own.
const build = (overrides: Partial<Parameters<typeof buildYouRows>[0]> = {}) =>
	buildYouRows({
		sidebarLinks: SIDEBAR,
		otherLinks: OTHER,
		primaryLabels: PRIMARY,
		themePreference: 'system',
		hasRoute: () => true,
		...overrides,
	})

const group = (groups: MobileRowGroup[], key: string) =>
	groups.find((g) => g.key === key)

const labelsIn = (groups: MobileRowGroup[], key: string) =>
	group(groups, key)?.rows.map((row) => row.label) ?? []

const allRows = (groups: MobileRowGroup[]): MobileRow[] =>
	groups.flatMap((g) => g.rows)

// The profile card is no longer a row: MobileYou draws it in its own template as
// a 96px circle over the name, so it is covered by mobileYou.test.ts instead.

describe('destinations', () => {
	it('orders the destinations before the session rows', () => {
		// Three headings collapsed into one: every destination is a page, and
		// naming them Learning/Discover/More split a short list into shorter ones.
		expect(
			build({
				sidebarLinks: [...SIDEBAR, link('Contact Us', 'Mail', 'ContactUs')],
			}).map((group) => group.key)
		).toEqual(['Pages', 'Settings'])
	})

	it('keeps the section order inside the one group', () => {
		// The heading is gone, the clustering is not: LEARN, then DISCOVER, then
		// MORE. Arrival order would read Programs, Batches, Jobs, Statistics,
		// Quizzes — course content split around the discovery links.
		expect(
			labelsIn(
				build({
					sidebarLinks: [...SIDEBAR, link('Contact Us', 'Mail', 'ContactUs')],
				}),
				'Pages'
			)
		).toEqual([
			'Programs',
			'Batches',
			'Quizzes',
			'Assignments',
			'Programming Exercises',
			'Jobs',
			'Statistics',
			'Contact Us',
		])
	})

	it('leaves out everything already on the bottom bar', () => {
		const labels = allRows(build()).map((row) => row.label)
		for (const primary of ['Home', 'Courses', 'Certifications']) {
			expect(labels).not.toContain(primary)
		}
	})

	it('shows a destination once when it is in both link lists', () => {
		const rows = allRows(
			build({ otherLinks: [link('Programs', 'Route', 'Programs'), ...OTHER] })
		)
		expect(rows.filter((row) => row.label === 'Programs')).toHaveLength(1)
	})

	it('keeps an unrecognised destination rather than dropping it', () => {
		// Contact Us is a real sidebar link that no SECTION_MAP entry names. It
		// falls through to MORE, which is last in the sort rather than a heading of
		// its own; without that fallback, adding a sidebar link would silently make
		// it unreachable on a phone.
		const rows = build({
			sidebarLinks: [...SIDEBAR, link('Contact Us', 'Mail', 'ContactUs')],
		})
		expect(labelsIn(rows, 'Pages')).toContain('Contact Us')
	})

	it('keeps the session rows out of the page list', () => {
		// `sectionFor` calls these ACCOUNT, and that is the only thing stopping
		// Log out from being sorted into the middle of the destinations.
		const pages = labelsIn(build(), 'Pages')
		for (const account of ['Notifications', 'Profile', 'Log out']) {
			expect(pages).not.toContain(account)
		}
	})

	it('drops the group when it has nothing in it', () => {
		// A bar wide enough for every destination: what is left is the session,
		// and an empty "Pages" heading would be a lie.
		const keys = build({
			sidebarLinks: SIDEBAR.filter((l) => PRIMARY.includes(l.label)),
			otherLinks: [link('Notifications', 'Bell', 'Notifications')],
		}).map((g) => g.key)
		expect(keys).toEqual(['Settings'])
	})

	it('routes by name', () => {
		const batches = allRows(build()).find((row) => row.label === 'Batches')
		expect(batches?.to).toEqual({ name: 'Batches' })
	})
})

describe('notifications', () => {
	it('reports being picked instead of navigating', () => {
		const row = group(build(), 'Settings')?.rows[0]
		expect(row?.label).toBe('Notifications')
		expect(row?.action).toBe('notifications')
		expect(row?.to).toBeUndefined()
	})

	it('shows the unread count inline', () => {
		expect(group(build({ unreadCount: 7 }), 'Settings')?.rows[0].value).toBe(
			'7'
		)
	})

	it('shows nothing rather than a zero when everything is read', () => {
		expect(group(build({ unreadCount: 0 }), 'Settings')?.rows[0].value).toBe(
			undefined
		)
	})

	it('has no row at all when the link is absent', () => {
		const groups = build({
			otherLinks: OTHER.filter((l) => l.to !== 'Notifications'),
		})
		expect(labelsIn(groups, 'Settings')).toEqual(['Colour mode', 'Log out'])
	})
})

describe('the last group', () => {
	it('is the session, with no way into settings', () => {
		// An LMS is not configured with a thumb: there is no phone settings
		// screen and no moderator gate here to hide one behind.
		expect(labelsIn(build(), 'Settings')).toEqual([
			'Notifications',
			'Colour mode',
			'Log out',
		])
		expect(allRows(build()).map((row) => row.label)).not.toContain('Settings')
	})

	it('draws the row the shared colourModeRow builder builds', () => {
		// One theme control, not a second one that can disagree about the
		// current mode.
		const fromYou = group(
			build({ themePreference: 'dark' }),
			'Settings'
		)?.rows.find((row) => row.key === 'colour-mode')
		expect(fromYou).toEqual(colourModeRow('dark'))
		expect(fromYou?.value).toBe('Dark')
	})

	it('logs out in place rather than routing somewhere', () => {
		const logout = allRows(build()).find((row) => row.label === 'Log out')
		expect(logout?.action).toBe('logout')
		expect(logout?.to).toBeUndefined()
	})
})

describe('iconClass', () => {
	it('turns a lucide component name into its utility class', () => {
		expect(iconClass('BookOpen')).toBe('lucide-book-open')
		expect(iconClass('CircleHelp')).toBe('lucide-circle-help')
		expect(iconClass('TrendingUp')).toBe('lucide-trending-up')
		expect(iconClass('Route')).toBe('lucide-route')
	})

	it('has nothing to say about a link with no icon', () => {
		expect(iconClass(undefined)).toBeUndefined()
	})
})

describe('every icon the page can draw', () => {
	// frappe-ui's lucideIconsPlugin turns `lucide-<name>` into a mask-image only
	// when node_modules/lucide-static/icons/<name>.svg exists; when it does not,
	// the class is emitted with no rule behind it and the span renders empty.
	const ICONS_DIR = resolve(process.cwd(), 'node_modules/lucide-static/icons')

	const emitted = allRows(
		build({
			sidebarLinks: [...SIDEBAR, link('Contact Us', 'Mail', 'ContactUs')],
			unreadCount: 3,
		})
	)
		.map((row) => row.icon)
		.filter((icon): icon is string => Boolean(icon))

	// Named rather than counted, so it.each below can never silently run on an
	// empty list. The profile row is absent by design: it draws an avatar.
	it('emits an icon for every row that has one', () => {
		expect(emitted).toEqual([
			'lucide-route',
			'lucide-users',
			'lucide-circle-help',
			'lucide-pencil',
			'lucide-code',
			'lucide-briefcase',
			'lucide-trending-up',
			'lucide-mail',
			'lucide-bell',
			'lucide-sun-moon',
			'lucide-log-out',
		])
	})

	it.each(emitted)('%s is a real lucide icon', (icon) => {
		expect(icon.startsWith('lucide-')).toBe(true)
		const name = icon.slice('lucide-'.length)
		expect(existsSync(resolve(ICONS_DIR, `${name}.svg`))).toBe(true)
	})
})
