/** Hand-written, not generated: LMS Question has no `src/types/lms/LMSQuestion.ts` yet. */

/** The columns the Questions list page actually fetches, not the full LMS Question doc. */
export interface LmsQuestionListRow {
	name: string
	question: string
	type: 'Choices' | 'User Input' | 'Open Ended'
	multiple: number
	/** frappe's own `owner`, shown as the author until LMS Question has one. */
	owner: string
	modified: string
}

/**
 * The 4 author-facing types (see `QUESTION_TYPES` in `@/utils/quizQuestion`),
 * reused as the list page's type filter. 'Choices' alone can't tell single from
 * multiple.
 */
export type QuestionTypeFilter =
	| ''
	| 'single'
	| 'multiple'
	| 'user_input'
	| 'open_ended'
