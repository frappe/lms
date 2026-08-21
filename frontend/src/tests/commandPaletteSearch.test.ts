/**
 * Searching, keyboard navigation and routing in the command palette.
 *
 * Every case here is a bug the palette shipped with: arrowing through search
 * results threw `Cannot set properties of undefined` because no result was ever
 * the active one, Enter therefore did nothing, every non-course hit routed into
 * the batch page, and one typed character blanked the dialog because the results
 * pane took over before the search was allowed to run.
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
		{
			props: ['open', 'size', 'bare'],
			template: `<div><slot /></div>`,
		},
		{ Title: { template: `<div><slot /></div>` } }
	),
}))

const push = vi.fn()
vi.mock('vue-router', () => ({
	useRouter: () => ({ push, replace: vi.fn() }),
}))

// The palette reads roles to decide which category rows to show, which page a
// program hit opens, and — with the settings store — whether Settings can act.
const user = { data: {} as Record<string, unknown> }
vi.mock('@/stores/user', () => ({ usersStore: () => ({ userResource: user }) }))
vi.mock('@/utils', () => ({
	getSidebarLinks: () => [
		{
			items: [
				{ to: 'Courses' },
				{ to: 'Batches' },
				{ to: 'Programs' },
				{ to: 'Jobs' },
				{ to: 'Quizzes' },
				{ to: 'Assignments' },
			],
		},
	],
}))

vi.mock('@/stores/settings', () => ({
	useSettings: () => ({
		isSettingsOpen: false,
		isSettingsMounted: true,
		// The palette filters its rows by these flags as well as by the sidebar.
		sidebarSettings: { data: null },
		loadSidebarSettings: vi.fn(async () => null),
	}),
}))

vi.mock('@/components/CommandPalette/CommandPaletteGroup.vue', () => ({
	default: { name: 'PaletteGroup', props: ['list'], template: `<div />` },
}))

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

const COURSE = {
	doctype: 'LMS Course',
	name: 'kubernetes-in-practice',
	title: 'Kubernetes in Practice',
}
const JOB = {
	doctype: 'Job Opportunity',
	name: 'JOB-0001',
	title: 'Backend Engineer',
}
const BATCH = {
	doctype: 'LMS Batch',
	name: 'batch-01',
	title: 'Autumn Batch',
}

const RESULTS = [
	{ title: 'Courses', items: [COURSE] },
	{ title: 'Batches', items: [BATCH] },
	{ title: 'Job Opportunities', items: [JOB] },
]

function build() {
	return mount(CommandPalette, {
		props: { modelValue: true },
		global: { mocks: { __: (globalThis as any).__ } },
	})
}

/** Types `term`, letting the (synchronously mocked) debounce fire the search. */
async function search(
	wrapper: ReturnType<typeof build>,
	term: string,
	data: unknown = RESULTS
) {
	resource.next = data
	const input = wrapper.find('input')
	await input.setValue(term)
	await input.trigger('input')
	await nextTick()
	await nextTick()
}

function rows(wrapper: ReturnType<typeof build>) {
	const list = wrapper
		.findComponent({ name: 'PaletteGroup' })
		.props('list') as any[]
	return list.flatMap((group) => group.items)
}

function press(wrapper: ReturnType<typeof build>, key: string) {
	return wrapper.find('input').trigger('keydown', { key })
}

beforeEach(() => {
	user.data = { is_moderator: true }
	push.mockClear()
	// The outage case swaps submit() for one that throws, and never puts it
	// back — every later search in the file inherited the failure.
	resource.submit = vi.fn(async (params: any) => {
		resource.params = params
		return resource.next
	})
})

