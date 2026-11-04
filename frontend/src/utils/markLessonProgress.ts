import { call } from 'frappe-ui'

// Quizzes and assignments are mounted as separate Vue apps inside the lesson
// editor, so the lesson page shares its enforced-video state through this
// module rather than through provide/inject.
let heldLessonPath: string | null = null

export function holdLessonCompletion(): void {
	heldLessonPath = window.location.pathname
}

export function releaseLessonCompletion(): void {
	heldLessonPath = null
}

// Marks the lesson in the current /courses/<course>/learn/<chapter>-<lesson> URL.
export function markLessonProgress(): void {
	if (heldLessonPath === window.location.pathname) return
	const pathname = window.location.pathname.split('/')
	if (pathname[2] != 'courses') return
	const lessonIndex = (pathname.pop() ?? '').split('-')
	if (lessonIndex.length != 2) return
	call('lms.lms.api.mark_lesson_progress', {
		course: pathname[3],
		chapter_number: lessonIndex[0],
		lesson_number: lessonIndex[1],
	})
}
