// Guards the inline lesson exercise sharing the lesson's router, window, head.
// Came with this branch's change rendering the programming exercise inline.
// Added on feat/assessment-visual-redesign; the old iframe isolated them all.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, reactive } from 'vue'

const {
	call,
	routerPush,
	pageMeta,
	collectOutputs,
	runner,
	documentCache,
	saved,
	toast,
} = vi.hoisted(() => ({
	documentCache: new Map<string, { reload: () => void }>(),
	// The rows the server's own run stored, which reload() hands back.
	saved: {
		rows: [] as Record<string, unknown>[],
		doc: {} as Record<string, unknown>,
	},
	toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
	runner: { url: '' },
	call: vi.fn(),
	routerPush: vi.fn(),
	pageMeta: vi.fn(),
	collectOutputs: vi.fn(async () => ({ outputs: ['5'], elapsed: [0.1] })),
}))

vi.mock('frappe-ui', () => ({
	Badge: defineComponent({
		setup:
			(_p, { slots }) =>
			() =>
				h('span', slots.default?.()),
	}),
	Button: defineComponent({
		setup:
			(_p, { slots }) =>
			() =>
				h('button', slots.default?.()),
	}),
	call: (...args: unknown[]) => call(...args),
	// reload() lands the saved row, owned by the learner, as the server would.
	// Cached by name, as frappe-ui's documentResource.js does.
	createDocumentResource: (options: { name: string }) => {
		if (documentCache.has(options.name)) return documentCache.get(options.name)
		const resource = reactive({
			doc: null as Record<string, unknown> | null,
			name: options.name,
			reload: () => {},
		})
		resource.reload = () => {
			resource.doc = {
				name: resource.name,
				owner: 'learner@example.com',
				status: 'Passed',
				code: 'print(1)',
				test_cases: saved.rows,
				...saved.doc,
			}
		}
		documentCache.set(options.name, resource)
		return resource
	},
	Skeleton: defineComponent({ render: () => h('div') }),
	toast,
	usePageMeta: pageMeta,
}))

vi.mock('@/router', () => ({
	default: {
		push: routerPush,
		currentRoute: { value: { query: {} } },
	},
}))
vi.mock('@/components/ProgrammingExercises/ExerciseWorkspace.vue', () => ({
	default: defineComponent({
		props: { submissionStatus: String, results: Array },
		emits: ['run'],
		setup: (props, { emit, slots }) => {
			return () => [
				h('button', { 'data-testid': 'workspace', onClick: () => emit('run') }),
				props.submissionStatus,
				h(
					'span',
					{ 'data-testid': 'result-statuses' },
					(props.results as { status: string }[] | undefined)
						?.map((row) => row.status)
						.join(',')
				),
				slots.editor?.(),
			]
		},
	}),
}))
vi.mock('@/components/ProgrammingExercises/ExerciseCodeEditor.vue', () => ({
	default: defineComponent({
		props: ['modelValue', 'readonly'],
		setup: (props) => () =>
			h(
				'pre',
				{ 'data-testid': 'code', 'data-readonly': String(!!props.readonly) },
				props.modelValue
			),
	}),
}))
vi.mock('@/components/Layouts/pages/PageHeader.vue', () => ({
	default: defineComponent({
		render: () => h('div', { 'data-testid': 'page-header' }),
	}),
}))
vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ brand: { favicon: '' } }),
}))
vi.mock('@/stores/settings', () => ({
	useSettings: () => ({
		settings: {
			data: { livecode_url: runner.url },
			promise: Promise.resolve(),
		},
	}),
}))
vi.mock('@/utils', () => ({ openSettings: vi.fn() }))
vi.mock('@/utils/dialogs', () => ({
	createDialog: vi.fn(),
	isDialogOpen: () => false,
}))
vi.mock('@/utils/basePath', () => ({ getLmsRoute: (p: string) => `/lms/${p}` }))
vi.mock(
	'@/pages/ProgrammingExercises/exerciseRunFlow',
	async (importOriginal) => ({
		...(await importOriginal<object>()),
		collectOutputs,
	})
)

import ProgrammingExerciseSubmission from '@/pages/ProgrammingExercises/ProgrammingExerciseSubmission.vue'

const exercise = {
	name: 'EX-1',
	title: 'Two sum',
	language: 'Python',
	problem_statement: '<p>Add two integers.</p>',
	starter_code: null,
	test_cases: [{ idx: 1, input: '2 3', hidden: 0, expected_output: '5' }],
}

const CREATE = 'lms.lms.api.create_programming_exercise_submission'

