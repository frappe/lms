import { draftLessonNumber } from '@/utils/courseOutline'
import type { FlowNavigation } from '@/onboarding/types'

// Steps that need the first course or batch open its list until one exists.
function withCourse(nav: FlowNavigation, open: (courseName: string) => void) {
	const courseName = nav.facts.first_course
	if (!courseName) return nav.openRoute({ name: 'Courses' })
	open(courseName)
}

function withBatch(nav: FlowNavigation, open: (batchName: string) => void) {
	const batchName = nav.facts.first_batch
	if (!batchName) return nav.openRoute({ name: 'Batches' })
	open(batchName)
}

// Each intent is read once: CoursePublishSettings turns Paid course on for
// ?pricing=paid and puts the caret in the price; CourseDetail focuses its
// Publish button for ?publish=1.
export function openCourseSettings(
	nav: FlowNavigation,
	intent: { pricing: 'paid' } | { publish: '1' }
): void {
	withCourse(nav, (courseName) =>
		nav.openRoute({
			name: 'CourseDetail',
			params: { courseName },
			query: intent,
			hash: '#settings',
		})
	)
}

export function openChapterForm(nav: FlowNavigation): void {
	withCourse(nav, (courseName) =>
		nav.openForm({
			name: 'ChapterForm',
			params: { courseName, chapterName: 'new' },
			hash: '#editor',
		})
	)
}

// The editor's own Add Lesson draft in the first chapter, the URL it writes
// for one: LessonForm opens empty with the caret in the title.
export function openNewLesson(nav: FlowNavigation): void {
	withCourse(nav, (courseName) => {
		const chapter = nav.facts.first_chapter
		nav.openRoute({
			name: 'CourseDetail',
			params: { courseName },
			...(chapter && {
				query: { editLesson: draftLessonNumber(1), draftChapter: chapter },
			}),
			hash: '#editor',
		})
	})
}

export function openLiveClassForm(nav: FlowNavigation): void {
	withBatch(nav, (batchName) =>
		nav.openForm({
			name: 'NewLiveClass',
			params: { batchName },
			hash: '#classes',
		})
	)
}

export function openBatch(nav: FlowNavigation): void {
	withBatch(nav, (batchName) =>
		nav.openRoute({ name: 'BatchDetail', params: { batchName } })
	)
}

export function openBatchSettings(nav: FlowNavigation): void {
	withBatch(nav, (batchName) =>
		nav.openRoute({
			name: 'BatchDetail',
			params: { batchName },
			hash: '#settings',
		})
	)
}

// The course editor opens its stored or first lesson, where the author inserts
// the assessment.
export function openCourseEditor(nav: FlowNavigation): void {
	withCourse(nav, (courseName) =>
		nav.openRoute({
			name: 'CourseDetail',
			params: { courseName },
			hash: '#editor',
		})
	)
}
