/**
 * Searching and routing in the command palette.
 *
 * Every case here is a bug the palette shipped with: every non-course hit
 * routed into the batch page, and one typed character blanked the dialog
 * because the results pane took over before the search was allowed to run.
 * Arrow-key highlighting and Enter-to-select are `frappe-ui/experimental`'s own
 * `CommandPalette` behaviour now — the library's own test suite covers that;
 * these tests drive selection with a click, which reaches the same LMS-owned
 * `onSelect` handler.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	clickItem,
	mountPalette,
	paletteInput,
	paletteItemValues,
	paletteText,
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

const push = vi.fn()
// currentRoute and options.history are part of the stub because openFormRoute
// reads both: it stamps the location it is leaving into history.state so
// App.vue can keep that page rendered under the form's dialog.
vi.mock('vue-router', () => ({
	useRouter: () => ({
		push,
		replace: vi.fn(),
		currentRoute: { value: { fullPath: '/courses', matched: [{}] } },
		options: { history: { state: {} } },
	}),
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

/** Types `term`, letting the (undebounced) search settle. */
async function search(term: string, data: unknown = RESULTS) {
	resource.next = data
	await type(term)
}

function titles() {
	return paletteItemValues().map((item) => item.title)
}

/** Selects the row with `title`. */
async function select(title: string) {
	await clickItem((item) => item.title === title)
}

beforeEach(async () => {
	user.data = { is_moderator: true }
	push.mockClear()
	// The outage case swaps submit() for one that throws, and never puts it
	// back — every later search in the file inherited the failure.
	resource.submit = vi.fn(async (params: any) => {
		resource.params = params
		return resource.next
	})
	await mountPalette()
})

