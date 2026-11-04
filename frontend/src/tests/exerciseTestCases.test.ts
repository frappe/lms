import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ExerciseTestCases, {
	type TestCaseResult,
} from '@/components/ProgrammingExercises/ExerciseTestCases.vue'

// Per-mount `__` mock: setup.ts's stubGlobal misses a compiled template's
// `_ctx.__`. Mirrors setup.ts's translate() contract.
const translate = (message: string) => {
	if (!/{\d+}/.test(message)) return message
	return {
		format: (...args: unknown[]) =>
			message.replace(/{(\d+)}/g, (match, index) =>
				args[Number(index)] === undefined ? match : String(args[Number(index)])
			),
	}
}

const mountTestCases = (props: {
	results: TestCaseResult[]
	duration: number | null
}) =>
	mount(ExerciseTestCases, {
		props,
		global: { mocks: { __: translate } },
	})

const mixed = [
	{
		idx: 1,
		status: 'Passed' as const,
		hidden: 0,
		input: 'add(2, 3)',
		output: '5',
		expected_output: '5',
		// Not 0.01: "0.01s" contains the "0.0" the hidden-row check looks for.
		elapsed: 1.5,
	},
	{
		idx: 2,
		status: 'Failed' as const,
		hidden: 1,
		output: '0.0',
		expected_output: null,
		elapsed: 0.01,
	},
]

// Guards test results as rows, with hidden cases only counted, never shown.
// Came with this branch's exercise results rows and hidden test cases change.
// Added on feat/assessment-visual-redesign so hidden answers never render.
describe('ExerciseTestCases', () => {
	it('renders a visible case as a row with its expected output', () => {
		const wrapper = mountTestCases({ results: mixed, duration: 0.42 })

		const rows = wrapper.findAll('[data-testid="test-case-row"]')
		expect(rows).toHaveLength(1)
		expect(rows[0].text()).toContain('add(2, 3)')
		expect(rows[0].text()).toContain('5')
	})

	it('never renders a hidden case as a row', () => {
		const wrapper = mountTestCases({ results: mixed, duration: 0.42 })

		expect(wrapper.text()).not.toContain('0.0')
	})

	it('counts hidden cases into the summary', () => {
		const wrapper = mountTestCases({ results: mixed, duration: 0.42 })

		expect(wrapper.get('[data-testid="test-case-summary"]').text()).toContain(
			'1 of 2 passed'
		)
	})

	it('prompts a run when there are no results yet', () => {
		const wrapper = mountTestCases({ results: [], duration: null })

		expect(wrapper.text()).toContain('Run your code to check the test cases')
		expect(wrapper.findAll('[data-testid="test-case-row"]')).toHaveLength(0)
	})

	it('never leaks a hidden case expected_output even when the server sent one', () => {
		const authorView = [
			{
				idx: 3,
				status: 'Failed' as const,
				hidden: 1,
				output: '0.0',
				expected_output: 'SECRET_EXPECTED_VALUE',
				elapsed: 0.01,
			},
		]
		const wrapper = mountTestCases({ results: authorView, duration: 0.42 })

		expect(wrapper.text()).not.toContain('SECRET_EXPECTED_VALUE')
	})
})
