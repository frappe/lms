/**
 * The phone's destination list.
 *
 * This logic used to be component-local state inside MobileLayout and had no
 * test at all; it moved to a module-level store when the You page needed the
 * same links. What is pinned here is the part that is order-dependent and easy
 * to break silently: the admin's visibility flags are applied *last*, to
 * everything that ends up in either list, the moderator extras and session
 * actions land in `otherLinks` rather than on the bar, and a learner costs one
 * `get_programs` call while a moderator costs none.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { call, getSidebarLinks, settings } = vi.hoisted(() => ({
	call: vi.fn(),
	getSidebarLinks: vi.fn(),
	settings: { data: undefined as unknown },
}))

vi.mock('frappe-ui', () => ({ call }))

vi.mock('@/utils', () => ({ getSidebarLinks }))

vi.mock('@/stores/settings', () => ({
	useSettings: () => ({
		sidebarSettings: settings,
		loadSidebarSettings: () => Promise.resolve(settings.data),
	}),
}))

import {
	loadMobileNavLinks,
	otherLinks,
	sidebarLinks,
} from '@/stores/mobileNavLinks'

// What `getSidebarLinks(true)` hands back: groups, each holding the links.
const SIDEBAR = [
	{ items: [{ label: 'Home', icon: 'House', to: 'Home' }] },
	{
		items: [
			{ label: 'Courses', icon: 'BookOpen', to: 'Courses' },
			{ label: 'Batches', icon: 'Users', to: 'Batches' },
			{ label: 'Jobs', icon: 'Briefcase', to: 'Jobs' },
		],
	},
]

const LEARNER = {
	isSignedIn: true,
	isModerator: false,
	isInstructor: false,
	isEvaluator: false,
}
const MODERATOR = { ...LEARNER, isModerator: true }
const GUEST = { ...LEARNER, isSignedIn: false }

const labels = (links: { value: { label: string }[] }) =>
	links.value.map((link) => link.label)

beforeEach(() => {
	vi.clearAllMocks()
	sidebarLinks.value = []
	otherLinks.value = []
	settings.data = {}
	getSidebarLinks.mockReturnValue(structuredClone(SIDEBAR))
	call.mockResolvedValue({ enrolled: [], published: [] })
})

describe('loadMobileNavLinks', () => {
	it('flattens the sidebar groups into one list', async () => {
		await loadMobileNavLinks(LEARNER)
		expect(labels(sidebarLinks)).toEqual(['Home', 'Courses', 'Batches', 'Jobs'])
	})

	it('drops a destination the admin has switched off', async () => {
		settings.data = { batches: 0, jobs: '0' }
		await loadMobileNavLinks(LEARNER)
		expect(labels(sidebarLinks)).toEqual(['Home', 'Courses'])
	})

	it('keeps everything while the settings are still unresolved', async () => {
		// An unanswered call is not an answer: nothing is hidden, and no session
		// links are added either, because the load has not really happened yet.
		settings.data = undefined
		await loadMobileNavLinks(MODERATOR)
		expect(labels(sidebarLinks)).toEqual(['Home', 'Courses', 'Batches', 'Jobs'])
		expect(labels(otherLinks)).toEqual([])
	})

	it('adds Programs next to Courses for a moderator, without asking', async () => {
		await loadMobileNavLinks(MODERATOR)
		expect(labels(sidebarLinks)).toEqual([
			'Home',
			'Programs',
			'Courses',
			'Batches',
			'Jobs',
		])
		expect(call).not.toHaveBeenCalled()
	})

	it('asks once whether a learner can reach a program', async () => {
		await loadMobileNavLinks(LEARNER)
		expect(call).toHaveBeenCalledTimes(1)
		expect(call).toHaveBeenCalledWith('lms.lms.utils.get_programs')
		expect(labels(sidebarLinks)).not.toContain('Programs')
	})

	it('adds Programs for a learner who is enrolled in one', async () => {
		call.mockResolvedValue({ enrolled: [{ name: 'p1' }], published: [] })
		await loadMobileNavLinks(LEARNER)
		expect(labels(sidebarLinks)).toContain('Programs')
	})

	it('does not offer Programs to a signed-out visitor', async () => {
		await loadMobileNavLinks(GUEST)
		expect(labels(sidebarLinks)).not.toContain('Programs')
		expect(call).not.toHaveBeenCalled()
	})

	it('drops Programs when the admin has switched it off', async () => {
		// The filter runs after everything is in the lists, so a spliced-in link
		// is subject to it too. It used to run first, which let `addPrograms` put
		// the link straight back and left a phone showing a destination the
		// desktop sidebar had already dropped. `get_sidebar_settings` sends no
		// `programs` flag today, so this is the ordering under test, not a
		// setting anyone can reach.
		settings.data = { programs: 0 }
		await loadMobileNavLinks(MODERATOR)
		expect(labels(sidebarLinks)).not.toContain('Programs')
	})

	it('puts the moderator extras in the overflow list, not on the bar', async () => {
		await loadMobileNavLinks(MODERATOR)
		expect(labels(otherLinks)).toEqual([
			'Quizzes',
			'Assignments',
			'Programming Exercises',
			'Notifications',
			'Profile',
			'Log out',
		])
	})

	it('gives even a moderator no Settings link', async () => {
		// There is no phone settings surface for one to point at: settings is the
		// desktop dialog, which has no address of its own.
		await loadMobileNavLinks(MODERATOR)
		expect(labels(otherLinks)).not.toContain('Settings')
	})

	it('gives a learner none of the extras', async () => {
		await loadMobileNavLinks(LEARNER)
		expect(labels(otherLinks)).toEqual(['Notifications', 'Profile', 'Log out'])
	})

	it('gives an instructor the extras', async () => {
		await loadMobileNavLinks({ ...LEARNER, isInstructor: true })
		expect(labels(otherLinks)).toContain('Quizzes')
	})

	it('offers a signed-out visitor nothing but Log in', async () => {
		await loadMobileNavLinks(GUEST)
		expect(labels(otherLinks)).toEqual(['Log in'])
	})

	it('does not accumulate duplicates when the settings change twice', async () => {
		// `sidebarSettings.data` is watched deeply, so a settings save re-runs
		// this whole load against state that is already populated.
		await loadMobileNavLinks(MODERATOR)
		await loadMobileNavLinks(MODERATOR)
		expect(labels(otherLinks).filter((l) => l === 'Quizzes')).toHaveLength(1)
		expect(labels(sidebarLinks).filter((l) => l === 'Programs')).toHaveLength(1)
	})
})
