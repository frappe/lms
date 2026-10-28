export type ExerciseLanguage = 'Python' | 'JavaScript'

export interface ProgrammingExercise {
	name: string
	title: string
	language: ExerciseLanguage
	test_cases_count: number
	problem_statement: string
	starter_code?: string
	test_cases: [TestCase]
}

export interface TestCase {
	name: string
	input: string
	expected_output: string
	output: string
	status: 'Passed' | 'Failed'
	hidden?: number
}

export type ProgrammingExercises = {
	data: ProgrammingExercise[]
	reload: () => void
	hasNextPage: boolean
	next: () => void
	setValue: {
		submit: (
			data: ProgrammingExercise,
			options?: { onSuccess?: () => void }
		) => void
	}
	insert: {
		submit: (
			data: ProgrammingExercise,
			options?: { onSuccess?: () => void }
		) => void
	}
	delete: {
		submit: (name: string, options?: { onSuccess?: () => void }) => void
	}
}