describe('command palette search', () => {
	it('activates the first result when the user arrows down', async () => {
		const wrapper = build()
		await search(wrapper, 'kubernetes')

		await press(wrapper, 'ArrowDown')

		const active = rows(wrapper).filter((item) => item.isActive)
		expect(active).toHaveLength(1)
		expect(active[0].title).toBe(COURSE.title)
	})

	it('opens the active result on Enter', async () => {
		const wrapper = build()
		await search(wrapper, 'kubernetes')

		await press(wrapper, 'ArrowDown')
		await press(wrapper, 'Enter')

		expect(push).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'CourseDetail',
				params: { courseName: COURSE.name },
			})
		)
	})

	it('wraps from the last result back to the first', async () => {
		const wrapper = build()
		await search(wrapper, 'kubernetes')

		for (let i = 0; i < RESULTS.length; i++) await press(wrapper, 'ArrowDown')
		await press(wrapper, 'ArrowDown')

		expect(rows(wrapper).findIndex((item) => item.isActive)).toBe(0)
	})

	it('survives arrowing through an empty result set', async () => {
		const wrapper = build()
		await search(wrapper, 'nothing matches this', [])

		await expect(press(wrapper, 'ArrowDown')).resolves.not.toThrow()
		await expect(press(wrapper, 'ArrowUp')).resolves.not.toThrow()
		expect(rows(wrapper)).toHaveLength(0)
	})

	// Every doctype but LMS Course used to fall through to the batch route, so a
	// job hit navigated to /batches/JOB-0001.
	it.each([
		{
			item: COURSE,
			route: 'CourseDetail',
			params: { courseName: COURSE.name },
		},
		{ item: BATCH, route: 'BatchDetail', params: { batchName: BATCH.name } },
		{ item: JOB, route: 'JobDetail', params: { job: JOB.name } },
		{
			item: { doctype: 'LMS Quiz', name: 'quiz-1', title: 'Week 1 Quiz' },
			route: 'QuizForm',
			params: { quizID: 'quiz-1' },
		},
		{
			item: { doctype: 'LMS Assignment', name: 'ASG-00001', title: 'Essay' },
			route: 'AssignmentForm',
			params: { assignmentID: 'ASG-00001' },
		},
		{
			item: { doctype: 'LMS Program', name: 'Bootcamp', title: 'Bootcamp' },
			route: 'ProgramForm',
			params: { programName: 'Bootcamp' },
		},
	])(
		'routes a $item.doctype hit to $route',
		async ({ item, route, params }) => {
			const wrapper = build()
			await search(wrapper, 'engineer', [{ title: 'Results', items: [item] }])

			const row = rows(wrapper)[0]
			expect(row.route).toEqual(
				expect.objectContaining({ name: route, params })
			)
		}
	)

	it('keeps showing the jump-to list while the query is too short to search', async () => {
		const wrapper = build()
		await search(wrapper, 'k')

		expect(rows(wrapper).length).toBeGreaterThan(0)
	})

	it('offers the matching section page above the hits', async () => {
		const wrapper = build()
		await search(wrapper, 'cour')

		const first = rows(wrapper)[0]
		expect(first.title).toBe('Courses')
		expect(first.route).toEqual(expect.objectContaining({ name: 'Courses' }))
	})

	it('does not offer a section page that the query does not match', async () => {
		const wrapper = build()
		await search(wrapper, 'kubernetes')

		expect(rows(wrapper).map((item) => item.title)).not.toContain('Courses')
	})

	// The guard used to compare against the current query, which cannot tell an
	// older request from a newer one when both are for queries since replaced.
	it('ignores a response that a newer request has already overtaken', async () => {
		const wrapper = build()
		const input = wrapper.find('input')

		let releaseFirst: (value: unknown) => void = () => {}
		const slow = new Promise((resolve) => (releaseFirst = resolve))
		resource.submit = vi.fn(async (params: any) =>
			params.query === 'kub' ? slow : RESULTS
		) as any

		await input.setValue('kub')
		await input.trigger('input')
		await input.setValue('kube')
		await input.trigger('input')
		await nextTick()
		await nextTick()

		const afterNewer = rows(wrapper).map((item: any) => item.title)

		releaseFirst([
			{ title: 'Courses', items: [{ ...COURSE, title: 'Stale hit' }] },
		])
		await nextTick()
		await nextTick()

		expect(rows(wrapper).map((item: any) => item.title)).toEqual(afterNewer)
		expect(rows(wrapper).map((item: any) => item.title)).not.toContain(
			'Stale hit'
		)
	})

	it('says a failed search failed rather than that nothing matched', async () => {
		const wrapper = build()
		resource.submit = vi.fn(async () => {
			throw new Error('500')
		}) as any

		const input = wrapper.find('input')
		await input.setValue('kubernetes')
		await input.trigger('input')
		await nextTick()
		await nextTick()

		expect(wrapper.text()).toContain('Could not search')
		expect(wrapper.text()).not.toContain('No results found')
	})

	it('replaces rather than appends when a second response lands', async () => {
		const wrapper = build()
		await search(wrapper, 'kubernetes')
		await search(wrapper, 'kubernetes again')

		const titles = rows(wrapper).map((item) => item.title)
		expect(new Set(titles).size).toBe(titles.length)
	})
})

/**
 * Where a program hit lands depends on who is searching. Programs.vue renders a
 * student the read-only ProgramDetail page, but gives a moderator or instructor
 * a list whose cards open the ProgramForm modal — so sending everyone to
 * ProgramDetail dropped an author onto the page they cannot edit from.
 */
