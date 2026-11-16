// Per user and per quiz docname: a title is neither unique nor tied to a person,
// so keying on it shared answers across same-titled quizzes and between people
// on one browser.
export const quizAnswerStorageKey = (
	userName: string | null | undefined,
	quizName: string | null | undefined
): string => `lms:quiz-answers:${userName || 'guest'}:${quizName || ''}`
