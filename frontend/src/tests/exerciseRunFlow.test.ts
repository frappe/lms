import { describe, expect, it, vi } from 'vitest'
import { useDebounceFn } from '@vueuse/core'
import {
	collectOutputs,
	draftWriter,
	orderCasesForRun,
	restoredResults,
	runnerCommand,
	sourceFilename,
} from '@/pages/ProgrammingExercises/exerciseRunFlow'
import type { ConsoleLine } from '@/components/ProgrammingExercises/ExerciseConsole.vue'

// Guards the command the console shows for each language.
// Came with this branch's run-and-score through the exercise workspace.
// Added on feat/assessment-visual-redesign to pin the per-language defaults.
describe('runner command', () => {
	it('runs Python with python', () => {
		expect(runnerCommand('Python')).toBe('python')
	})

	it('runs JavaScript with node', () => {
		expect(runnerCommand('JavaScript')).toBe('node')
	})

	it('falls back to the lowercased language', () => {
		expect(runnerCommand('Ruby')).toBe('ruby')
	})

	it('falls back to python when the language is not known yet', () => {
		expect(runnerCommand(undefined)).toBe('python')
	})
})

// Guards the solution filename the console shows for each language.
// Came with this branch's run-and-score through the exercise workspace.
// Added on feat/assessment-visual-redesign to pin the per-language defaults.
describe('source filename', () => {
	it('names a Python solution', () => {
		expect(sourceFilename('Python')).toBe('solution.py')
	})

	it('names a JavaScript solution', () => {
		expect(sourceFilename('JavaScript')).toBe('solution.js')
	})

	it('falls back to a plain text extension', () => {
		expect(sourceFilename('Ruby')).toBe('solution.txt')
		expect(sourceFilename(undefined)).toBe('solution.txt')
	})
})

// Guards outputs being posted out of step with the cases the server scores.
// Came with this branch's server-side scoring of exercise runs.
// Added on feat/assessment-visual-redesign to pin idx order without mutation.
describe('ordering cases for a run', () => {
	it('runs them in idx order, whatever order they arrived in', () => {
		const cases = [
			{ idx: 3, input: 'c' },
			{ idx: 1, input: 'a' },
			{ idx: 2, input: 'b' },
		]

		expect(orderCasesForRun(cases).map((c) => c.idx)).toEqual([1, 2, 3])
	})

	it('leaves the array it was given alone', () => {
		const cases = [
			{ idx: 2, input: 'b' },
			{ idx: 1, input: 'a' },
		]

		orderCasesForRun(cases)

		expect(cases.map((c) => c.idx)).toEqual([2, 1])
	})
})

// Guards the run transcript: one output per case, no inputs leaked, abort.
// Came with this branch's runner-output console for programming exercises.
// Added on feat/assessment-visual-redesign to keep hidden inputs off screen.
describe('collecting a run', () => {
	const cases = [
		{ idx: 1, input: 'first input' },
		{ idx: 2, input: 'second input' },
		{ idx: 3, input: 'third input' },
	]

	const collect = (execute: (input: string) => Promise<string>) => {
		const lines: ConsoleLine[] = []
		return collectOutputs({
			cases,
			command: 'python solution.py',
			execute,
			onLine: (line) => lines.push(line),
		}).then((outcome) => ({ outcome, lines }))
	}

	it('posts one output per case, in the order it was given', async () => {
		const { outcome } = await collect(async (input) => `ran ${input}`)

		expect(outcome?.outputs).toEqual([
			'ran first input',
			'ran second input',
			'ran third input',
		])
	})

	it('times every case it ran', async () => {
		const { outcome } = await collect(async () => 'ok')

		expect(outcome?.elapsed).toHaveLength(cases.length)
	})

	it('never puts a test case input in the console', async () => {
		const { lines } = await collect(async () => 'ok')

		const transcript = lines.map((line) => line.text).join('\n')
		for (const testCase of cases) {
			expect(transcript).not.toContain(testCase.input)
		}
	})

	it('prints the command alone, once per case', async () => {
		const { lines } = await collect(async () => 'ok')

		const commands = lines.filter((line) => line.stream === 'command')
		expect(commands).toHaveLength(cases.length)
		expect(commands.every((line) => line.text === '$ python solution.py')).toBe(
			true
		)
	})

	it('abandons the run when a case throws, and says why', async () => {
		const { outcome, lines } = await collect(async (input) => {
			if (input === 'second input') throw new Error('runner unreachable')
			return 'ok'
		})

		expect(outcome).toBeNull()
		expect(lines.at(-1)).toEqual({
			text: 'runner unreachable',
			stream: 'stderr',
		})
	})
})