let wrappers: VueWrapper[] = []
let block: HTMLDivElement

const mountEmbedded = async (
	user: unknown = { data: { name: 'learner@example.com' } },
	embedded = true,
	submissionID = 'new'
) => {
	const host = document.createElement('div')
	block.append(host)
	const wrapper = mount(ProgrammingExerciseSubmission, {
		props: { exerciseID: 'EX-1', submissionID, embedded },
		attachTo: host,
		global: {
			provide: { $user: user },
			mocks: { __: (value: string) => value },
		},
	})
	wrappers.push(wrapper)
	await flushPromises()
	document.head
		.querySelectorAll('script[src$="livecode.js"]')
		.forEach((script) => script.dispatchEvent(new Event('load')))
	await flushPromises()
	return wrapper
}

const scoredRun = [{ idx: 1, status: 'Passed', output: '5' }]

const runCode = async (wrapper: VueWrapper) => {
	await wrapper.get('[data-testid="workspace"]').trigger('click')
	await flushPromises()
}

beforeEach(() => {
	documentCache.clear()
	saved.rows = []
	saved.doc = {}
	toast.success.mockClear()
	toast.warning.mockClear()
	call.mockReset()
	call.mockImplementation((method: string) => {
		if (method === 'lms.lms.api.get_programming_exercise')
			return Promise.resolve(exercise)
		if (method === CREATE) return Promise.resolve('SUB-1')
		if (method === 'lms.lms.api.evaluate_programming_exercise')
			return Promise.resolve(scoredRun)
		return Promise.resolve()
	})
	routerPush.mockReset()
	pageMeta.mockReset()
	collectOutputs.mockClear()
	localStorage.clear()
	document.head
		.querySelectorAll('script[src$="livecode.js"]')
		.forEach((script) => script.remove())
	block = document.createElement('div')
	block.setAttribute('data-assessment-block', '')
	document.body.append(block)
})

afterEach(() => {
	for (const wrapper of wrappers) wrapper.unmount()
	wrappers = []
	document.body.replaceChildren()
})

