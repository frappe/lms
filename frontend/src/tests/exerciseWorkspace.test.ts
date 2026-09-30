// Guards the two-tab exercise workspace: tabs, run/reset, autosave stamp.
// Came with this branch's two-tab workspace for programming exercises.
// Added on feat/assessment-visual-redesign to pin the workspace's contract.
import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
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

const mountWorkspace = () =>
	mount(ExerciseWorkspace, {
		props: {
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
	it('opens on the problem tab', () => {
		const wrapper = mountWorkspace()

		expect(wrapper.find('[data-testid="problem-pane"]').exists()).toBe(true)
		expect(wrapper.find('[data-testid="tests-pane"]').exists()).toBe(false)
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

	it('showTab moves to the tests pane and back', async () => {
		const wrapper = mountWorkspace()

		wrapper.vm.showTab('tests')
		await flushPromises()
		expect(wrapper.find('[data-testid="tests-pane"]').exists()).toBe(true)

		wrapper.vm.showTab('problem')
		await flushPromises()
		expect(wrapper.find('[data-testid="problem-pane"]').exists()).toBe(true)
	})

	it('exposes showTab rather than leaking it through the proxy', () => {
		expect(Object.keys(mountWorkspace().vm.$.exposed ?? {})).toContain(
			'showTab'
		)
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
		wrapper.vm.showTab('tests')
		await flushPromises()

		const pane = wrapper.get('[data-testid="tests-pane"]')
		expect(pane.attributes('role')).toBeUndefined()
		expect(pane.attributes('aria-live')).toBeUndefined()
		expect(pane.findAll('[role="status"]')).toHaveLength(1)
	})
})