// Guards a restored submission revealing hidden cases or their answers.
// Came with this branch's hidden test cases for programming exercises.
// Added on feat/assessment-visual-redesign when a restore ran before the load.
describe('restoring a saved submission', () => {
	const stored = [
		{
			idx: 1,
			input: 'add(2, 3)',
			output: '5',
			expected_output: '5',
			status: 'Passed',
		},
		{
			idx: 2,
			input: 'add(9, 9)',
			output: '18',
			expected_output: 'SECRET_EXPECTED_VALUE',
			status: 'Passed',
		},
	]

	const cases = [
		{ idx: 1, input: 'add(2, 3)', hidden: 0, expected_output: '5' },
		{
			idx: 2,
			input: 'add(9, 9)',
			hidden: 1,
			expected_output: 'SECRET_EXPECTED_VALUE',
		},
	]

	it('keeps a hidden case hidden', () => {
		const restored = restoredResults(stored, cases)

		expect(restored.map((row) => row.hidden)).toEqual([0, 1])
	})

	it('does not reveal a stored row when the exercise has not loaded yet', () => {
		const restored = restoredResults(stored, [])

		expect(restored.every((row) => row.hidden === 1)).toBe(true)
	})

	it('withholds a hidden case expected output the submission stored', () => {
		const restored = restoredResults(stored, cases)

		expect(restored[1].expected_output).toBeNull()
		expect(restored[0].expected_output).toBe('5')
	})

	it('matches on idx, not position', () => {
		const restored = restoredResults(stored, [cases[1], cases[0]])

		expect(restored.map((row) => row.hidden)).toEqual([0, 1])
	})

	it('hides a stored row the exercise no longer has a case for', () => {
		const restored = restoredResults(stored, [cases[0]])

		expect(restored[1].hidden).toBe(1)
	})

	it('carries the stored status and output through', () => {
		const restored = restoredResults(stored, cases)

		expect(restored[0]).toMatchObject({
			idx: 1,
			status: 'Passed',
			input: 'add(2, 3)',
			output: '5',
			elapsed: null,
		})
	})
})

// Guards a pending autosave writing one exercise's code under the next one.
// Came with this branch's autosave of the learner's in-progress code.
// Added on feat/assessment-visual-redesign to pin the generation check.
describe('the guarded draft write', () => {
	it('saves when the exercise has not changed since the save was armed', () => {
		const save = vi.fn()
		let generation = 0
		const write = draftWriter(save, () => generation)

		write(generation, 'print(1)')

		expect(save).toHaveBeenCalledWith('print(1)')
	})

	it('drops a save armed before the exercise changed', () => {
		const save = vi.fn()
		let generation = 0
		const write = draftWriter(save, () => generation)
		const armedAt = generation

		generation += 1
		write(armedAt, 'print(1)')

		expect(save).not.toHaveBeenCalled()
	})

	it('drops a debounced save that fires after the exercise changed', async () => {
		vi.useFakeTimers()
		try {
			const save = vi.fn()
			let generation = 0
			const write = useDebounceFn(
				draftWriter(save, () => generation),
				800
			)

			write(generation, 'code for the first exercise')
			generation += 1
			await vi.advanceTimersByTimeAsync(1000)

			expect(save).not.toHaveBeenCalled()
		} finally {
			vi.useRealTimers()
		}
	})

	it('still saves a debounced write nothing interrupted', async () => {
		vi.useFakeTimers()
		try {
			const save = vi.fn()
			const generation = 0
			const write = useDebounceFn(
				draftWriter(save, () => generation),
				800
			)

			write(generation, 'code for the first exercise')
			await vi.advanceTimersByTimeAsync(1000)

			expect(save).toHaveBeenCalledWith('code for the first exercise')
		} finally {
			vi.useRealTimers()
		}
	})
})
