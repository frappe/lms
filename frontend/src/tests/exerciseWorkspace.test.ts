// Guards the exercise workspace: problem beside editor, run/reset, autosave stamp.
// Came with this branch's two-tab workspace for programming exercises.
// Added on feat/assessment-visual-redesign to pin the workspace's contract.
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ExerciseWorkspace from '@/components/ProgrammingExercises/ExerciseWorkspace.vue'

// vi.stubGlobal doesn't reach a template's `_ctx.__`; this mirrors setup.ts's
// translate(): the string, or a { format } object when it has a {0}.
const translate = (message: string) => {
	if (!/{\d+}/.test(message)) return message
	return {
		format: (...args: unknown[]) =>
			message.replace(/{(\d+)}/g, (match, index) =>
				args[Number(index)] === undefined ? match : String(args[Number(index)])
			),
	}
}

const mountWorkspace = (extra: Record<string, unknown> = {}) =>
	mount(ExerciseWorkspace, {
		props: {
			...extra,
			title: 'Coding exercise',
			language: 'Python',
			problemStatement: '<p>Add two integers.</p>',
			results: [],
			consoleLines: [],
			duration: null,
			running: false,
			canRun: true,
			saved: false,
		},
		slots: { editor: '<div data-testid="editor-slot" />' },
		global: {
			mocks: { __: translate },
		},
	})

describe('ExerciseWorkspace', () => {
	// Guards the test cases hiding the problem behind a tab. Came with the
	// two-tab workspace. Added on fix-1 with the cases moved under the console.
	it('shows the problem and the test cases together', () => {
		const wrapper = mountWorkspace()

		expect(wrapper.find('[data-testid="problem-pane"]').exists()).toBe(true)
		expect(wrapper.find('[data-testid="tests-pane"]').exists()).toBe(true)
	})

	it('shows the submission status in the header', async () => {
		const wrapper = mountWorkspace()
		expect(wrapper.text()).not.toContain('Failed')

		await wrapper.setProps({ submissionStatus: 'Failed' })

		expect(wrapper.text()).toContain('Failed')
	})

	// Guards the box looking out of place on the exercise's own page.
	// Added on fix-1: boxed in a lesson, page-filling on its own page.
	it('is boxed by default and unboxed when not framed', () => {
		expect(mountWorkspace().classes()).toContain('rounded-7')
		expect(mountWorkspace({ framed: false }).classes()).not.toContain(
			'rounded-7'
		)
	})

	it('renders the editor slot', () => {
		expect(mountWorkspace().find('[data-testid="editor-slot"]').exists()).toBe(
			true
		)
	})

	it('emits run when Run code is pressed', async () => {
		const wrapper = mountWorkspace()

		await wrapper.get('[data-testid="run-code"]').trigger('click')

		expect(wrapper.emitted('run')).toHaveLength(1)
	})

	it('emits reset when Reset is pressed', async () => {
		const wrapper = mountWorkspace()

		await wrapper.get('[data-testid="reset-code"]').trigger('click')

		expect(wrapper.emitted('reset')).toHaveLength(1)
	})

	it('shows the autosaved stamp only once something is saved', async () => {
		const wrapper = mountWorkspace()
		expect(wrapper.text()).not.toContain('autosaved')

		await wrapper.setProps({ saved: true })

		expect(wrapper.text()).toContain('autosaved')
	})

	// Guards: the whole results pane was a live region, announcing twice.
	// Introduced in #2823; test added with the a11y audit remediation.
	it('announces results from one status region, not the whole pane', async () => {
		const wrapper = mountWorkspace()

		const pane = wrapper.get('[data-testid="tests-pane"]')
		expect(pane.attributes('role')).toBeUndefined()
		expect(pane.attributes('aria-live')).toBeUndefined()
		expect(pane.findAll('[role="status"]')).toHaveLength(1)
	})
})
