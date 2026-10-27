import { call } from 'frappe-ui'

// Marks the lesson in the current /courses/<course>/learn/<chapter>-<lesson> URL.
export function markLessonProgress(): void {
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
