/**
 * Lesson.vue is the heaviest page in the app (1300+ lines): a socket
 * subscription, an EditorJS instance, plyr video tracking, two Pinia stores
 * and a dozen child components. Every dependency below is stubbed so the
 * mount exercises the REAL `canGoNext` computed, the REAL `goNext` /
 * `switchLesson` / `setupLesson` / `goToLessonNumber` handlers, and the REAL
 * socket callback registered in onMounted -- not a hand-rolled restatement of
 * any of them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'

const pushMock = vi.hoisted(() => vi.fn())
const replaceMock = vi.hoisted(() => vi.fn())
const socketOnMock = vi.hoisted(() => vi.fn())
const socketOffMock = vi.hoisted(() => vi.fn())
const created = vi.hoisted(() => ({ list: [] as any[] }))
const stub = vi.hoisted(() => (name: string) => ({
	name,
	template: `<div><slot /></div>`,
}))

vi.mock('vue-router', () => ({
	useRoute: () => ({
		params: { chapterNumber: '1', lessonNumber: '1' },
		query: {},
	}),
	useRouter: () => ({ push: pushMock, replace: replaceMock }),
}))

vi.mock('frappe-ui', async () => {
	const { reactive } = await import('vue')
	const passthrough = (name: string) => ({
		name,
		template: `<div><slot name="prefix" /><slot name="icon" /><slot /><slot name="suffix" /></div>`,
	})
	return {
		createResource: (config: any) => {
			const resource: any = reactive({
				data: null,
				loading: false,
				_config: config,
				submit: vi.fn((_params: any, handlers: any) => {
					// frappe-ui runs the resource-level onSuccess as well as the
					// per-call one; the outline reload lives on the former.
					config?.onSuccess?.(resource.data)
					handlers?.onSuccess?.(resource.data)
					return Promise.resolve()
				}),
				reload: vi.fn(),
				fetch: vi.fn(),
			})
			created.list.push(resource)
			return resource
		},
		createListResource: () =>
			reactive({
				data: [],
				loading: false,
				update: vi.fn(),
				reload: vi.fn(),
				fetch: vi.fn(),
			}),
		call: vi.fn(() => Promise.resolve()),
		usePageMeta: vi.fn(),
		toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
		Badge: passthrough('Badge'),
		Button: {
			name: 'Button',
			template: `<button><slot name="prefix" /><slot name="icon" /><slot /><slot name="suffix" /></button>`,
		},
		TabButtons: passthrough('TabButtons'),
		Tooltip: { name: 'Tooltip', template: `<span><slot /></span>` },
	}
})

vi.mock('@editorjs/editorjs', () => ({
	default: class {
		isReady = Promise.resolve()
		destroy = vi.fn()
	},
}))

vi.mock('@/utils', () => ({
	getEditorTools: () => ({}),
	enablePlyr: () => Promise.resolve([]),
	highlightText: vi.fn(),
	sanitizeEditorJs: (x: any) => x,
}))

vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ brand: {} }),
}))
vi.mock('@/stores/sidebar', () => ({
	useSidebar: () => ({ isSidebarCollapsed: false }),
}))
vi.mock('@/stores/settings', () => ({
	useSettings: () => ({
		settings: { data: {}, promise: Promise.resolve() },
	}),
}))

vi.mock('@/components/LessonContent.vue', () => ({
	default: stub('LessonContent'),
}))
vi.mock('@/components/CourseInstructors.vue', () => ({
	default: stub('CourseInstructors'),
}))
vi.mock('@/components/ProgressBar.vue', () => ({
	default: stub('ProgressBar'),
}))
vi.mock('@/components/Discussions.vue', () => ({
	default: stub('Discussions'),
}))
vi.mock('@/components/CertificationLinks.vue', () => ({
	default: stub('CertificationLinks'),
}))
vi.mock('@/components/CourseOutline.vue', () => ({
	default: stub('CourseOutline'),
}))
vi.mock('@/components/StudentLessonSidebar.vue', () => ({
	default: stub('StudentLessonSidebar'),
}))
vi.mock('@/components/BottomSheet.vue', () => ({
	default: stub('BottomSheet'),
}))
vi.mock('@/components/Layouts/PageHeader.vue', () => ({
	default: stub('PageHeader'),
}))
vi.mock('@/components/HeaderButton.vue', () => ({
	default: stub('HeaderButton'),
}))
vi.mock('@/components/UserAvatar.vue', () => ({
	default: stub('UserAvatar'),
}))
vi.mock('@/components/Notes/Notes.vue', () => ({ default: stub('Notes') }))
vi.mock('@/components/Notes/InlineLessonMenu.vue', () => ({
	default: stub('InlineLessonMenu'),
}))

// Mirrors src/translation.js: a message with {0}-style placeholders returns a
// formatter object, not a string. A stub that always returns the string hides a
// real "__(...).format is not a function" crash.
const translateStub = (s: string) =>
	/{\d+}/.test(s)
		? {
				format: (...args: unknown[]) =>
					s.replace(/{(\d+)}/g, (match, index) =>
						args[Number(index)] === undefined
							? match
							: String(args[Number(index)])
					),
		  }
		: s

vi.stubGlobal('__', translateStub)

import Lesson from '@/pages/Lesson.vue'

const findResource = (url: string) =>
	created.list.find((resource) => resource._config.url === url)

async function mountLesson(
	props: { chapterNumber: string; lessonNumber: string } = {
		chapterNumber: '1',
		lessonNumber: '1',
	}
) {
	const wrapper = mount(Lesson, {
		props: { courseName: 'COURSE-1', ...props },
		global: {
			mocks: { __: translateStub },
			provide: {
				$user: { data: { name: 'student@example.com' } },
				$socket: { on: socketOnMock, off: socketOffMock },
			},
			stubs: {
				teleport: true,
				'router-link': { template: '<a><slot /></a>' },
			},
		},
	})
	await flushPromises()
	return wrapper
}

const baseLesson = {
	name: 'L1',
	title: 'Lesson 1',
	course_title: 'Course 1',
	chapter_title: 'Chapter 1',
	prev: null,
	next: '1.2',
	instructors: [],
}

let wrapper: VueWrapper

beforeEach(() => {
	created.list.length = 0
	pushMock.mockReset()
	replaceMock.mockReset()
	socketOnMock.mockReset()
	socketOffMock.mockReset()
})

afterEach(() => {
	wrapper?.unmount()
})

describe('Lesson.vue Next affordance follows canGoNext', () => {
	it('hides the Next button when the following lesson is locked', async () => {
		wrapper = await mountLesson()
		findResource('lms.lms.utils.get_course_outline').data = [
			{
				name: 'CH-1',
				lessons: [
					{ name: 'L1', number: '1-1', locked: 0 },
					{ name: 'L2', number: '1-2', locked: 1 },
				],
			},
		]
		findResource('lms.lms.utils.get_lesson').data = { ...baseLesson }
		await flushPromises()

		expect((wrapper.vm as any).canGoNext).toBe(false)
		expect(wrapper.text()).not.toContain('Next')
	})

	it('shows the Next button when the following lesson is unlocked', async () => {
		wrapper = await mountLesson()
		findResource('lms.lms.utils.get_course_outline').data = [
			{
				name: 'CH-1',
				lessons: [
					{ name: 'L1', number: '1-1', locked: 0 },
					{ name: 'L2', number: '1-2', locked: 0 },
				],
			},
		]
		findResource('lms.lms.utils.get_lesson').data = { ...baseLesson }
		await flushPromises()

		expect((wrapper.vm as any).canGoNext).toBe(true)
		expect(wrapper.text()).toContain('Next')
	})

	it('hardens goNext and switchLesson so neither navigates when the template is bypassed', async () => {
		wrapper = await mountLesson()
		findResource('lms.lms.utils.get_course_outline').data = [
			{
				name: 'CH-1',
				lessons: [
					{ name: 'L1', number: '1-1', locked: 0 },
					{ name: 'L2', number: '1-2', locked: 1 },
				],
			},
		]
		findResource('lms.lms.utils.get_lesson').data = { ...baseLesson }
		await flushPromises()
		;(wrapper.vm as any).goNext()
		;(wrapper.vm as any).switchLesson('next')

		expect(pushMock).not.toHaveBeenCalled()
	})

	it('still pushes (not replaces) for an ordinary Previous navigation', async () => {
		wrapper = await mountLesson({ chapterNumber: '1', lessonNumber: '2' })
		findResource('lms.lms.utils.get_course_outline').data = [
			{
				name: 'CH-1',
				lessons: [
					{ name: 'L1', number: '1-1', locked: 0 },
					{ name: 'L2', number: '1-2', locked: 0 },
				],
			},
		]
		findResource('lms.lms.utils.get_lesson').data = {
			...baseLesson,
			name: 'L2',
			prev: '1.1',
			next: null,
		}
		await flushPromises()
		;(wrapper.vm as any).goPrev()

		expect(pushMock).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'Lesson',
				params: {
					courseName: 'COURSE-1',
					chapterNumber: '1',
					lessonNumber: '1',
				},
			})
		)
		expect(replaceMock).not.toHaveBeenCalled()
	})

	it('falls back to Back to Course when a next lesson exists but is locked', async () => {
		// A lesson can be uncompletable for good (quiz attempts exhausted, SCORM that
		// never reports completion), and hiding the fallback along with Next left the
		// footer with no forward affordance at all and no way out of the page.
		wrapper = await mountLesson()
		findResource('lms.lms.utils.get_course_outline').data = [
			{
				name: 'CH-1',
				lessons: [
					{ name: 'L1', number: '1-1', locked: 0 },
					{ name: 'L2', number: '1-2', locked: 1 },
				],
			},
		]
		findResource('lms.lms.utils.get_lesson').data = { ...baseLesson }
		await flushPromises()

		expect(wrapper.text()).not.toContain('Next')
		expect(wrapper.text()).toContain('Back to Course')
	})

	it('falls back to Back to Course only when there truly is no next lesson', async () => {
		wrapper = await mountLesson()
		findResource('lms.lms.utils.get_course_outline').data = [
			{
				name: 'CH-1',
				lessons: [{ name: 'L1', number: '1-1', locked: 0 }],
			},
		]
		findResource('lms.lms.utils.get_lesson').data = {
			...baseLesson,
			next: null,
		}
		await flushPromises()

		expect(wrapper.text()).not.toContain('Next')
		expect(wrapper.text()).toContain('Back to Course')
	})
})

describe('Lesson.vue locked lesson payload', () => {
	it('shows the locked panel and counts down before navigating', async () => {
		vi.useFakeTimers()
		try {
			wrapper = await mountLesson()
			findResource('lms.lms.utils.get_lesson').data = {
				locked: 1,
				title: 'Lesson 3',
				course_title: 'Course 1',
				redirect_to: '2-3',
			}
			await flushPromises()

			expect(wrapper.text()).toContain('This lesson is locked')
			expect(wrapper.text()).toContain('3s')
			expect(replaceMock).not.toHaveBeenCalled()

			vi.advanceTimersByTime(1000)
			await flushPromises()
			expect(wrapper.text()).toContain('2s')
			expect(replaceMock).not.toHaveBeenCalled()

			vi.advanceTimersByTime(2000)
			await flushPromises()
			expect(replaceMock).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'Lesson',
					params: {
						courseName: 'COURSE-1',
						chapterNumber: '2',
						lessonNumber: '3',
					},
				})
			)
			expect(pushMock).not.toHaveBeenCalled()
		} finally {
			vi.useRealTimers()
		}
	})

	it('says the lesson does not exist rather than that it is locked', async () => {
		// A lesson number that resolves to nothing comes back on the same redirecting
		// payload, and the panel used to read "This lesson is locked / Finish the
		// earlier lessons to unlock this one" under a "Lesson not found" breadcrumb.
		wrapper = await mountLesson()
		findResource('lms.lms.utils.get_lesson').data = {
			locked: 1,
			not_found: 1,
			title: 'Lesson not found',
			course_title: 'Course 1',
			redirect_to: '1-1',
		}
		await flushPromises()

		expect(wrapper.text()).toContain('Lesson not found')
		expect(wrapper.text()).not.toContain('This lesson is locked')
		expect(wrapper.text()).not.toContain(
			'Finish the lessons before it to unlock this one'
		)
	})

	it('stops the countdown when the page is left before it finishes', async () => {
		vi.useFakeTimers()
		try {
			wrapper = await mountLesson()
			findResource('lms.lms.utils.get_lesson').data = {
				locked: 1,
				title: 'Lesson 3',
				course_title: 'Course 1',
				redirect_to: '2-3',
			}
			await flushPromises()

			wrapper.unmount()
			wrapper = null
			vi.advanceTimersByTime(5000)
			await flushPromises()

			expect(replaceMock).not.toHaveBeenCalled()
		} finally {
			vi.useRealTimers()
		}
	})
})

const progressHandler = () => {
	const handlerCall = socketOnMock.mock.calls.find(
		(call: unknown[]) => call[0] === 'update_lesson_progress'
	)
	expect(handlerCall).toBeDefined()
	return handlerCall![1] as (data: {
		course: string
		lesson?: string
		progress: number
	}) => void
}

describe('Lesson.vue unlocks the next lesson without a reload', () => {
	it('reloads the outline when this page marks the lesson complete', async () => {
		wrapper = await mountLesson()
		const outline = findResource('lms.lms.utils.get_course_outline')
		const progress = findResource(
			'lms.lms.doctype.course_lesson.course_lesson.save_progress'
		)
		findResource('lms.lms.utils.get_lesson').data = {
			...baseLesson,
			membership: { progress: 0 },
		}
		await flushPromises()
		outline.reload.mockClear()
		;(wrapper.vm as any).markProgress()
		await flushPromises()

		expect(progress.submit).toHaveBeenCalled()
		expect(outline.reload).toHaveBeenCalledTimes(1)
	})

	it('reloads the outline when a quiz completes the lesson', async () => {
		// Quiz.vue and Assignment.vue complete a lesson by calling
		// mark_lesson_progress directly; they never touch this page's progress
		// resource, so update_lesson_progress is the only signal that the next
		// lesson unlocked. With enforce_quiz_completion on by default, this is
		// the ordinary unlock path for a gated course.
		wrapper = await mountLesson()
		const outline = findResource('lms.lms.utils.get_course_outline')
		findResource('lms.lms.utils.get_lesson').data = {
			...baseLesson,
			membership: { progress: 0 },
		}
		await flushPromises()
		outline.reload.mockClear()

		progressHandler()({ course: 'COURSE-1', lesson: 'L1', progress: 40 })

		expect(outline.reload).toHaveBeenCalledTimes(1)
		expect((wrapper.vm as any).lessonProgress).toBe(40)
	})

	it('ignores progress events for another course', async () => {
		wrapper = await mountLesson()
		const outline = findResource('lms.lms.utils.get_course_outline')
		outline.reload.mockClear()

		progressHandler()({ course: 'OTHER-COURSE', lesson: 'L9', progress: 90 })

		expect(outline.reload).not.toHaveBeenCalled()
		expect((wrapper.vm as any).lessonProgress).not.toBe(90)
	})

	it('takes its progress listener with it when the page is left', async () => {
		// The listener outlived the page, so revisiting the lesson N times left N
		// handlers subscribed and one progress event fired N outline reloads.
		wrapper = await mountLesson()
		const handler = progressHandler()

		wrapper.unmount()

		expect(socketOffMock).toHaveBeenCalledWith(
			'update_lesson_progress',
			handler
		)
	})

	it('does not reload twice for the completion this page already handled', async () => {
		wrapper = await mountLesson()
		const outline = findResource('lms.lms.utils.get_course_outline')
		findResource('lms.lms.utils.get_lesson').data = {
			...baseLesson,
			membership: { progress: 0 },
		}
		await flushPromises()
		;(wrapper.vm as any).markProgress()
		await flushPromises()
		outline.reload.mockClear()

		progressHandler()({ course: 'COURSE-1', lesson: 'L1', progress: 40 })

		expect(outline.reload).not.toHaveBeenCalled()
	})
})

describe('Lesson.vue Next survives an outline that never resolves', () => {
	it('shows Next from lesson.data.next while the outline is still unresolved', async () => {
		wrapper = await mountLesson()
		findResource('lms.lms.utils.get_lesson').data = { ...baseLesson }
		await flushPromises()

		expect(findResource('lms.lms.utils.get_course_outline').data).toBeNull()
		expect((wrapper.vm as any).canGoNext).toBe(true)
		expect(wrapper.text()).toContain('Next')
	})

	it('still offers Back to Course on the last lesson with no outline', async () => {
		wrapper = await mountLesson()
		findResource('lms.lms.utils.get_lesson').data = {
			...baseLesson,
			next: null,
		}
		await flushPromises()

		expect((wrapper.vm as any).canGoNext).toBe(false)
		expect(wrapper.text()).toContain('Back to Course')
	})

	it('switchLesson navigates on the unresolved-outline fallback', async () => {
		wrapper = await mountLesson()
		findResource('lms.lms.utils.get_lesson').data = { ...baseLesson }
		await flushPromises()
		;(wrapper.vm as any).switchLesson('next')

		expect(pushMock).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'Lesson',
				params: {
					courseName: 'COURSE-1',
					chapterNumber: '1',
					lessonNumber: '2',
				},
			})
		)
	})

	it('goNext stays put while the outline is unresolved, since it has no index', async () => {
		wrapper = await mountLesson()
		findResource('lms.lms.utils.get_lesson').data = { ...baseLesson }
		await flushPromises()
		;(wrapper.vm as any).goNext()

		expect(pushMock).not.toHaveBeenCalled()
	})
})
