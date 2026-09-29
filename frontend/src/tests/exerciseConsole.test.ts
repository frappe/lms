// Guards the exercise console: stream styling, duration, collapse shortcuts.
// Came with this branch's runner-output console for programming exercises.
// Added on feat/assessment-visual-redesign to pin the console's behaviour.
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ExerciseConsole from '@/components/ProgrammingExercises/ExerciseConsole.vue'

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

const lines = [
	{ text: '$ python -m runner solution.py', stream: 'command' as const },
	{ text: 'add(2, 3) -> 5', stream: 'stdout' as const },
	{ text: 'AssertionError: 0.0 != 0', stream: 'stderr' as const },
]

const mountConsole = (props: {
	lines: typeof lines
	duration: number | null
}) =>
	mount(ExerciseConsole, {
		props,
		global: { mocks: { __: translate } },
	})

describe('ExerciseConsole', () => {
	it('renders every line in order', () => {
		const wrapper = mountConsole({ lines, duration: 0.42 })

		const rendered = wrapper.findAll('[data-testid="console-line"]')
		expect(rendered).toHaveLength(3)
		expect(rendered[1].text()).toBe('add(2, 3) -> 5')
	})

	it('marks stderr apart from stdout', () => {
		const wrapper = mountConsole({ lines, duration: 0.42 })

		const rendered = wrapper.findAll('[data-testid="console-line"]')
		expect(rendered[2].classes().join(' ')).toContain('text-ink-red-5')
		expect(rendered[1].classes().join(' ')).not.toContain('text-ink-red-5')
	})

	it('shows the measured duration', () => {
		const wrapper = mountConsole({ lines, duration: 0.42 })

		expect(wrapper.text()).toContain('Ran in 0.42s')
	})

	it('says nothing about duration before a run', () => {
		const wrapper = mountConsole({ lines: [], duration: null })

		expect(wrapper.text()).not.toContain('Ran in')
	})

	it('collapses and reopens when the header is clicked', async () => {
		const wrapper = mountConsole({ lines, duration: 0.42 })
		expect(wrapper.findAll('[data-testid="console-line"]')).toHaveLength(3)

		await wrapper.get('[data-testid="console-toggle"]').trigger('click')
		expect(wrapper.findAll('[data-testid="console-line"]')).toHaveLength(0)

		await wrapper.get('[data-testid="console-toggle"]').trigger('click')
		expect(wrapper.findAll('[data-testid="console-line"]')).toHaveLength(3)
	})

	it('toggles on Ctrl+` and on Cmd+`', async () => {
		// attachTo so the window-level keydown listener sees these events.
		const wrapper = mount(ExerciseConsole, {
			props: { lines, duration: 0.42 },
			global: { mocks: { __: translate } },
			attachTo: document.body,
		})

		const press = async (modifier: 'ctrlKey' | 'metaKey') => {
			window.dispatchEvent(
				new KeyboardEvent('keydown', { key: '`', [modifier]: true })
			)
			await wrapper.vm.$nextTick()
		}

		await press('ctrlKey')
		expect(wrapper.findAll('[data-testid="console-line"]')).toHaveLength(0)

		await press('metaKey')
		expect(wrapper.findAll('[data-testid="console-line"]')).toHaveLength(3)

		wrapper.unmount()
	})

	it('leaves a bare backtick alone', async () => {
		const wrapper = mount(ExerciseConsole, {
			props: { lines, duration: 0.42 },
			global: { mocks: { __: translate } },
			attachTo: document.body,
		})

		window.dispatchEvent(new KeyboardEvent('keydown', { key: '`' }))
		await wrapper.vm.$nextTick()

		expect(wrapper.findAll('[data-testid="console-line"]')).toHaveLength(3)

		wrapper.unmount()
	})
})
