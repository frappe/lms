/**
 * Category drill-down, and the rows that are gated on a role.
 *
 * The client-side gate here only keeps a row off screen. What a search actually
 * returns is decided by `get_grouped_results` on the server, which is where the
 * permission check that matters lives.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

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
	debounce: (fn: (...args: unknown[]) => void) => fn,
	Dialog: Object.assign(
		{ props: ['open', 'size', 'bare'], template: `<div><slot /></div>` },
		{ Title: { template: `<div><slot /></div>` } }
	),
}))

vi.mock('vue-router', () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

vi.mock('@/components/CommandPalette/CommandPaletteGroup.vue', () => ({
	default: { name: 'PaletteGroup', props: ['list'], template: `<div />` },
}))

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

import CommandPalette from '@/components/CommandPalette/CommandPalette.vue'

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

function build() {
	return mount(CommandPalette, {
		props: { modelValue: true },
		global: { mocks: { __: (globalThis as any).__ } },
	})
}

function rows(wrapper: ReturnType<typeof build>) {
	const list = wrapper
		.findComponent({ name: 'PaletteGroup' })
		.props('list') as any[]
	return list.flatMap((group) => group.items)
}

function titles(wrapper: ReturnType<typeof build>) {
	return rows(wrapper).map((item) => item.title)
}

function press(wrapper: ReturnType<typeof build>, key: string) {
	return wrapper.find('input').trigger('keydown', { key })
}

/** Types `text` and lets the (undebounced) search settle. */
async function type(wrapper: ReturnType<typeof build>, text: string) {
	const input = wrapper.find('input')
	await input.setValue(text)
	await input.trigger('input')
	await nextTick()
}

/** Arrows onto the row with `title` and opens it. */
async function open(wrapper: ReturnType<typeof build>, title: string) {
	const index = titles(wrapper).indexOf(title)
	expect(index).toBeGreaterThanOrEqual(0)
	for (let i = 0; i <= index; i++) await press(wrapper, 'ArrowDown')
	await press(wrapper, 'Enter')
	await nextTick()
}

beforeEach(() => {
	sidebarLinks.value = ADMIN
	user.data = { is_moderator: true }
	settings.isSettingsOpen = false
	settings.isSettingsMounted = true
	settings.sidebarSettings.data = null
	resource.next = []
	resource.params = null
})

describe('command palette categories', () => {
	it('offers a browse row for each category the user may see', () => {
		const wrapper = build()
		expect(titles(wrapper)).toEqual(
			expect.arrayContaining(['Courses', 'Batches', 'Jobs', 'Programs'])
		)
	})

	it.each([
		{ who: 'guest', sidebar: GUEST, offered: false },
		{ who: 'student', sidebar: STUDENT, offered: false },
		{ who: 'admin', sidebar: ADMIN, offered: true },
	])('offers Quizzes to a $who: $offered', ({ sidebar, offered }) => {
		sidebarLinks.value = sidebar
		expect(titles(build()).includes('Quizzes')).toBe(offered)
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
	])('offers Programs to a $who: $offered', ({ sidebar, offered }) => {
		sidebarLinks.value = sidebar
		expect(titles(build()).includes('Programs')).toBe(offered)
	})

	it('never offers a category the sidebar is withholding', () => {
		sidebarLinks.value = GUEST
		const offered = titles(build())
		for (const hidden of ['Programs', 'Quizzes', 'Assignments']) {
			expect(offered).not.toContain(hidden)
		}
		expect(offered).toContain('Courses')
	})

	it('scopes the search to the category that was opened', async () => {
		const wrapper = build()
		await open(wrapper, 'Batches')

		const input = wrapper.find('input')
		await input.setValue('autumn')
		await input.trigger('input')
		await nextTick()

		expect(resource.params).toEqual(
			expect.objectContaining({ query: 'autumn', category: 'batches' })
		)
	})

	it('leaves the search unscoped at the root', async () => {
		const wrapper = build()
		const input = wrapper.find('input')
		await input.setValue('autumn')
		await input.trigger('input')
		await nextTick()

		expect(resource.params.category).toBeUndefined()
	})

	it('backs out of a category on Backspace with an empty query', async () => {
		const wrapper = build()
		await open(wrapper, 'Courses')
		expect(titles(wrapper)).not.toContain('Batches')

		await press(wrapper, 'Backspace')
		await nextTick()

		expect(titles(wrapper)).toContain('Batches')
	})

	it('keeps a query intact when Backspace is a real edit', async () => {
		const wrapper = build()
		await open(wrapper, 'Courses')
		const input = wrapper.find('input')
		await input.setValue('kube')
		await press(wrapper, 'Backspace')
		await nextTick()

		expect(titles(wrapper)).not.toContain('Batches')
	})

	it.each([
		{ role: 'student', data: { is_student: true }, visible: false },
		{ role: 'instructor', data: { is_instructor: true }, visible: false },
		{ role: 'moderator', data: { is_moderator: true }, visible: true },
	])('shows Settings to a $role: $visible', ({ data, visible }) => {
		user.data = { ...data }
		expect(titles(build()).includes('Settings')).toBe(visible)
	})

	// Settings is a dialog mounted by the desktop sidebar; on a phone nothing is
	// listening to the flag, so the row would do nothing at all.
	it('hides Settings when the settings dialog is not mounted', () => {
		settings.isSettingsMounted = false
		expect(titles(build())).not.toContain('Settings')
	})

	// A scope that survived the close reopened the palette silently filtered.
	it('forgets the category once the palette closes', async () => {
		const wrapper = build()
		await open(wrapper, 'Courses')
		expect(titles(wrapper)).not.toContain('Batches')

		await wrapper.setProps({ modelValue: false })
		await nextTick()
		await wrapper.setProps({ modelValue: true })
		await nextTick()

		expect(titles(wrapper)).toContain('Batches')
	})

	it('opens the settings dialog rather than routing', async () => {
		const wrapper = build()
		await open(wrapper, 'Settings')
		expect(settings.isSettingsOpen).toBe(true)
	})
})