describe('command palette program routing', () => {
	const PROGRAM = {
		doctype: 'LMS Program',
		name: 'Bootcamp',
		title: 'Bootcamp',
	}

	it.each([
		{ who: 'moderator', data: { is_moderator: true }, route: 'ProgramForm' },
		{ who: 'instructor', data: { is_instructor: true }, route: 'ProgramForm' },
		{ who: 'student', data: { is_student: true }, route: 'ProgramDetail' },
		{ who: 'evaluator', data: { is_evaluator: true }, route: 'ProgramDetail' },
	])('sends a $who to $route', async ({ data, route }) => {
		user.data = { ...data }
		const wrapper = build()
		await search(wrapper, 'bootcamp', [{ title: 'Results', items: [PROGRAM] }])

		expect(rows(wrapper)[0].route).toEqual(
			expect.objectContaining({
				name: route,
				params: { programName: 'Bootcamp' },
			})
		)
	})

	// read_only_mode is what Programs.vue gates its own card click on, so the
	// palette must not offer an edit route the page itself would refuse.
	it('sends a moderator to ProgramDetail in read-only mode', async () => {
		;(window as any).read_only_mode = true
		try {
			const wrapper = build()
			await search(wrapper, 'bootcamp', [
				{ title: 'Results', items: [PROGRAM] },
			])
			expect(rows(wrapper)[0].route).toEqual(
				expect.objectContaining({ name: 'ProgramDetail' })
			)
		} finally {
			;(window as any).read_only_mode = false
		}
	})
})

/**
 * ProgramForm and AssignmentForm are child routes that render as a modal over
 * their list page, and both pages open them through openFormRoute so that Back
 * closes the modal. A bare push leaves no marker, which degrades the form's
 * close from a pop into a replace.
 */
describe('command palette form routes', () => {
	it.each([
		{
			who: 'a program',
			item: { doctype: 'LMS Program', name: 'Bootcamp', title: 'Bootcamp' },
		},
		{
			who: 'an assignment',
			item: { doctype: 'LMS Assignment', name: 'ASG-1', title: 'Essay' },
		},
	])('marks the history entry when opening $who', async ({ item }) => {
		const wrapper = build()
		await search(wrapper, 'thing', [{ title: 'Results', items: [item] }])
		await press(wrapper, 'ArrowDown')
		await press(wrapper, 'Enter')
		await nextTick()

		expect(push).toHaveBeenCalledWith(
			expect.objectContaining({ state: { lmsFormEntry: true } })
		)
	})

	// QuizForm is a top-level route, and the quiz list reaches it with a plain
	// row link — there is no modal to keep on the stack.
	it('leaves a quiz hit as an ordinary push', async () => {
		const wrapper = build()
		await search(wrapper, 'week', [
			{
				title: 'Results',
				items: [{ doctype: 'LMS Quiz', name: 'quiz-1', title: 'Week 1' }],
			},
		])
		await press(wrapper, 'ArrowDown')
		await press(wrapper, 'Enter')
		await nextTick()

		expect(push).toHaveBeenCalledWith(
			expect.not.objectContaining({ state: expect.anything() })
		)
	})
})

/**
 * The keys were bound to the `<input>`, so tabbing to a result button — the
 * only other thing in the dialog that takes focus — killed the arrows and
 * Enter. They belong to the panel, above both.
 */
describe('command palette keyboard scope', () => {
	const fromResults = (wrapper: ReturnType<typeof build>, key: string) =>
		wrapper.find('#command-palette-results').trigger('keydown', { key })

	it('takes ArrowDown from outside the input', async () => {
		const wrapper = build()
		await search(wrapper, 'kubernetes')

		await fromResults(wrapper, 'ArrowDown')

		const active = rows(wrapper).filter((item) => item.isActive)
		expect(active).toHaveLength(1)
		expect(active[0].title).toBe(COURSE.title)
	})

	it('takes Enter from outside the input', async () => {
		const wrapper = build()
		await search(wrapper, 'kubernetes')

		await fromResults(wrapper, 'ArrowDown')
		await fromResults(wrapper, 'Enter')

		expect(push).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'CourseDetail' })
		)
	})
})

/**
 * Narrowing to a category does not abort the request the root search left in
 * flight, so its answer used to land inside the category and fill it with rows
 * from outside it.
 */
