// Lesson.vue gates its Notes tab, inline notes menu and Community tab on the
// session user's doctype permissions, so a role stripped of them sees nothing.
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

// Mirrors src/translation.js: a {0} placeholder returns a { format } object,
// so a "__(...).format is not a function" crash is not hidden.
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
import type { DoctypePermissionType, SessionUser } from '@/types'

const findResource = (url: string) =>
	created.list.find((resource) => resource._config.url === url)

type Perms = Record<DoctypePermissionType, 0 | 1>

const ALL: Perms = { read: 1, write: 1, create: 1, delete: 1 }
const NONE: Perms = { read: 0, write: 0, create: 0, delete: 0 }

const studentWith = (
	perms: Record<string, Perms>,
	extra: Record<string, unknown> = {}
): SessionUser => ({
	data: { name: 'student@example.com', permissions: perms, ...extra },
})

const everything = {
	'LMS Lesson Note': ALL,
	'Discussion Topic': ALL,
	'Discussion Reply': ALL,
}

let wrapper: VueWrapper | undefined

beforeEach(() => {
	created.list.length = 0
})

afterEach(() => {
	wrapper?.unmount()
	wrapper = undefined
})

async function openLesson(
	perms: Record<string, Perms>,
	{
		membership = { name: 'M1', progress: 0 } as object | null,
		user = {} as Record<string, unknown>,
	} = {}
) {
	wrapper = mount(Lesson, {
		props: { courseName: 'COURSE-1', chapterNumber: '1', lessonNumber: '1' },
		global: {
			mocks: { __: translateStub },
			provide: {
				$user: studentWith(perms, user),
				$socket: { on: socketOnMock, off: socketOffMock },
			},
		},
	})
	await flushPromises()
	findResource('lms.lms.utils.get_lesson').data = {
		name: 'L1',
		title: 'Lesson 1',
		course_title: 'Course 1',
		chapter_title: 'Chapter 1',
		prev: null,
		next: '1.2',
		instructors: [],
		membership,
		content: JSON.stringify({ blocks: [] }),
	}
	await flushPromises()
	;(wrapper.vm as any).checkIfDiscussionsAllowed()
	await flushPromises()
}

const rendered = (name: string) => wrapper!.findComponent({ name }).exists()

describe('lesson community tabs follow doctype permissions (#2538)', () => {
	it('shows notes and discussions to a student holding both', async () => {
		await openLesson(everything)
		expect(rendered('Notes')).toBe(true)
		expect(rendered('InlineLessonMenu')).toBe(true)
		const tabs = (wrapper!.vm as any).tabs.map((t: any) => t.value)
		expect(tabs).toEqual(['Notes', 'Community'])
	})

	it('drops the Community tab without read on Discussion Topic', async () => {
		await openLesson({ ...everything, 'Discussion Topic': NONE })
		const tabs = (wrapper!.vm as any).tabs.map((t: any) => t.value)
		expect(tabs).toEqual(['Notes'])
		expect(rendered('Notes')).toBe(true)
		expect(rendered('Discussions')).toBe(false)
	})

	it('drops notes and the inline menu without LMS Lesson Note perms', async () => {
		await openLesson({ ...everything, 'LMS Lesson Note': NONE })
		const tabs = (wrapper!.vm as any).tabs.map((t: any) => t.value)
		expect(tabs).toEqual(['Community'])
		expect(rendered('Notes')).toBe(false)
		expect(rendered('InlineLessonMenu')).toBe(false)
		expect(rendered('Discussions')).toBe(true)
	})

	it('renders no community section when every doctype is denied', async () => {
		await openLesson({})
		expect(rendered('Notes')).toBe(false)
		expect(rendered('Discussions')).toBe(false)
		expect(rendered('InlineLessonMenu')).toBe(false)
		expect(rendered('TabButtons')).toBe(false)
	})

	it('keeps notes and discussions out of a lesson previewed without enrolling', async () => {
		await openLesson(everything, { membership: null })
		expect((wrapper!.vm as any).tabs).toEqual([])
		expect(rendered('Notes')).toBe(false)
		expect(rendered('InlineLessonMenu')).toBe(false)
		expect(rendered('Discussions')).toBe(false)
	})

	it("keeps a course creator out of another course's lesson community", async () => {
		// is_instructor is the site-wide Course Creator role, not this course's.
		await openLesson(everything, {
			membership: null,
			user: { is_instructor: true, username: 'creator' },
		})
		expect((wrapper!.vm as any).tabs).toEqual([])
	})
})
