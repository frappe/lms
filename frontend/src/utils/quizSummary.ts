import type { QuizQuestionType } from '@/types/quiz'

// The quiz card's header line, shared by the learner card and the lesson
// editor's preview so the two always agree.
export const formatQuizSubtitle = (
	types: (QuizQuestionType | undefined)[],
	passingPercentage?: number
): string => {
	const parts: string[] = []
	if (types.length && types.every((type) => type == 'Choices')) {
		parts.push(__('Multiple choice'))
	} else if (types.length && types.every((type) => type != 'Choices')) {
		parts.push(__('Open ended'))
	}
	const count = types.length
	parts.push(`${count} ${count == 1 ? __('question') : __('questions')}`)
	if (passingPercentage) {
		parts.push(__('pass at {0}%').format(passingPercentage))
	}
	// En spaces: the browser collapses plain ones, and a single space each side
	// crowds the dot.
	return parts.join('\u2002·\u2002')
}

export const attemptsLeftLabel = (attemptsLeft: number): string =>
	__('{0} {1} left').format(
		attemptsLeft,
		attemptsLeft == 1 ? __('attempt') : __('attempts')
	)

export const attemptsAllowedLabel = (maxAttempts: number): string =>
	__('{0} {1} allowed').format(
		maxAttempts,
		maxAttempts == 1 ? __('attempt') : __('attempts')
	)
