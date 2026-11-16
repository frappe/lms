import { call } from 'frappe-ui'

// Quizzes and assignments are mounted as separate Vue apps inside the lesson
// editor, so the lesson page shares its enforced-video state through this
// module rather than through provide/inject.
let heldLessonPath: string | null = null

export type MarkedLesson = {
	course: string
	chapterNumber: string
	lessonNumber: string
	// Whether the server now has the lesson as complete. It can decline without
	// an error, e.g. when the lesson's requirements are not met yet.
	completed: boolean
}

type MarkedLessonListener = (lesson: MarkedLesson) => void

// Lets the lesson page hear about a quiz or assignment completion without
// depending on the realtime update_lesson_progress event.
const listeners = new Set<MarkedLessonListener>()

export function onLessonProgressMarked(
	listener: MarkedLessonListener
): () => void {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

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
	const course = pathname[3]
	const [chapterNumber, lessonNumber] = lessonIndex
	call('lms.lms.api.mark_lesson_progress', {
		course,
		chapter_number: chapterNumber,
		lesson_number: lessonNumber,
	})
		.then((completed: boolean) => {
			const lesson: MarkedLesson = {
				course,
				chapterNumber,
				lessonNumber,
				completed: Boolean(completed),
			}
			listeners.forEach((listener) => listener(lesson))
		})
		// A locked lesson is refused with a PermissionError; the quiz or
		// assignment has already been saved, so there is nothing to undo.
		.catch((err: unknown) => console.error(err))
}
