/**
 * Category drill-down, and the rows that are gated on a role.
 *
 * The client-side gate here only keeps a row off screen. What a search actually
 * returns is decided by `get_grouped_results` on the server, which is where the
 * permission check that matters lives.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	clickItem,
	flush,
	mountPalette,
	paletteInput,
	paletteItemValues,
	type,
	keydown,
	unmountPalette,
} from './helpers/commandPalette'

const resource = {
	next: null as unknown,
	params: null as any,
	submit: vi.fn(async (params: any) => {
		resource.params = params
		return resource.next
	}),
}

vi.mock('frappe-ui', () => ({
	createResource: () => resource,
	debounce: (fn: (...args: unknown[]) => void) =>
		Object.assign(fn, { cancel: () => {} }),
}))

// Settings is addressed by the URL hash now, so opening it is a navigation:
// the stub has to carry the pieces pushSettingsHash reads, not just push().
const router = {
	currentRoute: { value: { hash: '', query: {} } },
	options: { history: { state: {} } },
	push: vi.fn(),
	replace: vi.fn(),
}
vi.mock('vue-router', () => ({ useRouter: () => router }))

const user = { data: {} as Record<string, unknown> }
vi.mock('@/stores/user', () => ({ usersStore: () => ({ userResource: user }) }))

const settings = {
	isSettingsOpen: false,
	isSettingsMounted: true,
	// The per-site on/off flags, which gate a row on top of the sidebar.
	sidebarSettings: { data: null as unknown },
	loadSidebarSettings: vi.fn(async () => null),
}
// Category visibility comes from the sidebar, so this is what decides it.
const sidebarLinks = { value: [] as any[] }
vi.mock('@/utils', () => ({ getSidebarLinks: () => sidebarLinks.value }))

vi.mock('@/stores/settings', () => ({ useSettings: () => settings }))

// Mirrors src/translation.js: a message with {0} placeholders returns an object
// carrying `format`, not a string. A plain identity stub would let a real
// `.format is not a function` crash pass.
vi.stubGlobal('__', (message: string) => {
	if (!/{\d+}/.test(message)) return message
	return {
		format: (...args: string[]) =>
			message.replace(
				/{(\d+)}/g,
				(match, index) => args[Number(index)] ?? match
			),
	}
})

afterEach(unmountPalette)

const links = (...routes: string[]) => [{ items: routes.map((to) => ({ to })) }]

// What getSidebarLinks() actually returns for each kind of visitor. Programs is
// absent for a guest (`if (!userResource.data) return false`) and for a student
// with no programs; Quizzes and Assignments are instructor/moderator/evaluator only.
const GUEST = links('Courses', 'Batches', 'Jobs', 'Statistics')
// Certifications' `to` is the route name, not the label.
const STUDENT = links(
	'Courses',
	'Batches',
	'Jobs',
	'CertifiedParticipants',
	'Statistics'
)
const STUDENT_WITH_PROGRAMS = links(
	'Courses',
	'Batches',
	'Programs',
	'Jobs',
	'Statistics'
)
const ADMIN = links(
	'Courses',
	'Batches',
	'Programs',
	'Jobs',
	'Quizzes',
	'Assignments',
	'CertifiedParticipants',
	'Statistics',
	'ProgrammingExercises'
)

function titles() {
	return paletteItemValues().map((item) => item.title)
}

/** Clicks the row with `title` and opens it. */
async function open(title: string) {
	await clickItem((item) => item.title === title)
}

beforeEach(() => {
	sidebarLinks.value = ADMIN
	user.data = { is_moderator: true }
	settings.isSettingsOpen = false
	settings.isSettingsMounted = true
	settings.sidebarSettings.data = null
	resource.next = []
	resource.params = null
	router.push.mockClear()
})