describe('command palette scope changes', () => {
	it('drops the root search once a category has been opened', async () => {
		// One releaser per request, so the root's answer can be made to land
		// after the user has already narrowed to Batches.
		const releases: Array<(value: unknown) => void> = []
		resource.submit = vi.fn(
			() => new Promise((resolve) => releases.push(resolve))
		) as any

		const wrapper = build()
		const input = wrapper.find('input')
		await input.setValue('batc')
		await input.trigger('input')
		await nextTick()
		const rootRequests = releases.splice(0)
		expect(rootRequests.length).toBeGreaterThan(0)

		// Back to the browse list, then into the Batches category.
		await input.setValue('')
		await input.trigger('input')
		await nextTick()
		const index = rows(wrapper).findIndex((item) => item.title === 'Batches')
		expect(index).toBeGreaterThanOrEqual(0)
		for (let i = 0; i <= index; i++) await press(wrapper, 'ArrowDown')
		await press(wrapper, 'Enter')
		await nextTick()

		for (const release of rootRequests) release(RESULTS)
		await nextTick()
		await nextTick()

		// Searching inside the category is what draws whatever is held; the
		// second request is left in flight so nothing overwrites it first.
		await input.setValue('kub')
		await input.trigger('input')
		await nextTick()

		expect(rows(wrapper).map((item) => item.title)).not.toContain(COURSE.title)
	})
})

/**
 * A section row matching the query is enough to fill the list, which is what
 * used to hide an outage behind it: the error was only drawn when nothing at
 * all had been found.
 */
describe('command palette outage reporting', () => {
	it('reports an outage even when a section row matched the query', async () => {
		const wrapper = build()
		resource.submit = vi.fn(async () => {
			throw new Error('500')
		}) as any

		const input = wrapper.find('input')
		await input.setValue('cour')
		await input.trigger('input')
		await nextTick()
		await nextTick()

		expect(rows(wrapper).map((item) => item.title)).toContain('Courses')
		expect(wrapper.text()).toContain('Could not search')
	})
})

/**
 * Results the visible query no longer matches.
 *
 * Going from one valid query to another leaves `isSearching` true, so the query
 * watcher's clear branch never runs and the previous rows stay on screen for the
 * debounce plus the replacement request. That is deliberate — clearing them per
 * keystroke is the blink 5af4bf830 fixed — but they must not stay *selectable*,
 * or Enter opens a row belonging to a query the user has already replaced.
 */
describe('command palette stale results', () => {
	const KUBE = { title: 'Courses', items: [COURSE] }

	/** Starts a second search and leaves its response in flight. */
	async function retype(wrapper: ReturnType<typeof build>, term: string) {
		resource.submit = vi.fn(() => new Promise(() => {}))
		const input = wrapper.find('input')
		await input.setValue(term)
		await input.trigger('input')
		await nextTick()
	}

	it('keeps the previous rows on screen, so the list does not blink', async () => {
		const wrapper = build()
		await search(wrapper, 'kube', [KUBE])
		await retype(wrapper, 'docker')

		expect(rows(wrapper).map((item) => item.title)).toContain(COURSE.title)
	})

	it('does not open a stale row on Enter', async () => {
		const wrapper = build()
		await search(wrapper, 'kube', [KUBE])
		await retype(wrapper, 'docker')

		await press(wrapper, 'Enter')
		await nextTick()

		expect(push).not.toHaveBeenCalled()
	})

	it('does not let the arrows reach a stale row', async () => {
		const wrapper = build()
		await search(wrapper, 'kube', [KUBE])
		await retype(wrapper, 'docker')

		await press(wrapper, 'ArrowDown')
		await press(wrapper, 'Enter')
		await nextTick()

		expect(push).not.toHaveBeenCalled()
	})

	it('does not open a stale row on click', async () => {
		const wrapper = build()
		await search(wrapper, 'kube', [KUBE])
		await retype(wrapper, 'docker')

		const stale = rows(wrapper).find((item) => item.title === COURSE.title)
		wrapper.findComponent({ name: 'PaletteGroup' }).vm.$emit('select', stale)
		await nextTick()

		expect(push).not.toHaveBeenCalled()
	})

	// A live section row is computed from the current query, so it stays usable
	// while the hits behind it are stale.
	it('still opens a section that matches the new query', async () => {
		const wrapper = build()
		await search(wrapper, 'kube', [KUBE])
		await retype(wrapper, 'cour')

		await press(wrapper, 'Enter')
		await nextTick()

		expect(push).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'Courses' })
		)
	})

	it('makes the rows selectable again once the new results land', async () => {
		const wrapper = build()
		await search(wrapper, 'kube', [KUBE])
		await retype(wrapper, 'docker')

		// retype() leaves the request hanging; let the next one answer.
		resource.submit = vi.fn(async (params: any) => {
			resource.params = params
			return resource.next
		})
		await search(wrapper, 'docker', [
			{ title: 'Courses', items: [{ ...COURSE, name: 'docker-deep-dive' }] },
		])

		await press(wrapper, 'Enter')
		await nextTick()

		expect(push).toHaveBeenCalledWith(
			expect.objectContaining({ params: { courseName: 'docker-deep-dive' } })
		)
	})
})
