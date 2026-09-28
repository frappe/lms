// Guards the Highlight / Add to Notes menu opening on text inside a block.
// Came with this branch's inline assessment blocks in the lesson body.
// Added on feat/assessment-visual-redesign to keep the menu on lesson prose.
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

let wrapper: VueWrapper | undefined

beforeEach(() => {
	created.list.length = 0
})

afterEach(() => {
	wrapper?.unmount()
	wrapper = undefined
	window.getSelection()?.removeAllRanges()
	document.body.replaceChildren()
})

const openLesson = async () => {
	wrapper = await mountLesson()
	findResource('lms.lms.utils.get_lesson').data = {
		...baseLesson,
		content: JSON.stringify({ blocks: [] }),
	}
	await flushPromises()
	const body = document.createElement('div')
	body.id = 'editor'
	body.innerHTML = `<p id="text">Lesson prose.</p><div data-assessment-block><p id="block">Quiz prose.</p></div>`
	document.body.append(body)
}

const selectIn = (id: string) => {
	const node = document.getElementById(id)!.firstChild!
	window.getSelection()!.setBaseAndExtent(node, 0, node, 4)
}

describe('the lesson notes menu', () => {
	it('opens for a selection of lesson text', async () => {
		await openLesson()
		selectIn('text')

		await (wrapper!.vm as any).toggleInlineMenu()

		expect((wrapper!.vm as any).showInlineMenu).toBe(true)
	})

	it('stays shut for a selection inside an assessment block', async () => {
		await openLesson()
		selectIn('block')

		await (wrapper!.vm as any).toggleInlineMenu()

		expect((wrapper!.vm as any).showInlineMenu).toBe(false)
	})
})