describe('the programming exercise mounted inline in a lesson', () => {
	it('saves the second run into the submission the first one created', async () => {
		const wrapper = await mountEmbedded()

		await runCode(wrapper)
		await runCode(wrapper)

		const submissions = call.mock.calls
			.filter(([method]) => method === CREATE)
			.map(([, args]) => args.submission)
		expect(submissions).toEqual(['new', 'SUB-1'])
	})

	// Guards unsaved blocks sharing frappe-ui's cached 'new' resource, so a run
	// in one showed in the others. Broke with this branch's inline exercise.
	// Added on feat/assessment-visual-redesign when a lesson could hold several.
	// Guards the screen showing the browser's run while the saved verdict is the
	// server's own run of the code. Came with the server running a save itself.
	// Added on fix-1 so the two can never disagree on screen.
	it("replaces this run's results with the saved ones and says so when they differ", async () => {
		saved.rows = [
			{
				idx: 1,
				input: '2 3',
				output: '7',
				expected_output: '5',
				status: 'Failed',
			},
		]
		const wrapper = await mountEmbedded()

		await runCode(wrapper)

		expect(wrapper.get('[data-testid="result-statuses"]').text()).toBe('Failed')
		expect(toast.warning).toHaveBeenCalled()
		expect(toast.success).not.toHaveBeenCalled()
	})

	it('confirms the save when the saved results match this run', async () => {
		saved.rows = [
			{
				idx: 1,
				input: '2 3',
				output: '5',
				expected_output: '5',
				status: 'Passed',
			},
		]
		const wrapper = await mountEmbedded()

		await runCode(wrapper)

		expect(wrapper.get('[data-testid="result-statuses"]').text()).toBe('Passed')
		expect(toast.success).toHaveBeenCalled()
	})

	// Guards edited boilerplate being added back on reload, running it twice: a
	// second `const fs` breaks JavaScript. Added on fix-1 with full_code.
	it('loads code stored whole as it is, without adding the boilerplate', async () => {
		saved.doc = { code: 'import sys\nprint(sys.stdin.read())', full_code: 1 }

		const wrapper = await mountEmbedded(undefined, true, 'SUB-9')

		expect(wrapper.get('[data-testid="code"]').text()).toBe(
			'import sys\nprint(sys.stdin.read())'
		)
	})

	it('adds the boilerplate back to code stored without it', async () => {
		saved.doc = { code: 'print(inputs[0])', full_code: 0 }

		const wrapper = await mountEmbedded(undefined, true, 'SUB-9')

		const editor = wrapper.get('[data-testid="code"]').text()
		expect(editor.startsWith('with open("stdin"')).toBe(true)
		expect(editor.endsWith('print(inputs[0])')).toBe(true)
	})

	// Guards edits typed while the server grades being wiped when the save lands.
	// Added on fix-1, when saving started to take seconds.
	it('locks the editor until the save finishes', async () => {
		let finishSave: (name: string) => void = () => {}
		call.mockImplementation((method: string) => {
			if (method === 'lms.lms.api.get_programming_exercise')
				return Promise.resolve(exercise)
			if (method === CREATE)
				return new Promise((resolve) => (finishSave = resolve))
			if (method === 'lms.lms.api.evaluate_programming_exercise')
				return Promise.resolve(scoredRun)
			return Promise.resolve()
		})
		const wrapper = await mountEmbedded()

		await runCode(wrapper)
		expect(
			wrapper.get('[data-testid="code"]').attributes('data-readonly')
		).toBe('true')

		finishSave('SUB-1')
		await flushPromises()
		expect(
			wrapper.get('[data-testid="code"]').attributes('data-readonly')
		).toBe('false')
	})

	it("keeps one block's submission out of another unsubmitted block", async () => {
		const first = await mountEmbedded()
		const second = await mountEmbedded()

		await runCode(first)

		expect(first.text()).toContain('Passed')
		expect(second.text()).not.toContain('Passed')
	})

	// Guards a loaded page saving itself as a draft that then beat the submission.
	// Broke with this branch's autosave of the learner's in-progress code.
	// Added on feat/assessment-visual-redesign with the fix to that watcher.
	it('writes no draft until the learner edits the code', async () => {
		vi.useFakeTimers()
		await mountEmbedded()
		await vi.advanceTimersByTimeAsync(1000)
		vi.useRealTimers()

		expect(localStorage.length).toBe(0)
	})

	// Guards a saved submission reopening with the boilerplate above its code.
	// Broke with this branch's starter code and hidden test cases change.
	// Added on feat/assessment-visual-redesign with the fix.
	it('reopens a starter-code submission without the boilerplate', async () => {
		call.mockImplementation((method: string) =>
			method === 'lms.lms.api.get_programming_exercise'
				? Promise.resolve({ ...exercise, starter_code: 'x = 1\n' })
				: Promise.resolve()
		)
		const wrapper = await mountEmbedded(undefined, true, 'SUB-9')
		documentCache.get('SUB-9')!.reload()
		await flushPromises()

		expect(wrapper.get('[data-testid="code"]').text()).toBe('print(1)')
	})

	it('never moves the lesson to another route', async () => {
		const wrapper = await mountEmbedded()

		await runCode(wrapper)

		expect(routerPush).not.toHaveBeenCalled()
	})

	it('still opens the new submission on the standalone page', async () => {
		const wrapper = await mountEmbedded(undefined, false)

		await runCode(wrapper)

		expect(routerPush).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'ProgrammingExerciseSubmission',
				params: { exerciseID: 'EX-1', submissionID: 'SUB-1' },
			})
		)
	})

	it('leaves the lesson tab title and header alone', async () => {
		const wrapper = await mountEmbedded()

		expect(pageMeta).not.toHaveBeenCalled()
		expect(wrapper.find('[data-testid="page-header"]').exists()).toBe(false)
	})

	it('still titles the standalone page', async () => {
		await mountEmbedded(undefined, false)

		expect(pageMeta).toHaveBeenCalled()
	})

	it('runs on Mod+Enter only when the key is pressed inside its block', async () => {
		await mountEmbedded()
		const inside = block.querySelector('[data-testid="workspace"]')!

		document.body.dispatchEvent(
			new KeyboardEvent('keydown', {
				key: 'Enter',
				ctrlKey: true,
				bubbles: true,
			})
		)
		await flushPromises()
		expect(collectOutputs).not.toHaveBeenCalled()

		inside.dispatchEvent(
			new KeyboardEvent('keydown', {
				key: 'Enter',
				ctrlKey: true,
				bubbles: true,
			})
		)
		await flushPromises()
		expect(collectOutputs).toHaveBeenCalledTimes(1)
	})

	it('loads livecode.js once for two exercises on one lesson', async () => {
		// The loader is memoised per URL, so use a runner no other test asked for.
		runner.url = 'https://runner.example.com'
		await mountEmbedded()
		await mountEmbedded()
		runner.url = ''

		expect(
			document.head.querySelectorAll(
				'script[src="https://runner.example.com/static/livecode.js"]'
			)
		).toHaveLength(1)
	})
})
