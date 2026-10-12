import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h, reactive } from 'vue'

const workspaceProps: Record<string, unknown>[] = []
const call = vi.fn()
const loadedSubmissions: string[] = []

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
	createDocumentResource: ({ name }: { name: string }) =>
		reactive({ doc: null, reload: () => loadedSubmissions.push(name) }),
	Skeleton: defineComponent({ render: () => h('div') }),
	toast: { error: vi.fn(), success: vi.fn() },
	usePageMeta: vi.fn(),
}))

vi.mock('@/components/ProgrammingExercises/ExerciseWorkspace.vue', () => ({
	default: defineComponent({
		props: [
			'title',
			'language',
			'problemStatement',
			'results',
			'consoleLines',
			'duration',
			'running',
			'canRun',
			'saved',
		],
		setup(props) {
			return () => {
				workspaceProps.push({ ...props })
				return h('div')
			}
		},
	}),
}))

vi.mock('@/components/ProgrammingExercises/ExerciseCodeEditor.vue', () => ({
	default: defineComponent({ props: ['modelValue'], render: () => h('div') }),
}))
vi.mock('@/components/Layouts/pages/PageHeader.vue', () => ({
	default: defineComponent({ props: ['breadcrumbs'], render: () => h('div') }),
}))
vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ brand: { favicon: '' } }),
}))
vi.mock('@/stores/settings', () => ({
	useSettings: () => ({
		settings: { data: { livecode_url: '' }, promise: Promise.resolve() },
	}),
}))
vi.mock('@/utils', () => ({ openSettings: vi.fn() }))
vi.mock('@/utils/dialogs', () => ({
	createDialog: vi.fn(),
	isDialogOpen: () => false,
}))
vi.mock('@/utils/basePath', () => ({ getLmsRoute: (p: string) => `/lms/${p}` }))
vi.mock('@/router', () => ({ default: { push: vi.fn() } }))

import ProgrammingExerciseSubmission from '@/pages/ProgrammingExercises/ProgrammingExerciseSubmission.vue'

const exerciseOne = {
	name: 'EX-1',
	title: 'Two sum',
	language: 'Python',
	problem_statement: '<p>Add two integers.</p>',
	starter_code: null,
	test_cases: [
		{ idx: 1, input: '2 3', hidden: 0, expected_output: '5' },
		{ idx: 2, input: '0 0', hidden: 0, expected_output: '0' },
	],
}

const makeRouter = () =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: '/programming-exercise-submission/:exerciseID/:submissionID',
				name: 'ProgrammingExerciseSubmission',
				component: defineComponent({ render: () => h('div') }),
			},
			{
				path: '/courses',
				name: 'Courses',
				component: defineComponent({ render: () => h('div') }),
			},
		],
	})

const mountPage = async () => {
	const router = makeRouter()
	await router.push('/programming-exercise-submission/EX-1/new')
	await router.isReady()
	const wrapper = mount(ProgrammingExerciseSubmission, {
		props: { exerciseID: 'EX-1', submissionID: 'new' },
		global: {
			plugins: [router],
			provide: { $user: { data: { name: 'learner@example.com' } } },
			mocks: { __: (value: string) => value },
		},
	})
	await flushPromises()
	return wrapper
}

const lastWorkspaceProps = () => workspaceProps[workspaceProps.length - 1]

beforeEach(() => {
	loadedSubmissions.length = 0
	workspaceProps.length = 0
	call.mockReset()
	localStorage.clear()
})

// Guards a failed reload leaving exercise A's problem and results under B's
// URL. Page came in #1593; broke with this branch's results restore.
// Added on feat/assessment-visual-redesign with the fix.
describe('the programming exercise page, pointed at another exercise', () => {
	it('drops the old exercise when the new one fails to load', async () => {
		call.mockResolvedValueOnce(exerciseOne)
		const wrapper = await mountPage()
		expect(lastWorkspaceProps().title).toBe('Two sum')

		call.mockRejectedValueOnce(new Error('Not permitted'))
		await wrapper.setProps({ exerciseID: 'EX-2' })
		await flushPromises()

		expect(lastWorkspaceProps().title).toBe('')
		expect(lastWorkspaceProps().problemStatement).toBe('')
		expect(lastWorkspaceProps().results).toEqual([])
	})

	it('shows the new exercise when the reload succeeds', async () => {
		call.mockResolvedValueOnce(exerciseOne)
		const wrapper = await mountPage()

		call.mockResolvedValueOnce({
			...exerciseOne,
			name: 'EX-2',
			title: 'Palindrome',
			problem_statement: '<p>Reverse a string.</p>',
		})
		await wrapper.setProps({ exerciseID: 'EX-2' })
		await flushPromises()

		expect(lastWorkspaceProps().title).toBe('Palindrome')
		expect(lastWorkspaceProps().problemStatement).toBe(
			'<p>Reverse a string.</p>'
		)
	})
})

// Guards a repointed page keeping the old submission's code and results.
// Page came in #1593; broke with this branch's exercise workspace rework.
// Added on feat/assessment-visual-redesign with the repoint fix.
describe('the programming exercise page, pointed at another submission', () => {
	it('loads the new submission and drops the old run', async () => {
		call.mockResolvedValue(exerciseOne)
		const wrapper = await mountPage()
		;(wrapper.vm as any).results = [{ idx: 1, status: 'Passed' }]

		await wrapper.setProps({ submissionID: 'SUB-2' })
		await flushPromises()

		expect(loadedSubmissions).toEqual(['SUB-2'])
		expect(lastWorkspaceProps().results).toEqual([])
	})
})

// Guards the skeleton card standing in until the exercise lands.
// Came with this branch's exercise skeleton card.
// Added on feat/assessment-visual-redesign; the workspace waits for the load.
describe('the programming exercise page while the exercise loads', () => {
	it('shows the skeleton card until the exercise lands', async () => {
		let resolve: (value: unknown) => void = () => {}
		call.mockReturnValueOnce(new Promise((done) => (resolve = done)))
		const wrapper = await mountPage()

		expect(wrapper.find('[data-testid="exercise-skeleton"]').exists()).toBe(
			true
		)
		expect(workspaceProps).toHaveLength(0)

		resolve(exerciseOne)
		await flushPromises()

		expect(wrapper.find('[data-testid="exercise-skeleton"]').exists()).toBe(
			false
		)
		expect(lastWorkspaceProps().title).toBe('Two sum')
	})
})
