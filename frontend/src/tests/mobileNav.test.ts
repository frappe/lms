import { describe, expect, it } from 'vitest'

import {
	overflowLinks,
	pickPrimaryTabs,
	sectionFor,
	type NavLink,
} from '@/utils/mobileNav'

const link = (label: string, icon = 'Circle'): NavLink => ({ label, icon })

// Mirrors what MobileLayout assembles at runtime: getSidebarLinks() output with
// Programs spliced in, plus the moderator extras and session actions that
// addOtherLinks()/addQuizzes() append to the separate `otherLinks` array.
const sidebarLinks = [
	link('Home'),
	link('Programs'),
	link('Courses'),
	link('Batches'),
	link('Jobs'),
	link('Statistics'),
	link('Certifications'),
]
const otherLinks = [
	link('Quizzes'),
	link('Assignments'),
	link('Programming Exercises'),
	link('Notifications'),
	link('Profile'),
	link('Settings'),
	link('Log out'),
]

describe('pickPrimaryTabs', () => {
	it('picks the curated primaries out of the admin-configured links', () => {
		const tabs = pickPrimaryTabs(sidebarLinks, true)
		expect(tabs.map((t) => t.label)).toEqual([
			'Home',
			'Courses',
			'Batches',
			'Programs',
			'You',
		])
	})

	it('drops a primary the admin has disabled', () => {
		const withoutBatches = sidebarLinks.filter((l) => l.label !== 'Batches')
		expect(pickPrimaryTabs(withoutBatches, true).map((t) => t.label)).toEqual([
			'Home',
			'Courses',
			'Programs',
			'You',
		])
	})

	it('never exceeds five tabs', () => {
		// Four PRIMARY_LABELS plus You, and You is pushed last — a fifth primary
		// would cost it its place.
		expect(pickPrimaryTabs(sidebarLinks, true)).toHaveLength(5)
	})

	it('falls back to You alone when the links have not loaded yet', () => {
		expect(pickPrimaryTabs([], true).map((t) => t.label)).toEqual(['You'])
	})

	it('asks for the You tab to be drawn as the user, not as a glyph', () => {
		// MobileLayout branches on this to render an Avatar instead of
		// icons[tab.icon]; without it the bar reads as a menu rather than as you.
		const you = pickPrimaryTabs(sidebarLinks, true).at(-1)
		expect(you?.avatar).toBe(true)
		expect(you?.to).toBe('MobileYou')
		expect(you?.activeFor).toEqual(['MobileYou'])
	})

	it('gives a signed-out visitor no You tab at all', () => {
		expect(
			pickPrimaryTabs(sidebarLinks, false).map((t) => t.label)
		).not.toContain('You')
	})
})