describe('command palette categories', () => {
	it('offers a browse row for each category the user may see', async () => {
		await mountPalette()
		expect(titles()).toEqual(
			expect.arrayContaining(['Courses', 'Batches', 'Jobs', 'Programs'])
		)
	})

	it.each([
		{ who: 'guest', sidebar: GUEST, offered: false },
		{ who: 'student', sidebar: STUDENT, offered: false },
		{ who: 'admin', sidebar: ADMIN, offered: true },
	])('offers Quizzes to a $who: $offered', async ({ sidebar, offered }) => {
		sidebarLinks.value = sidebar
		await mountPalette()
		expect(titles().includes('Quizzes')).toBe(offered)
	})

	// The palette used to restate visibility itself and gave Programs no rule at
	// all, so it offered Programs to a guest while the sidebar did not.
	it.each([
		{ who: 'guest', sidebar: GUEST, offered: false },
		{ who: 'student without programs', sidebar: STUDENT, offered: false },
		{
			who: 'student with programs',
			sidebar: STUDENT_WITH_PROGRAMS,
			offered: true,
		},
		{ who: 'admin', sidebar: ADMIN, offered: true },
	])('offers Programs to a $who: $offered', async ({ sidebar, offered }) => {
		sidebarLinks.value = sidebar
		await mountPalette()
		expect(titles().includes('Programs')).toBe(offered)
	})

	it('never offers a category the sidebar is withholding', async () => {
		sidebarLinks.value = GUEST
		await mountPalette()
		const offered = titles()
		for (const hidden of ['Programs', 'Quizzes', 'Assignments']) {
			expect(offered).not.toContain(hidden)
		}
		expect(offered).toContain('Courses')
	})

	it('scopes the search to the category that was opened', async () => {
		await mountPalette()
		await open('Batches')
		await type('autumn')

		expect(resource.params).toEqual(
			expect.objectContaining({ query: 'autumn', category: 'batches' })
		)
	})

	it('leaves the search unscoped at the root', async () => {
		await mountPalette()
		await type('autumn')

		expect(resource.params.category).toBeUndefined()
	})

	it('backs out of a category on Backspace with an empty query', async () => {
		await mountPalette()
		await open('Courses')
		expect(titles()).not.toContain('Batches')

		await keydown(paletteInput(), 'Backspace')

		expect(titles()).toContain('Batches')
	})

	it('keeps a query intact when Backspace is a real edit', async () => {
		await mountPalette()
		await open('Courses')
		await type('kube')
		await keydown(paletteInput(), 'Backspace')

		expect(titles()).not.toContain('Batches')
	})

	it.each([
		{ role: 'student', data: { is_student: true }, visible: false },
		{ role: 'instructor', data: { is_instructor: true }, visible: false },
		{ role: 'moderator', data: { is_moderator: true }, visible: true },
	])('shows Settings to a $role: $visible', async ({ data, visible }) => {
		user.data = { ...data }
		await mountPalette()
		expect(titles().includes('Settings')).toBe(visible)
	})

	// Settings is a dialog mounted by the desktop sidebar; on a phone nothing is
	// listening to the flag, so the row would do nothing at all.
	it('hides Settings when the settings dialog is not mounted', async () => {
		settings.isSettingsMounted = false
		await mountPalette()
		expect(titles()).not.toContain('Settings')
	})

	// A scope that survived the close reopened the palette silently filtered.
	it('forgets the category once the palette closes', async () => {
		const wrapper = await mountPalette()
		await open('Courses')
		expect(titles()).not.toContain('Batches')

		await wrapper.setProps({ modelValue: false })
		await wrapper.setProps({ modelValue: true })
		await flush()

		expect(titles()).toContain('Batches')
	})

	it('opens the settings dialog rather than routing', async () => {
		await mountPalette()
		await open('Settings')

		// The hash opens the dialog over whatever page is showing; a `name` here
		// would mean the row had navigated away from it instead.
		const [to] = router.push.mock.calls[0]
		expect(to.hash).toBe('#settings/general')
		expect(to).not.toHaveProperty('name')
	})
})

/**
 * Rows that only navigate. Statistics is a sidebar page with no records behind
 * it, so it cannot be a searchable category — Enter has to take the user there
 * rather than narrow the search to nothing.
 */
