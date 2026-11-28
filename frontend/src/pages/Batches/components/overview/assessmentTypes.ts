import type { RouteLocationRaw } from 'vue-router'

export type AssessmentDoctype =
	| 'LMS Quiz'
	| 'LMS Assignment'
	| 'LMS Programming Exercise'

export interface BatchAssessment {
	name: string
	assessment_type: AssessmentDoctype
	assessment_name: string
	title?: string
}

export type AssessmentRow = { name: string; title: string } & Record<
	string,
	unknown
>

export interface AssessmentType {
	label: string
	icon: string
	/** Read beside `name` and `title` for the picker's meta line. */
	fields: string[]
	meta: (row: AssessmentRow) => string[]
	editRoute: (name: string) => RouteLocationRaw
}

/** Unique across types: a quiz and an assignment may share a docname. */
export const assessmentKey = (doctype: string, name: string): string =>
	`${doctype}::${name}`

const present = (...values: unknown[]): string[] =>
	values.filter(Boolean).map(String)

/** The assessment types a batch takes, keyed by doctype. A function so `__` runs after boot. */
export const assessmentTypes = (): Record<
	AssessmentDoctype,
	AssessmentType
> => ({
	'LMS Quiz': {
		label: __('Quiz'),
		icon: 'lucide-circle-help',
		fields: ['passing_percentage'],
		meta: (row) =>
			present(
				row.passing_percentage &&
					__('Pass at {0}%').format(row.passing_percentage)
			),
		editRoute: (quizID) => ({ name: 'QuizForm', params: { quizID } }),
	},
	'LMS Assignment': {
		label: __('Assignment'),
		icon: 'lucide-file-pen',
		fields: ['type'],
		meta: (row) => present(row.type),
		editRoute: (assignmentID) => ({
			name: 'AssignmentForm',
			params: { assignmentID },
		}),
	},
	'LMS Programming Exercise': {
		label: __('Programming exercise'),
		icon: 'lucide-code',
		fields: ['language'],
		meta: (row) => present(row.language),
		editRoute: (exerciseID) => ({
			name: 'ProgrammingExerciseForm',
			params: { exerciseID },
		}),
	},
})