/**
 * Rows that only navigate. Statistics is a sidebar page with no records behind
 * it, so it cannot be a searchable category — Enter has to take the user there
 * rather than narrow the search to nothing.
 */
describe('command palette jump-to targets', () => {
	it('offers Statistics', () => {
		expect(titles(build())).toContain('Statistics')
	})

	it('navigates to Statistics rather than scoping the search', async () => {
		const wrapper = build()
		const row = rows(wrapper).find((item) => item.title === 'Statistics')
		expect(row.category).toBeUndefined()
		expect(row.route).toEqual(expect.objectContaining({ name: 'Statistics' }))
	})

	it.each([
		{ label: 'Certifications', route: 'CertifiedParticipants' },
		{ label: 'Programming Exercises', route: 'ProgrammingExercises' },
		{ label: 'Home', route: 'Home' },
	])('offers $label when the sidebar does', ({ label, route }) => {
		sidebarLinks.value = links(route)
		const row = rows(build()).find((item) => item.title === label)
		expect(row?.route).toEqual(expect.objectContaining({ name: route }))
	})

	// Contact Us's `to` is a URL or a mailto address, never a route name, so
	// mapping sidebar entries blindly would push a garbage route.
	it('never offers Contact Us', () => {
		sidebarLinks.value = links(
			'https://example.com/support',
			'help@example.com'
		)
		expect(titles(build())).not.toContain('Contact Us')
		expect(rows(build())).toHaveLength(1) // Settings, from the Account group
	})

	it('withholds a target the sidebar is withholding', () => {
		sidebarLinks.value = links('Courses')
		expect(titles(build())).not.toContain('Statistics')
	})

	it.each(['Statistics', 'Certifications'])(
		'finds %s by typing its name',
		async (label) => {
			const wrapper = build()
			await type(wrapper, label.slice(0, 4).toLowerCase())
			expect(titles(wrapper)).toContain(label)
		}
	)
})

/**
 * Settings lived only in the pre-search browse list, so typing its name emptied
 * the palette and reported "No results found" instead of offering it.
 */
describe('command palette settings row', () => {
	it('finds Settings by typing its name', async () => {
		const wrapper = build()
		await type(wrapper, 'sett')

		expect(titles(wrapper)).toContain('Settings')
	})

	it('still opens the dialog when reached by typing', async () => {
		const wrapper = build()
		await type(wrapper, 'sett')
		await open(wrapper, 'Settings')

		expect(settings.isSettingsOpen).toBe(true)
	})

	it('does not offer Settings to a searching student', async () => {
		user.data = { is_student: true }
		const wrapper = build()
		await type(wrapper, 'sett')

		expect(titles(wrapper)).not.toContain('Settings')
	})
})

/**
 * `getSidebarLinks()` is only half the sidebar's rule. AppSidebar filters its
 * result a second time against `get_sidebar_settings` — the per-site on/off
 * flags — and the palette read only the first half, so a site with Jobs
 * switched off was still offered a Jobs row.
 */
describe('command palette site visibility flags', () => {
	it('withholds a category the site has switched off', () => {
		settings.sidebarSettings.data = { jobs: 0 }
		const offered = titles(build())
		expect(offered).not.toContain('Jobs')
		expect(offered).toContain('Courses')
	})

	it('withholds a nav target the site has switched off', () => {
		settings.sidebarSettings.data = { statistics: 0 }
		expect(titles(build())).not.toContain('Statistics')
	})

	// The flag key is the lowercased, underscored label, so a two-word target
	// only matches if the label is converted the way AppSidebar converts it.
	it('withholds a two-word nav target the site has switched off', () => {
		settings.sidebarSettings.data = { programming_exercises: 0 }
		expect(titles(build())).not.toContain('Programming Exercises')
	})

	it('keeps a row the flags say nothing about', () => {
		settings.sidebarSettings.data = { jobs: 0 }
		expect(titles(build())).toContain('Quizzes')
	})

	it('offers everything while the flags are still unresolved', () => {
		settings.sidebarSettings.data = null
		expect(titles(build())).toContain('Jobs')
	})

	it('withholds a switched-off category from a search too', async () => {
		settings.sidebarSettings.data = { jobs: 0 }
		const wrapper = build()
		await type(wrapper, 'job')
		expect(titles(wrapper)).not.toContain('Jobs')
	})
})
