import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const call = vi.hoisted(() => vi.fn((): Promise<unknown> => Promise.resolve(true)))
vi.mock('frappe-ui', () => ({ call }))

import {
	holdLessonCompletion,
	markLessonProgress,
	onLessonProgressMarked,
	releaseLessonCompletion,
} from '@/utils/markLessonProgress'
import { flushPromises } from '@vue/test-utils'

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

	it('tells listeners whether the server completed the lesson', async () => {
		const heard: boolean[] = []
		const stop = onLessonProgressMarked((lesson) => heard.push(lesson.completed))
		call.mockResolvedValueOnce(false)
		markLessonProgress()
		await flushPromises()
		markLessonProgress()
		await flushPromises()
		stop()
		expect(heard).toEqual([false, true])
	})

	it('catches a refused mark instead of leaving the rejection unhandled', async () => {
		const listener = vi.fn()
		const stop = onLessonProgressMarked(listener)
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
		call.mockRejectedValueOnce(new Error('PermissionError'))
		markLessonProgress()
		await flushPromises()
		stop()
		expect(listener).not.toHaveBeenCalled()
		expect(consoleError).toHaveBeenCalled()
		consoleError.mockRestore()
	})
})
