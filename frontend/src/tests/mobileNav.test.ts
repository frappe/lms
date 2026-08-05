import { describe, expect, it } from 'vitest'

import {
	buildMenuSections,
	hasMoreTab,
	pickPrimaryTabs,
	sectionFor,
	subtitleFor,
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

const sectionTitles = (sections: { title: string }[]) =>
	sections.map((s) => s.title)

const labelsIn = (
	sections: { title: string; items: NavLink[] }[],
	title: string
) => sections.find((s) => s.title === title)?.items.map((i) => i.label) ?? []

describe('pickPrimaryTabs', () => {
	it('picks the curated primaries out of the admin-configured links', () => {
		const tabs = pickPrimaryTabs(sidebarLinks, true)
		expect(tabs.map((t) => t.label)).toEqual([
			'Home',
			'Courses',
			'Certifications',
			'Profile',
		])
	})

	it('drops a primary the admin has disabled', () => {
		const withoutCertifications = sidebarLinks.filter(
			(l) => l.label !== 'Certifications'
		)
		expect(
			pickPrimaryTabs(withoutCertifications, true).map((t) => t.label)
		).toEqual(['Home', 'Courses', 'Profile'])
	})

	it('never exceeds four tabs, leaving room for More', () => {
		expect(pickPrimaryTabs(sidebarLinks, true)).toHaveLength(4)
	})

	it('falls back to Profile alone when the links have not loaded yet', () => {
		expect(pickPrimaryTabs([], true).map((t) => t.label)).toEqual(['Profile'])
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

describe('hasMoreTab', () => {
	it('keeps More for a signed-in user, whose nav overflows the bar', () => {
		expect(hasMoreTab(true)).toBe(true)
	})

	it('drops More for a signed-out visitor, who has no overflow', () => {
		expect(hasMoreTab(false)).toBe(false)
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
		expect(sectionFor('Settings')).toBe('ACCOUNT')
	})

	it('falls back to MORE for an unrecognised destination', () => {
		expect(sectionFor('Some New Page')).toBe('MORE')
	})
})

describe('buildMenuSections', () => {
	const primaryLabels = ['Home', 'Courses', 'Certifications', 'Profile']
	const build = (search = '') =>
		buildMenuSections(sidebarLinks, otherLinks, primaryLabels, search)

	it('groups the moderator extras under LEARN, not ACCOUNT', () => {
		// Regression: these arrive via `otherLinks`, which used to be hardcoded
		// to ACCOUNT, so Quizzes/Assignments/Programming Exercises showed up
		// under the account heading in the More sheet.
		expect(labelsIn(build(), 'LEARN')).toEqual([
			'Programs',
			'Batches',
			'Quizzes',
			'Assignments',
			'Programming Exercises',
		])
		// Profile is absent because it is already a bottom-bar tab. Settings is
		// present because the desk sidebar that normally opens it is not
		// rendered on a phone, leaving the More sheet as the only way in.
		expect(labelsIn(build(), 'ACCOUNT')).toEqual([
			'Notifications',
			'Settings',
			'Log out',
		])
	})

	it('shows a destination once when it appears in both link lists', () => {
		// Regression: a re-entrant sidebar reload left Programs in both arrays
		// and the sheet rendered it twice.
		const duplicated = buildMenuSections(
			[...sidebarLinks, link('Programs')],
			[link('Programs'), ...otherLinks],
			primaryLabels,
			''
		)
		expect(
			labelsIn(duplicated, 'LEARN').filter((l) => l === 'Programs')
		).toEqual(['Programs'])
	})

	it('leaves out anything already on the bottom bar', () => {
		const all = build().flatMap((s) => s.items.map((i) => i.label))
		expect(all).not.toContain('Home')
		expect(all).not.toContain('Courses')
		expect(all).not.toContain('Certifications')
		expect(all).not.toContain('Profile')
	})

	it('orders sections LEARN, DISCOVER, then ACCOUNT', () => {
		expect(sectionTitles(build())).toEqual(['LEARN', 'DISCOVER', 'ACCOUNT'])
	})

	it('drops sections the search has emptied', () => {
		const sections = build('quiz')
		expect(sectionTitles(sections)).toEqual(['LEARN'])
		expect(labelsIn(sections, 'LEARN')).toEqual(['Quizzes'])
	})

	it('matches the search case-insensitively and ignores padding', () => {
		expect(labelsIn(build('  BATCH  '), 'LEARN')).toEqual(['Batches'])
	})

	it('returns no sections when nothing matches', () => {
		expect(build('nothing here')).toEqual([])
	})

	it('returns no sections before the links have loaded', () => {
		expect(buildMenuSections([], [], primaryLabels, '')).toEqual([])
	})
})

describe('subtitleFor', () => {
	it('describes a known destination', () => {
		expect(subtitleFor('Batches')).toBe('Cohort-based sessions')
	})

	it('is empty for a destination with no description', () => {
		expect(subtitleFor('Log out')).toBe('')
	})
})