describe('pickPrimaryTabs for a signed-out visitor', () => {
	const guestLabels = ['Courses', 'Batches', 'Jobs', 'Statistics', 'Log in']

	it('shows the whole bar before any sidebar link has loaded', () => {
		// Regression: the guest bar used to be matched out of `sidebarLinks`,
		// which are admin-configured and arrive asynchronously. Until that
		// resolved (and sometimes it never did) nothing matched and the bar
		// rendered with the More button as its only entry.
		expect(pickPrimaryTabs([], false).map((t) => t.label)).toEqual(guestLabels)
	})

	it('stays put once the admin-configured links arrive', () => {
		expect(pickPrimaryTabs(sidebarLinks, false)).toEqual(
			pickPrimaryTabs([], false)
		)
	})

	it('hides a destination the admin has switched off', () => {
		// Greptile P1 on #2630: the guest bar was hardcoded, so a visitor could
		// see and open Batches or Jobs after LMS Settings had turned them off.
		const visibility = { courses: 1, batches: 0, jobs: 0, statistics: 1 }
		expect(pickPrimaryTabs([], false, visibility).map((t) => t.label)).toEqual([
			'Courses',
			'Statistics',
			'Log in',
		])
	})

	it('keeps every tab while the settings are still unresolved', () => {
		// An empty bar is worse than one showing a destination for a moment, so
		// nothing is hidden until the call actually answers.
		for (const unresolved of [undefined, null]) {
			expect(
				pickPrimaryTabs([], false, unresolved).map((t) => t.label)
			).toEqual(guestLabels)
		}
	})

	it('keeps a tab the settings say nothing about', () => {
		// Log in has no flag either way, and an object with no keys is still a
		// settled answer about the seven items it does not mention.
		expect(pickPrimaryTabs([], false, {}).map((t) => t.label)).toEqual(
			guestLabels
		)
		expect(
			pickPrimaryTabs([], false, { courses: 0 }).map((t) => t.label)
		).toContain('Log in')
	})

	it('leaves only Log in when guest access is switched off', () => {
		// `get_sidebar_settings` returns a bare `[]` (a list, not an object)
		// to a guest when allow_guest_access is off. Read as "no flags matched"
		// that kept every destination on the bar for a visitor who may not open
		// a single one of them.
		expect(pickPrimaryTabs([], false, []).map((t) => t.label)).toEqual([
			'Log in',
		])
	})

	it('does not confuse an empty object with an empty array', () => {
		// The two shapes mean opposite things: `{}` is a settled answer that
		// mentions nothing, `[]` is guest access withdrawn.
		expect(pickPrimaryTabs([], false, {})).not.toEqual(
			pickPrimaryTabs([], false, [])
		)
	})

	it('reads the flag however the endpoint spells it', () => {
		// `lms_settings.get(item)` hands back an int, but the resource has been
		// seen carrying strings; both mean the same thing.
		expect(
			pickPrimaryTabs([], false, { jobs: '0' }).map((t) => t.label)
		).not.toContain('Jobs')
		expect(
			pickPrimaryTabs([], false, { jobs: '1' }).map((t) => t.label)
		).toContain('Jobs')
	})

	it('gives every tab an icon, and a route unless it leaves the SPA', () => {
		const tabs = pickPrimaryTabs([], false)
		expect(tabs.every((t) => t.icon)).toBe(true)
		expect(tabs.filter((t) => t.to).map((t) => t.to)).toEqual([
			'Courses',
			'Batches',
			'Jobs',
			'Statistics',
		])
	})
})

describe('sectionFor', () => {
	it('files course content under LEARN wherever it came from', () => {
		expect(sectionFor('Quizzes')).toBe('LEARN')
		expect(sectionFor('Assignments')).toBe('LEARN')
		expect(sectionFor('Programming Exercises')).toBe('LEARN')
	})

	it('files session actions under ACCOUNT', () => {
		expect(sectionFor('Notifications')).toBe('ACCOUNT')
		expect(sectionFor('Log out')).toBe('ACCOUNT')
		expect(sectionFor('Profile')).toBe('ACCOUNT')
	})

	it('falls back to MORE for an unrecognised destination', () => {
		expect(sectionFor('Some New Page')).toBe('MORE')
	})
})

// What the More sheet used to be built from, and what the You page is built
// from now. The grouping moved to buildYouRows; the selection stayed here.
describe('overflowLinks', () => {
	const primaryLabels = ['Home', 'Courses', 'Certifications', 'You']
	const build = () => overflowLinks(sidebarLinks, otherLinks, primaryLabels)
	const labels = () => build().map((l) => l.label)

	it('keeps everything that did not fit on the bar, in arrival order', () => {
		expect(labels()).toEqual([
			'Programs',
			'Batches',
			'Jobs',
			'Statistics',
			'Quizzes',
			'Assignments',
			'Programming Exercises',
			'Notifications',
			'Profile',
			'Settings',
			'Log out',
		])
	})

	it('returns a destination once when it appears in both link lists', () => {
		// Regression: a re-entrant sidebar reload left Programs in both arrays
		// and the sheet rendered it twice.
		const duplicated = overflowLinks(
			[...sidebarLinks, link('Programs')],
			[link('Programs'), ...otherLinks],
			primaryLabels
		)
		expect(duplicated.filter((l) => l.label === 'Programs')).toHaveLength(1)
	})

	it('leaves out anything already on the bottom bar', () => {
		for (const primary of primaryLabels) {
			expect(labels()).not.toContain(primary)
		}
	})

	it('has nothing to offer before the links have loaded', () => {
		expect(overflowLinks([], [], primaryLabels)).toEqual([])
	})
})
