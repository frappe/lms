/**
 * Mounts the real Lesson.vue (harness from lessonLocking.test.ts) to check the
 * hold it places on markLessonProgress, which quizzes and assignments call.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'

const pushMock = vi.hoisted(() => vi.fn())
const callMock = vi.hoisted(() =>
	vi.fn((..._args: unknown[]) => Promise.resolve())
)
const replaceMock = vi.hoisted(() => vi.fn())
const socketOnMock = vi.hoisted(() => vi.fn())
const socketOffMock = vi.hoisted(() => vi.fn())
const created = vi.hoisted(() => ({ list: [] as any[] }))
const players = vi.hoisted(() => ({ list: [] as any[] }))
const settings = vi.hoisted(() => ({
	data: {} as Record<string, unknown>,
	promise: Promise.resolve(),
}))
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
		call: callMock,
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
	enablePlyr: () => Promise.resolve(players.list),
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
	useSettings: () => ({ settings }),
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
vi.mock('@/components/Layouts/pages/PageHeader.vue', () => ({
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
import { markLessonProgress } from '@/utils/markLessonProgress'

const SAVE_PROGRESS =
	'lms.lms.doctype.course_lesson.course_lesson.save_progress'

const findResource = (url: string) =>
	created.list.find((resource) => resource._config.url === url)

async function mountLesson(
	props: { chapterNumber: string; lessonNumber: string } = {
		chapterNumber: '1',
		lessonNumber: '1',
	},
	user: { name: string } | null = { name: 'student@example.com' }
) {
	const wrapper = mount(Lesson, {
		props: { courseName: 'COURSE-1', ...props },
		global: {
			mocks: { __: translateStub },
			provide: {
				$user: { data: user },
				$socket: { on: socketOnMock, off: socketOffMock },
			},
		},
	})
	await flushPromises()
	return wrapper
}

class FakePlayer {
	source = 'https://www.youtube.com/watch?v=abc'
	currentTime = 0
	duration = 100
	embed = { seekTo: vi.fn() }
	play = vi.fn()
	pause = vi.fn()
	private handlers: Record<string, ((event: object) => void)[]> = {}
	on(event: string, handler: (event: object) => void): void {
		;(this.handlers[event] ??= []).push(handler)
	}
	emit(event: string): void {
		this.handlers[event]?.forEach((handler) => handler({}))
	}
}

const enrolledLesson = {
	name: 'L1',
	title: 'Lesson 1',
	course_title: 'Course 1',
	chapter_title: 'Chapter 1',
	prev: null,
	next: null,
	instructors: [],
	membership: { name: 'ENR-1', progress: 0 },
	progress: 0,
}

const markCalls = () =>
	callMock.mock.calls.filter(
		([method]) => method === 'lms.lms.api.mark_lesson_progress'
	)

const openLesson = async (enforceVideo: number): Promise<FakePlayer> => {
	settings.data = { enforce_video_completion: enforceVideo }
	const player = new FakePlayer()
	players.list = [player]
	wrapper = await mountLesson()
	findResource('lms.lms.utils.get_lesson').data = { ...enrolledLesson }
	await flushPromises()
	return player
}

let wrapper: VueWrapper

beforeEach(() => {
	created.list.length = 0
	callMock.mockClear()
	window.history.pushState({}, '', '/lms/courses/COURSE-1/learn/1-1')
})

afterEach(() => wrapper?.unmount())

// Regression from #2426: a quiz or assignment submit completed an
// enforced-video lesson before the video ended. Added on fix/course-progress-enforcement (no PR yet).
describe('a quiz or assignment submit on an enforced-video lesson', () => {
	it('does not complete the lesson before the video ends', async () => {
		await openLesson(1)
		markLessonProgress()
		expect(markCalls()).toHaveLength(0)
	})

	it('completes the lesson once the video has ended', async () => {
		const player = await openLesson(1)
		player.emit('ended')
		expect(findResource(SAVE_PROGRESS).submit).toHaveBeenCalled()
		markLessonProgress()
		expect(markCalls()).toHaveLength(1)
	})

	it('completes the lesson straight away when video is not enforced', async () => {
		await openLesson(0)
		markLessonProgress()
		expect(markCalls()).toHaveLength(1)
	})

	it('stops waiting once the page is left', async () => {
		await openLesson(1)
		wrapper.unmount()
		markLessonProgress()
		expect(markCalls()).toHaveLength(1)
	})
})
