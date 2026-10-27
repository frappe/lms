import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const call = vi.hoisted(() => vi.fn())
vi.mock('frappe-ui', () => ({ call }))

import {
	holdLessonCompletion,
	markLessonProgress,
	releaseLessonCompletion,
} from '@/utils/markLessonProgress'

const LESSON_PATH = '/lms/courses/intro/learn/1-2'

beforeEach(() => {
	call.mockClear()
	window.history.pushState({}, '', LESSON_PATH)
})
afterEach(() => releaseLessonCompletion())

describe('markLessonProgress', () => {
	// Regression from #2426: a quiz or assignment submit completed an
	// enforced-video lesson before the video ended. Added on fix/course-progress-enforcement (no PR yet).
	it('waits while the lesson video has not been watched to the end', () => {
		holdLessonCompletion()
		markLessonProgress()
		expect(call).not.toHaveBeenCalled()
	})

	it('does not carry a hold over to another lesson', () => {
		holdLessonCompletion()
		window.history.pushState({}, '', '/lms/courses/intro/learn/1-3')
		markLessonProgress()
		expect(call).toHaveBeenCalledTimes(1)
	})
})
