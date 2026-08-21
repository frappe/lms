/**
 * SCORMChapter.vue is reached by its own route and never calls get_lesson: it
 * reads the Course Chapter doc directly and iframes its launch file. These
 * mounts exercise the REAL `isLocked` / `currentLessonNumber` computeds and the
 * REAL `goToCurrentLesson` handler against the course outline payload.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'

const replaceMock = vi.hoisted(() => vi.fn())
const created = vi.hoisted(() => ({ list: [] as any[], docs: [] as any[] }))

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
		createDocumentResource: (config: any) => {
			const resource: any = reactive({
				doc: {
					name: 'CH-SCORM',
					title: 'SCORM Chapter',
					course: 'COURSE-1',
					course_title: 'Course 1',
					launch_file: '/private/scorm/COURSE-1/SCORM%20Chapter/index.html',
					lessons: [{ lesson: 'L-SCORM' }],
				},
				_config: config,
			})
			created.docs.push(resource)
			return resource
		},
		createListResource: () => {
			const resource: any = reactive({
				data: [{ member: 'student@example.com', course: 'COURSE-1' }],
				loading: false,
				insert: { submit: vi.fn() },
				reload: vi.fn(),
				fetch: vi.fn(),
			})
			return resource
		},
		call: vi.fn(() => Promise.resolve()),
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
vi.mock('@/components/Layouts/PageHeader.vue', () => ({
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
		launch_file: null,
		lessons: [{ name: 'L-SCORM', number: '2-1', locked: 1, is_complete: 0 }],
	},
]

const openOutline = [
	{
		name: 'CH-1',
		lessons: [{ name: 'L1', number: '1-1', locked: 0, is_complete: 1 }],
	},
	{
		name: 'CH-SCORM',
		launch_file: '/private/scorm/COURSE-1/SCORM%20Chapter/index.html',
		lessons: [{ name: 'L-SCORM', number: '2-1', locked: 0, is_complete: 0 }],
	},
]

let wrapper: VueWrapper

beforeEach(() => {
	created.list.length = 0
	created.docs.length = 0
	replaceMock.mockReset()
})

afterEach(() => {
	wrapper?.unmount()
})

// readyToRender only flips once the chapter doc resolves and the progress lookup
// comes back, which is the sequence the page itself wires up.
async function resolveChapter() {
	created.docs[0]._config.onSuccess?.(created.docs[0].doc)
	await flushPromises()
}

describe('SCORMChapter.vue refuses a gated chapter', () => {
	it('renders the locked panel instead of the package iframe', async () => {
		wrapper = await mountChapter()
		findResource('lms.lms.utils.get_course_outline').data = gatedOutline
		await resolveChapter()

		expect((wrapper.vm as any).isLocked).toBe(true)
		expect(wrapper.text()).toContain('This lesson is locked')
		expect(wrapper.find('iframe').exists()).toBe(false)
	})

	it('counts down and then sends the student to the lesson they may open', async () => {
		vi.useFakeTimers()
		try {
			wrapper = await mountChapter()
			findResource('lms.lms.utils.get_course_outline').data = gatedOutline
			await resolveChapter()

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

	it('renders the package once the chapter is unlocked', async () => {
		wrapper = await mountChapter()
		findResource('lms.lms.utils.get_course_outline').data = openOutline
		await resolveChapter()

		expect((wrapper.vm as any).isLocked).toBe(false)
		expect(wrapper.find('iframe').exists()).toBe(true)
	})

	it('does not lock a course whose outline carries no lock flags at all', async () => {
		wrapper = await mountChapter()
		findResource('lms.lms.utils.get_course_outline').data = [
			{ name: 'CH-SCORM', lessons: [{ name: 'L-SCORM', number: '1-1' }] },
		]
		await resolveChapter()

		expect((wrapper.vm as any).isLocked).toBe(false)
		expect(wrapper.find('iframe').exists()).toBe(true)
	})

	it('holds the iframe back while the outline is still unresolved', async () => {
		// The chapter doc and its progress resolve on their own chain, so the iframe
		// could mount before the lock was known -- and the student read the server's
		// 403 page for the package before the locked notice replaced it.
		wrapper = await mountChapter()
		await resolveChapter()

		expect((wrapper.vm as any).isLocked).toBe(false)
		expect(wrapper.find('iframe').exists()).toBe(false)
	})

	it('renders the package anyway when the outline request fails', async () => {
		// Waiting forever on an outline that will never arrive would leave a blank
		// page; the bytes are refused server side either way.
		wrapper = await mountChapter()
		findResource('lms.lms.utils.get_course_outline').error = new Error('boom')
		await resolveChapter()

		expect((wrapper.vm as any).isLocked).toBe(false)
		expect(wrapper.find('iframe').exists()).toBe(true)
	})
})