describe('command palette search', () => {
	it('opens the result the user selects', async () => {
		await search('kubernetes')
		await select(COURSE.title)

		expect(push).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'CourseDetail',
				params: { courseName: COURSE.name },
			})
		)
	})

	it('survives searching to an empty result set', async () => {
		await expect(search('nothing matches this', [])).resolves.not.toThrow()
		expect(paletteItemValues()).toHaveLength(0)
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
			await search('engineer', [{ title: 'Results', items: [item] }])

			const row = paletteItemValues()[0]
			expect(row.route).toEqual(
				expect.objectContaining({ name: route, params })
			)
		}
	)

	it('keeps showing the jump-to list while the query is too short to search', async () => {
		await search('k')

		expect(titles().length).toBeGreaterThan(0)
	})

	it('offers the matching section page above the hits', async () => {
		await search('cour')

		const first = paletteItemValues()[0]
		expect(first.title).toBe('Courses')
		expect(first.route).toEqual(expect.objectContaining({ name: 'Courses' }))
	})

	it('does not offer a section page that the query does not match', async () => {
		await search('kubernetes')

		expect(titles()).not.toContain('Courses')
	})

	// The guard used to compare against the current query, which cannot tell an
	// older request from a newer one when both are for queries since replaced.
	it('ignores a response that a newer request has already overtaken', async () => {
		let releaseFirst: (value: unknown) => void = () => {}
		const slow = new Promise((resolve) => (releaseFirst = resolve))
		resource.submit = vi.fn(async (params: any) =>
			params.query === 'kub' ? slow : RESULTS
		) as any

		await type('kub')
		await type('kube')

		const afterNewer = titles()

		releaseFirst([
			{ title: 'Courses', items: [{ ...COURSE, title: 'Stale hit' }] },
		])
		await type('kube') // no-op change, just lets the release's response land

		expect(titles()).toEqual(afterNewer)
		expect(titles()).not.toContain('Stale hit')
	})

	it('says a failed search failed rather than that nothing matched', async () => {
		resource.submit = vi.fn(async () => {
			throw new Error('500')
		}) as any

		await type('kubernetes')

		expect(paletteText()).toContain('Could not search')
		expect(paletteText()).not.toContain('No results found')
	})

	it('replaces rather than appends when a second response lands', async () => {
		await search('kubernetes')
		await search('kubernetes again')

		expect(new Set(titles()).size).toBe(titles().length)
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
		await search('bootcamp', [{ title: 'Results', items: [PROGRAM] }])

		expect(paletteItemValues()[0].route).toEqual(
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
			await search('bootcamp', [{ title: 'Results', items: [PROGRAM] }])
			expect(paletteItemValues()[0].route).toEqual(
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
		await search('thing', [{ title: 'Results', items: [item] }])
		await select(item.title)

		expect(push).toHaveBeenCalledWith(
			expect.objectContaining({
				state: { lmsFormEntry: true, lmsFormBackground: '/courses' },
			})
		)
	})

	// QuizForm is a top-level route, and the quiz list reaches it with a plain
	// row link — there is no modal to keep on the stack.
	it('leaves a quiz hit as an ordinary push', async () => {
		await search('week', [
			{
				title: 'Results',
				items: [{ doctype: 'LMS Quiz', name: 'quiz-1', title: 'Week 1' }],
			},
		])
		await select('Week 1')

		expect(push).toHaveBeenCalledWith(
			expect.not.objectContaining({ state: expect.anything() })
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

		await type('batc')
		const rootRequests = releases.splice(0)
		expect(rootRequests.length).toBeGreaterThan(0)

		// Back to the browse list, then into the Batches category.
		await type('')
		await select('Batches')

		for (const release of rootRequests) release(RESULTS)
		await type('kub')

		expect(titles()).not.toContain(COURSE.title)
	})
})

/**
 * A section row matching the query is enough to fill the list, which is what
 * used to hide an outage behind it: the error was only drawn when nothing at
 * all had been found.
 */
describe('command palette outage reporting', () => {
	it('reports an outage even when a section row matched the query', async () => {
		resource.submit = vi.fn(async () => {
			throw new Error('500')
		}) as any

		await type('cour')

		expect(titles()).toContain('Courses')
		expect(paletteText()).toContain('Could not search')
	})
})

/**
 * Results the visible query no longer matches.
 *
 * Going from one valid query to another leaves `isSearching` true, so the query
 * watcher's clear branch never runs and the previous rows stay on screen for the
 * debounce plus the replacement request. That is deliberate — clearing them per
 * keystroke is the blink 5af4bf830 fixed — but they must not stay *selectable*,
 * or selecting one opens a row belonging to a query the user has already
 * replaced.
 */
describe('command palette stale results', () => {
	const KUBE = { title: 'Courses', items: [COURSE] }

	/** Starts a second search and leaves its response in flight. */
	async function retype(term: string) {
		resource.submit = vi.fn(() => new Promise(() => {}))
		await type(term)
	}

	it('keeps the previous rows on screen, so the list does not blink', async () => {
		await search('kube', [KUBE])
		await retype('docker')

		expect(titles()).toContain(COURSE.title)
	})

	it('does not open a stale row when clicked', async () => {
		await search('kube', [KUBE])
		await retype('docker')

		await select(COURSE.title)

		expect(push).not.toHaveBeenCalled()
	})

	// A live section row is computed from the current query, so it stays usable
	// while the hits behind it are stale.
	it('still opens a section that matches the new query', async () => {
		await search('kube', [KUBE])
		await retype('cour')

		await select('Courses')

		expect(push).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'Courses' })
		)
	})

	it('makes the rows selectable again once the new results land', async () => {
		await search('kube', [KUBE])
		await retype('docker')

		// retype() leaves the request hanging; let the next one answer. The
		// query goes through a real edit first — setting it back to the exact
		// text already in the (Vue-reactive) model would not register as a
		// change and the search would never re-run.
		resource.submit = vi.fn(async (params: any) => {
			resource.params = params
			return resource.next
		})
		await type('docke')
		await search('docker', [
			{ title: 'Courses', items: [{ ...COURSE, name: 'docker-deep-dive' }] },
		])

		await select(COURSE.title)

		expect(push).toHaveBeenCalledWith(
			expect.objectContaining({ params: { courseName: 'docker-deep-dive' } })
		)
	})
})

/**
 * Backspace on an empty query, at the root, is an ordinary edit — there is no
 * category to back out of.
 */
describe('command palette root keyboard handling', () => {
	it('does nothing surprising on Backspace at the root', async () => {
		await expect(
			keydown(paletteInput(), 'Backspace')
		).resolves.not.toThrow()
	})
})
