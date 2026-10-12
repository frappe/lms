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

const mountTestCases = (props: { results: TestCaseResult[] }) =>
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
		// No elapsed time may contain "0.0": the hidden-row check looks for it.
		elapsed: 1.5,
	},
	{
		idx: 2,
		status: 'Failed' as const,
		hidden: 1,
		input: 'SECRET_INPUT',
		output: '0.0',
		expected_output: null,
		elapsed: 0.25,
	},
]

// Guards test results as rows, with a hidden case's verdict shown but nothing
// of its input, answer or output. Came with the hidden test cases change.
// Added on feat/assessment-visual-redesign; locked rows added on fix-1.
describe('ExerciseTestCases', () => {
	it('labels a visible case input, expected and the learner output', () => {
		const wrapper = mountTestCases({ results: mixed })

		const row = wrapper.findAll('[data-testid="test-case-row"]')[0]
		expect(row.text()).toContain('Case 1')
		expect(row.text()).toContain('Inputadd(2, 3)')
		expect(row.text()).toContain('Expected5')
		expect(row.text()).toContain('Your output5')
	})

	it('shows a hidden case as a locked row with its verdict only', () => {
		const wrapper = mountTestCases({ results: mixed })

		const rows = wrapper.findAll('[data-testid="test-case-row"]')
		expect(rows).toHaveLength(2)
		expect(rows[1].text()).toContain('Hidden')
		expect(rows[1].text()).toContain('Failed')
		expect(rows[1].text()).not.toContain('SECRET_INPUT')
		expect(rows[1].text()).not.toContain('0.0')
	})

	it('marks a failed output and says when there was none', () => {
		const failed = {
			...mixed[0],
			status: 'Failed' as const,
			output: '',
		}
		const wrapper = mountTestCases({ results: [failed] })

		expect(wrapper.text()).toContain('No output')
		expect(wrapper.get('dd.text-ink-red-5').exists()).toBe(true)
	})

	it('counts hidden cases into the summary', () => {
		const wrapper = mountTestCases({ results: mixed })

		expect(wrapper.get('[data-testid="test-case-summary"]').text()).toContain(
			'1 of 2 passed'
		)
	})

	it('is titled, before and after a run', async () => {
		const wrapper = mountTestCases({ results: [] })
		expect(wrapper.get('h3').text()).toBe('Test cases')

		await wrapper.setProps({ results: mixed })
		expect(wrapper.get('h3').text()).toBe('Test cases')
	})

	it('prompts a run when there are no results yet', () => {
		const wrapper = mountTestCases({ results: [] })

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
		const wrapper = mountTestCases({ results: authorView })

		expect(wrapper.text()).not.toContain('SECRET_EXPECTED_VALUE')
	})
})

describe('ExerciseTestCases announcements', () => {
	// Guards: pass/fail shown by colour and icon alone, results not announced.
	// Introduced in #2823; test added with the a11y audit remediation.
	it('says each verdict in text and announces from a status region kept mounted', async () => {
		const wrapper = mountTestCases({ results: [] })
		const status = wrapper.get('[role="status"]')
		const failed = { ...mixed[0], idx: 2, status: 'Failed' as const }

		await wrapper.setProps({ results: [mixed[0], failed] })

		expect(wrapper.get('[role="status"]').element).toBe(status.element)
		expect(status.text()).toBe('1 of 2 passed')
		const verdicts = wrapper.findAll('[data-testid="test-case-row"] .sr-only')
		expect(verdicts.map((v) => v.text())).toEqual(['Passed', 'Failed'])
		expect(wrapper.get('.lucide-circle-check').attributes('aria-hidden')).toBe(
			'true'
		)
	})
})