describe('command palette jump-to targets', () => {
	it('offers Statistics', async () => {
		await mountPalette()
		expect(titles()).toContain('Statistics')
	})

	it('navigates to Statistics rather than scoping the search', async () => {
		await mountPalette()
		const row = paletteItemValues().find((item) => item.title === 'Statistics')
		expect(row.category).toBeUndefined()
		expect(row.route).toEqual(expect.objectContaining({ name: 'Statistics' }))
	})

	it.each([
		{ label: 'Certifications', route: 'CertifiedParticipants' },
		{ label: 'Programming Exercises', route: 'ProgrammingExercises' },
		{ label: 'Home', route: 'Home' },
	])('offers $label when the sidebar does', async ({ label, route }) => {
		sidebarLinks.value = links(route)
		await mountPalette()
		const row = paletteItemValues().find((item) => item.title === label)
		expect(row?.route).toEqual(expect.objectContaining({ name: route }))
	})

	// Contact Us's `to` is a URL or a mailto address, never a route name, so
	// mapping sidebar entries blindly would push a garbage route.
	it('never offers Contact Us', async () => {
		sidebarLinks.value = links(
			'https://example.com/support',
			'help@example.com'
		)
		await mountPalette()
		expect(titles()).not.toContain('Contact Us')
		expect(paletteItemValues()).toHaveLength(1) // Settings, from the Account group
	})

	it('withholds a target the sidebar is withholding', async () => {
		sidebarLinks.value = links('Courses')
		await mountPalette()
		expect(titles()).not.toContain('Statistics')
	})

	it.each(['Statistics', 'Certifications'])(
		'finds %s by typing its name',
		async (label) => {
			await mountPalette()
			await type(label.slice(0, 4).toLowerCase())
			expect(titles()).toContain(label)
		}
	)
})

/**
 * Settings lived only in the pre-search browse list, so typing its name emptied
 * the palette and reported "No results found" instead of offering it.
 */
describe('command palette settings row', () => {
	it('finds Settings by typing its name', async () => {
		await mountPalette()
		await type('sett')

		expect(titles()).toContain('Settings')
	})

	it('still opens the dialog when reached by typing', async () => {
		await mountPalette()
		await type('sett')
		await open('Settings')

		const [to] = router.push.mock.calls[0]
		expect(to.hash).toBe('#settings/general')
	})

	it('does not offer Settings to a searching student', async () => {
		user.data = { is_student: true }
		await mountPalette()
		await type('sett')

		expect(titles()).not.toContain('Settings')
	})
})

/**
 * `getSidebarLinks()` is only half the sidebar's rule. AppSidebar filters its
 * result a second time against `get_sidebar_settings` — the per-site on/off
 * flags — and the palette read only the first half, so a site with Jobs
 * switched off was still offered a Jobs row.
 */
describe('command palette site visibility flags', () => {
	it('withholds a category the site has switched off', async () => {
		settings.sidebarSettings.data = { jobs: 0 }
		await mountPalette()
		const offered = titles()
		expect(offered).not.toContain('Jobs')
		expect(offered).toContain('Courses')
	})

	it('withholds a nav target the site has switched off', async () => {
		settings.sidebarSettings.data = { statistics: 0 }
		await mountPalette()
		expect(titles()).not.toContain('Statistics')
	})

	// The flag key is the lowercased, underscored label, so a two-word target
	// only matches if the label is converted the way AppSidebar converts it.
	it('withholds a two-word nav target the site has switched off', async () => {
		settings.sidebarSettings.data = { programming_exercises: 0 }
		await mountPalette()
		expect(titles()).not.toContain('Programming Exercises')
	})

	it('keeps a row the flags say nothing about', async () => {
		settings.sidebarSettings.data = { jobs: 0 }
		await mountPalette()
		expect(titles()).toContain('Quizzes')
	})

	it('offers everything while the flags are still unresolved', async () => {
		settings.sidebarSettings.data = null
		await mountPalette()
		expect(titles()).toContain('Jobs')
	})

	it('withholds a switched-off category from a search too', async () => {
		settings.sidebarSettings.data = { jobs: 0 }
		await mountPalette()
		await type('job')
		expect(titles()).not.toContain('Jobs')
	})
})
