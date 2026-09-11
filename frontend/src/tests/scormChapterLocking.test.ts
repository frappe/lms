/**
 * `launch_file` is permlevel 1, so this page can no longer read the Course Chapter doc.
 * get_scorm_playback answers locked / not-entitled / no-lesson / playing, and these
 * mounts exercise the REAL branches of the page against that answer.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'

const replaceMock = vi.hoisted(() => vi.fn())
const reloadMock = vi.hoisted(() => vi.fn())
const toastError = vi.hoisted(() => vi.fn())
// URLs whose submit answers onError instead of onSuccess, so a resource can be made
// to fail the way the network makes it fail. Empty for every other test.
const failing = vi.hoisted(() => new Set<string>())
const created = vi.hoisted(() => ({
	list: [] as any[],
	docs: [] as any[],
	lists: [] as any[],
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
					if (failing.has(config?.url)) {
						const error = new Error(`${config.url} refused`)
						resource.error = error
						config?.onError?.(error)
						handlers?.onError?.(error)
						return Promise.resolve()
					}
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
		// Recorded, never used: reading the chapter doc is exactly what permlevel 1
		// took away, so a page that still does it is the bug this file guards.
		createDocumentResource: (config: any) => {
			created.docs.push(config)
			return reactive({ doc: null, _config: config })
		},
		// Recorded, never used: a list resource on this page reads no enrolment row, and
		// frappe-ui refetches the list on insert.onSuccess -- an unfiltered LMS Enrollment
		// list read on the way out of enrolling.
		createListResource: (config: any) => {
			created.lists.push(config)
			return reactive({ data: null, insert: { submit: vi.fn() } })
		},
		call: vi.fn(() => Promise.resolve()),
		toast: { error: toastError, success: vi.fn() },
		usePageMeta: vi.fn(),
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
const INSERT_URL = 'frappe.client.insert'
const PROGRESS_URL = 'frappe.client.get_value'
const LAUNCH_FILE = '/private/scorm/COURSE-1/SCORM%20Chapter/index.html'

const findResource = (url: string) =>
	created.list.find((resource) => resource._config.url === url)

async function mountChapter() {
	const wrapper = mount(SCORMChapter, {
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

// The server answering is what starts the page: it submits the progress lookup, and
// only then does the iframe mount.
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
const originalLocation = Object.getOwnPropertyDescriptor(
	window,
	'location'
) as PropertyDescriptor

beforeEach(() => {
	created.list.length = 0
	created.docs.length = 0
	created.lists.length = 0
	replaceMock.mockReset()
	reloadMock.mockReset()
	toastError.mockReset()
	failing.clear()
	Object.defineProperty(window, 'location', {
		configurable: true,
		value: { ...window.location, reload: reloadMock },
	})
})

afterEach(() => {
	wrapper?.unmount()
	Object.defineProperty(window, 'location', originalLocation)
})

describe('SCORMChapter.vue plays what the server says it may play', () => {
	it('never reads the chapter doc, which no longer carries the launch file', async () => {
		wrapper = await mountChapter()
		await answerPlayback(playbackAnswer())

		expect(created.docs).toHaveLength(0)
		expect(findResource(PLAYBACK_URL)._config.makeParams()).toEqual({
			chapter: 'CH-SCORM',
		})
	})

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

	it('holds the iframe back until the progress lookup answers', async () => {
		// The SCORM API hands the package cmi.suspend_data out of that lookup, so a
		// frame mounted before it lands would resume the student from nothing.
		wrapper = await mountChapter()
		findResource(PLAYBACK_URL).data = playbackAnswer()
		await flushPromises()

		expect(wrapper.find('iframe').exists()).toBe(false)
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

	it('enrols through one insert and lists no enrolment at all', async () => {
		wrapper = await mountChapter()
		await answerPlayback(
			playbackAnswer({ locked: 0, can_access: 0, launch_file: null })
		)

		expect(created.lists).toHaveLength(0)

		await wrapper.find('button').trigger('click')
		await flushPromises()

		expect(findResource(INSERT_URL)._config.makeParams()).toEqual({
			doc: {
				doctype: 'LMS Enrollment',
				course: 'COURSE-1',
				member: 'student@example.com',
			},
		})
		expect(findResource(INSERT_URL).submit).toHaveBeenCalled()
		expect(reloadMock).toHaveBeenCalled()
	})

	it('a control: a resume lookup that answers says nothing to the student', async () => {
		// Read before the two below. If the toast fired on the ordinary path, the
		// assertions there would pass against a page that shouts on every load.
		wrapper = await mountChapter()
		await answerPlayback(playbackAnswer())

		expect(wrapper.find('iframe').exists()).toBe(true)
		expect(toastError).not.toHaveBeenCalled()
	})

	it('plays the package when the resume lookup fails, rather than nothing at all', async () => {
		// readyToRender was set only in progress.onSuccess and progress had no onError, so
		// a failed read on a chapter the server called playable matched no branch at all —
		// hasNoPackage is false too — and the student got a blank page under the header.
		wrapper = await mountChapter()
		failing.add(PROGRESS_URL)
		await answerPlayback(playbackAnswer())

		expect(wrapper.find('iframe').attributes('src')).toBe(LAUNCH_FILE)
		for (const notice of [
			'This lesson is locked',
			'This chapter has no lesson to play yet',
			'You are not enrolled in this course',
			'This lesson has no content to play yet',
		]) {
			expect(wrapper.text()).not.toContain(notice)
		}
	})

	it('says the resume point was lost rather than restarting the lesson in silence', async () => {
		// The server has already decided playability, so the frame goes up either way.
		// What is lost is cmi.suspend_data, which restarts a package that may be long;
		// silence reads as progress destroyed rather than progress not loaded.
		wrapper = await mountChapter()
		failing.add(PROGRESS_URL)
		await answerPlayback(playbackAnswer())

		expect(toastError).toHaveBeenCalledTimes(1)
		expect(toastError.mock.calls[0][0]).toContain('saved progress')
		expect(toastError.mock.calls[0][1].description).toContain(
			'from the beginning'
		)
	})

	it('saves progress against the lesson the server named', async () => {
		// The other half of the move off the chapter doc: saveProgress read
		// chapter.doc.lessons[0].lesson, a child table the permlevel read no longer
		// carries. It now takes the lesson out of the playback answer.
		const { call } = (await import('frappe-ui')) as any
		call.mockClear()
		wrapper = await mountChapter()
		await answerPlayback(playbackAnswer())
		;(window as any).API.LMSSetValue('cmi.core.lesson_status', 'passed')
		await flushPromises()

		expect(call).toHaveBeenCalledWith(
			'lms.lms.doctype.course_lesson.course_lesson.save_progress',
			expect.objectContaining({ lesson: 'L-SCORM', course: 'COURSE-1' })
		)
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
