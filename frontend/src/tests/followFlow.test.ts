/**
 * While Flow works for the user, the app opens the page of what it last
 * wrote: a burst of saves opens one page, and unsaved edits are not dropped.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { FlowChange } from '@/composables/useFlowChanges'

const unsaved = { value: false }
vi.mock('@/composables/useUnsavedChangesGuard', () => ({
	hasUnsavedEdits: () => unsaved.value,
}))
const toastInfo = vi.fn()
vi.mock('frappe-ui', () => ({ toast: { info: toastInfo } }))

const { followFlowChanges, getFollowRoute, FOLLOW_DELAY_MS } = await import(
	'@/utils/followFlow'
)

const Page = { template: '<div />' }

const setup = async (start = '/courses') => {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/courses', name: 'Courses', component: Page },
			{ path: '/courses/:courseName', name: 'CourseDetail', component: Page },
			{ path: '/quizzes/edit/:quizID', name: 'QuizForm', component: Page },
		],
	})
	await router.push(start)
	let handler: (change: FlowChange) => void = () => {}
	followFlowChanges(router, { on: (_event, fn) => (handler = fn) }, () => ({}))
	const emit = async (...changes: FlowChange[]) => {
		changes.forEach((change) => handler(change))
		await vi.advanceTimersByTimeAsync(FOLLOW_DELAY_MS)
	}
	return { router, emit }
}

const course = { doctype: 'LMS Course', name: 'frappe-basics' }

describe('following Flow', () => {
	beforeEach(() => {
		vi.useFakeTimers()
		unsaved.value = false
		toastInfo.mockClear()
	})
	afterEach(() => vi.useRealTimers())

	it('opens the course Flow just created', async () => {
		const { router, emit } = await setup()
		await emit(course)
		expect(router.currentRoute.value.fullPath).toBe('/courses/frappe-basics')
	})

	it('opens only the last record of a burst', async () => {
		const { router, emit } = await setup()
		await emit(
			course,
			{
				doctype: 'Course Chapter',
				name: 'ch1',
				values: { course: 'frappe-basics' },
			},
			{
				doctype: 'Course Lesson',
				name: 'l1',
				values: { course: 'frappe-basics' },
			}
		)
		expect(router.currentRoute.value.fullPath).toBe(
			'/courses/frappe-basics?editLessonName=l1#editor'
		)
	})

	it('follows a chapter into the course editor', () => {
		expect(
			getFollowRoute(
				{ doctype: 'Course Chapter', name: 'ch1', values: { course: 'c1' } },
				{}
			)
		).toEqual({
			name: 'CourseDetail',
			params: { courseName: 'c1' },
			hash: '#editor',
		})
	})

	it('stays on the tab already showing the record', async () => {
		const { router, emit } = await setup('/courses/frappe-basics#editor')
		await emit(course)
		expect(router.currentRoute.value.fullPath).toBe(
			'/courses/frappe-basics#editor'
		)
	})

	it('keeps unsaved edits and offers the page instead', async () => {
		unsaved.value = true
		const { router, emit } = await setup()
		await emit({ doctype: 'LMS Quiz', name: 'q1' })
		expect(router.currentRoute.value.fullPath).toBe('/courses')
		expect(toastInfo).toHaveBeenCalledOnce()
		toastInfo.mock.calls[0][1].action.onClick()
		await vi.runAllTimersAsync()
		expect(router.currentRoute.value.fullPath).toBe('/quizzes/edit/q1')
	})

	it('ignores deletions and records with no LMS page', async () => {
		const { router, emit } = await setup()
		await emit(
			{ ...course, deleted: true },
			{ doctype: 'LMS Badge', name: 'b' }
		)
		expect(router.currentRoute.value.fullPath).toBe('/courses')
	})
})
