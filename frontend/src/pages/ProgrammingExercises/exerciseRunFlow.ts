import type { TestCaseResult } from '@/components/ProgrammingExercises/ExerciseTestCases.vue'
import type { ConsoleLine } from '@/components/ProgrammingExercises/ExerciseConsole.vue'

// Keep in sync with BOILERPLATE in lms/lms/code_runner.py, which strips it before storing.
const BOILERPLATE: Record<string, string> = {
	python: `with open("stdin", "r") as f:\n    data = f.read()\n\ninputs = data.split() if len(data) else []\n\n# inputs is a list of strings\n# write your code below\n\n`,
	javascript: `const fs = require('fs');\n\nlet input = fs.readFileSync('/app/stdin', 'utf8').trim();\nconst inputs = input.split("\\n");\n// inputs is an array of strings\n// write your code below\n`,
}

// The stdin-reading preamble a learner's code starts from.
export function boilerplateFor(language: string | undefined): string {
	return BOILERPLATE[(language ?? '').toLowerCase()] ?? ''
}

const RUNNERS: Record<string, string> = {
	python: 'python',
	javascript: 'node',
}

const EXTENSIONS: Record<string, string> = {
	python: 'py',
	javascript: 'js',
}

// The console prints the command the learner would have typed, and nothing
// more: echoing a case's input into a transcript that is also shown while a
// hidden case runs would put a hidden input on screen.
export function runnerCommand(language: string | undefined): string {
	const key = language?.toLowerCase() || 'python'
	return RUNNERS[key] ?? key
}

export function sourceFilename(language: string | undefined): string {
	const key = language?.toLowerCase() ?? ''
	return `solution.${EXTENSIONS[key] ?? 'txt'}`
}

export type ExerciseTestCase = {
	idx: number
	input: string
	hidden: number
	expected_output: string | null
}

export type StoredTestCase = {
	idx?: number
	input: string
	output: string
	expected_output: string | null
	status: string
}

export type RunTestCase = { idx: number; input: string }

export type CollectOptions = {
	cases: readonly RunTestCase[]
	command: string
	execute: (input: string) => Promise<string>
	onLine: (line: ConsoleLine) => void
	now?: () => number
}

export type RunOutcome = { outputs: string[]; elapsed: number[] }

export function messageOf(failure: unknown): string {
	return failure instanceof Error ? failure.message : String(failure)
}

export function orderCasesForRun<T extends { idx: number }>(
	cases: readonly T[]
): T[] {
	return [...cases].sort((a, b) => a.idx - b.idx)
}

export async function collectOutputs(
	options: CollectOptions
): Promise<RunOutcome | null> {
	const { cases, command, execute, onLine } = options
	const now = options.now ?? (() => performance.now())
	const outputs: string[] = []
	const elapsed: number[] = []

	for (const testCase of cases) {
		onLine({ text: `$ ${command}`, stream: 'command' })
		const startedAt = now()
		let produced: string
		try {
			produced = await execute(testCase.input)
		} catch (failure: unknown) {
			onLine({ text: messageOf(failure), stream: 'stderr' })
			return null
		}
		elapsed.push((now() - startedAt) / 1000)
		outputs.push(produced)
		onLine({ text: produced, stream: 'stdout' })
	}

	return { outputs, elapsed }
}

// Stored rows carry no hidden flag, so visibility is read from the exercise by
// idx (positions shift when cases change). A row with no matching case, or
// restored before the exercise loads, is treated as hidden.
export function restoredResults(
	stored: readonly StoredTestCase[],
	cases: readonly ExerciseTestCase[]
): TestCaseResult[] {
	const byIdx = new Map(cases.map((row) => [row.idx, row]))
	return stored.map((row, index) => {
		const known = byIdx.get(row.idx ?? index + 1)
		const hidden = known ? known.hidden : 1
		return {
			idx: row.idx ?? index + 1,
			status:
				row.status === 'Passed' ? ('Passed' as const) : ('Failed' as const),
			hidden,
			input: row.input,
			output: row.output,
			// Withheld here as well as filtered in the component: a stored row
			// carries the answer a learner was never sent, because everyone who
			// can create a submission today is an exercise author.
			expected_output: hidden ? null : row.expected_output,
			elapsed: null,
		}
	})
}

export function draftWriter(
	save: (code: string) => void,
	currentGeneration: () => number
) {
	return (generation: number, pending: string): void => {
		if (generation !== currentGeneration()) return
		save(pending)
	}
}
