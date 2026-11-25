/**
 * `launch_file` is permlevel 1, so this page can no longer read the Course Chapter doc.
 * get_scorm_playback answers locked / not-entitled / no-lesson / playing, and these
 * mounts exercise the REAL branches of the page against that answer.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'

const replaceMock = vi.hoisted(() => vi.fn())
const toastError = vi.hoisted(() => vi.fn())
const created = vi.hoisted(() => ({
	list: [] as any[],
}))

vi.mock('vue-router', () => ({
	useRouter: () => ({ push: vi.fn(), replace: replaceMock }),
}))

vi.mock('frappe-ui', async () => {
	const { reactive } = await import('vue')
	return {
		createResource: (config: any) => {
			const resource: any = reactive({
				data: null,
				error: null,
				loading: false,
				_config: config,
				submit: vi.fn((_params: any, handlers: any) => {
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
		call: vi.fn(() => Promise.resolve()),
		toast: { error: toastError, success: vi.fn() },
		usePageMeta: vi.fn(),
		LoadingIndicator: {
			name: 'LoadingIndicator',
			template: '<span data-testid="loading" />',
		},
		Button: {
			name: 'Button',
			template: `<button><slot name="prefix" /><slot name="icon" /><slot /></button>`,
		},
	}
})

vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ brand: {} }),
}))
vi.mock('@/stores/sidebar', () => ({
	useSidebar: () => ({ isSidebarCollapsed: false }),
}))
vi.mock('@/components/Layouts/pages/PageHeader.vue', () => ({
	default: { name: 'PageHeader', template: '<div><slot /></div>' },
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

import SCORMChapter from '@/pages/SCORMChapter.vue'

const PLAYBACK_URL =
	'lms.lms.doctype.course_chapter.course_chapter.get_scorm_playback'
const OUTLINE_URL = 'lms.lms.utils.get_course_outline'
const LAUNCH_FILE =
	'/scorm-play/0123456789abcdef0123456789abcdef/COURSE-1/CH-SCORM/index.html'

const findResource = (url: string) =>
	created.list.find((resource) => resource._config.url === url)

async function mountChapter() {
	const wrapper = mount(SCORMChapter, {
		// In the document, so the iframe has a window a package message can come from.
		attachTo: document.body,
		props: { courseName: 'COURSE-1', chapterName: 'CH-SCORM' },
		global: {
			mocks: { __: translateStub },
			provide: { $user: { data: { name: 'student@example.com' } } },
		},
	})
	await flushPromises()
	return wrapper
}

const playbackAnswer = (overrides: Record<string, unknown> = {}) => ({
	chapter: 'CH-SCORM',
	course: 'COURSE-1',
	title: 'SCORM Chapter',
	course_title: 'Course 1',
	lesson: 'L-SCORM',
	locked: 0,
	can_access: 1,
	launch_file: LAUNCH_FILE,
	...overrides,
})

// The server answering is what starts the page: the iframe mounts on its answer.
async function answerPlayback(payload: Record<string, unknown>) {
	const playback = findResource(PLAYBACK_URL)
	playback.data = payload
	playback._config.onSuccess?.(payload)
	await flushPromises()
}

// Chapter 1 is an ordinary incomplete lesson, chapter 2 is the SCORM package.
const gatedOutline = [
	{
		name: 'CH-1',
		lessons: [
			{ name: 'L1', number: '1-1', locked: 0, is_complete: 0 },
			{ name: 'L2', number: '1-2', locked: 1, is_complete: 0 },
		],
	},
	{
		name: 'CH-SCORM',
		lessons: [{ name: 'L-SCORM', number: '2-1', locked: 1, is_complete: 0 }],
	},
]

let wrapper: VueWrapper

// What the SCORM API inlined into the sandboxed package posts to the player.
const postFromPackage = (
	data: Record<string, unknown>,
	origin = 'null'
) => {
	const source = wrapper.find('iframe').element as HTMLIFrameElement
	window.dispatchEvent(
		new MessageEvent('message', {
			data: { source: 'lms-scorm', ...data },
			origin,
			source: source.contentWindow,
		})
	)
}

beforeEach(() => {
	created.list.length = 0
	replaceMock.mockReset()
	toastError.mockReset()
})

afterEach(() => {
	wrapper?.unmount()
})

describe('SCORMChapter.vue plays what the server says it may play', () => {
	it('renders the package the server handed it', async () => {
		wrapper = await mountChapter()
		await answerPlayback(playbackAnswer())

		expect(wrapper.find('iframe').attributes('src')).toBe(LAUNCH_FILE)
		expect(wrapper.find('iframe').attributes('title')).toBe('SCORM Chapter')
		expect(findResource(OUTLINE_URL).fetch).not.toHaveBeenCalled()
	})

	it('renders the locked panel instead of the package iframe', async () => {
		wrapper = await mountChapter()
		await answerPlayback(
			playbackAnswer({ locked: 1, can_access: 1, launch_file: null })
		)

		expect((wrapper.vm as any).isLocked).toBe(true)
		expect(wrapper.text()).toContain('This lesson is locked')
		expect(wrapper.find('iframe').exists()).toBe(false)
		// Only the locked branch needs the outline, and only to name the lesson to
		// resume at.
		expect(findResource(OUTLINE_URL).fetch).toHaveBeenCalled()
	})

	it('sends an unentitled student to enrol rather than showing a locked notice', async () => {
		wrapper = await mountChapter()
		await answerPlayback(
			playbackAnswer({ locked: 0, can_access: 0, launch_file: null })
		)

		expect((wrapper.vm as any).isLocked).toBe(false)
		expect(wrapper.text()).toContain('You are not enrolled in this course')
		expect(wrapper.text()).not.toContain('This lesson is locked')
		expect(wrapper.find('iframe').exists()).toBe(false)
	})

	it('says so when an unlocked chapter has no package rather than showing a blank frame', async () => {
		wrapper = await mountChapter()
		await answerPlayback(playbackAnswer({ launch_file: null }))

		expect(wrapper.text()).toContain('This lesson has no content to play yet')
		expect(wrapper.find('iframe').exists()).toBe(false)
	})

	it('refuses a launch file the URL allowlist rejects', async () => {
		// launchFile runs through safeUrl, which returns undefined for anything outside
		// the scheme allowlist. Binding it raw would mount an iframe with no src, which
		// renders the whole SPA inside itself and matches no other branch.
		wrapper = await mountChapter()
		await answerPlayback(playbackAnswer({ launch_file: 'javascript:alert(1)' }))

		expect(wrapper.find('iframe').exists()).toBe(false)
		expect(wrapper.text()).toContain('This lesson has no content to play yet')
	})

	it('ignores the outline lock flags and believes the server', async () => {
		// The outline is fetched for navigation only. Deriving the lock from it here
		// would be the client deciding a permission it is not the source of truth for.
		wrapper = await mountChapter()
		findResource(OUTLINE_URL).data = gatedOutline
		await answerPlayback(playbackAnswer())

		expect((wrapper.vm as any).isLocked).toBe(false)
		expect(wrapper.find('iframe').exists()).toBe(true)
	})

	it('counts down and then sends the student to the lesson they may open', async () => {
		vi.useFakeTimers()
		try {
			wrapper = await mountChapter()
			findResource(OUTLINE_URL).data = gatedOutline
			await answerPlayback(
				playbackAnswer({ locked: 1, can_access: 1, launch_file: null })
			)

			expect(wrapper.text()).toContain('3s')
			expect(replaceMock).not.toHaveBeenCalled()

			vi.advanceTimersByTime(3000)
			await flushPromises()

			expect(replaceMock).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'Lesson',
					params: {
						courseName: 'COURSE-1',
						chapterNumber: '1',
						lessonNumber: '1',
					},
				})
			)
		} finally {
			vi.useRealTimers()
		}
	})

	it('tells a chapter with no lesson apart from an account with no enrolment', async () => {
		// delete_lesson drops the Lesson Reference and leaves the chapter, so the server
		// refuses the package. Read as a missing enrolment it asks the course's own
		// instructor to enrol in their own course, and the button does exactly that.
		wrapper = await mountChapter()
		await answerPlayback(
			playbackAnswer({ lesson: null, can_access: 0, launch_file: null })
		)

		expect(wrapper.text()).not.toContain('You are not enrolled in this course')
		expect(wrapper.find('button').exists()).toBe(false)
		expect(wrapper.text()).toContain('This chapter has no lesson to play yet')
		expect((wrapper.vm as any).hasNoLesson).toBe(true)
		expect((wrapper.vm as any).isNotEntitled).toBe(false)
	})

	it('saves progress against the lesson the server named', async () => {
		// The other half of the move off the chapter doc: saveProgress read
		// chapter.doc.lessons[0].lesson, a child table the permlevel read no longer
		// carries. It now takes the lesson out of the playback answer.
		const { call } = (await import('frappe-ui')) as any
		call.mockClear()
		wrapper = await mountChapter()
		await answerPlayback(playbackAnswer())
		postFromPackage({ key: 'cmi.core.lesson_status', value: 'passed' })
		await flushPromises()

		expect(call).toHaveBeenCalledWith(
			'lms.lms.doctype.course_lesson.course_lesson.save_progress',
			expect.objectContaining({ lesson: 'L-SCORM', course: 'COURSE-1' })
		)
	})

	it('plays the package in a sandbox without the site origin', async () => {
		// The package is the course author's markup. With allow-same-origin it would
		// run on the LMS origin with the viewer's session.
		wrapper = await mountChapter()
		await answerPlayback(playbackAnswer())

		const frame = wrapper.find('iframe')
		expect(frame.attributes('sandbox')).toContain('allow-scripts')
		expect(frame.attributes('sandbox')).not.toContain('allow-same-origin')
		expect(frame.attributes('sandbox')).not.toContain('allow-top-navigation')
		expect(frame.attributes('referrerpolicy')).toBe('no-referrer')
		expect((window as any).API).toBeUndefined()
	})

	it('ignores progress messages that do not come from the package', async () => {
		const { call } = (await import('frappe-ui')) as any
		call.mockClear()
		wrapper = await mountChapter()
		await answerPlayback(playbackAnswer())
		const passed = {
			source: 'lms-scorm',
			key: 'cmi.core.lesson_status',
			value: 'passed',
		}

		window.dispatchEvent(
			new MessageEvent('message', { data: passed, origin: 'null', source: window })
		)
		postFromPackage(passed, 'http://evil.example')
		await flushPromises()

		expect(call).not.toHaveBeenCalled()
	})

	it('leaves for the course when the chapter does not resolve', async () => {
		// `/learn/:chapterName` also matches a lesson URL with no lesson number, so a
		// mistyped or tampered address lands here on a chapter that does not exist.
		wrapper = await mountChapter()
		findResource(PLAYBACK_URL)._config.onError?.(new Error('not found'))
		await flushPromises()

		expect(replaceMock).toHaveBeenCalledWith({
			name: 'CourseDetail',
			params: { courseName: 'COURSE-1' },
		})
	})
})
