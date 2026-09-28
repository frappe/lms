import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'

const pushMock = vi.hoisted(() => vi.fn())
const replaceMock = vi.hoisted(() => vi.fn())
const socketOnMock = vi.hoisted(() => vi.fn())
const socketOffMock = vi.hoisted(() => vi.fn())
const created = vi.hoisted(() => ({ list: [] as any[] }))
const editors = vi.hoisted(() => ({
	list: [] as { destroy: () => void }[],
	nextReady: null as Promise<void> | null,
}))
const route = vi.hoisted(() => ({ value: null as any }))
const stub = vi.hoisted(() => (name: string) => ({
	name,
	template: `<div><slot /></div>`,
}))

vi.mock('vue-router', async () => {
	const { reactive } = await import('vue')
	route.value = reactive({
		params: { chapterNumber: '1', lessonNumber: '1' },
		query: {},
	})
	return {
		useRoute: () => route.value,
		useRouter: () => ({ push: pushMock, replace: replaceMock }),
	}
})

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

// Like EditorJS: the holder is looked up once the editor is ready, a marker is
// rendered into it, and destroy() empties it (UI.destroy: innerHTML = '').
vi.mock('@editorjs/editorjs', () => ({
	default: class {
		isReady: Promise<void>
		holder: HTMLElement | null = null
		destroy = vi.fn(() => {
			if (this.holder) this.holder.innerHTML = ''
		})
		constructor({ holder }: { holder: HTMLElement | string }) {
			this.isReady = (editors.nextReady ?? Promise.resolve()).then(() => {
				this.holder =
					typeof holder === 'string' ? document.getElementById(holder) : holder
				this.holder?.insertAdjacentHTML('beforeend', '<p class="rendered"></p>')
			})
			editors.nextReady = null
			editors.list.push(this)
		}
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
		attachTo: document.body,
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

const content = (text: string) =>
	JSON.stringify({ blocks: [{ type: 'paragraph', data: { text } }] })

const lessonWithEditors = {
	...baseLesson,
	content: content('Body'),
	instructor_content: JSON.stringify({
		blocks: [
			{ type: 'paragraph', data: { text: 'Note 1' } },
			{ type: 'paragraph', data: { text: 'Note 2' } },
		],
	}),
}

let wrapper: VueWrapper | undefined

beforeEach(() => {
	created.list.length = 0
	editors.list.length = 0
	editors.nextReady = null
	pushMock.mockReset()
	route.value.params.chapterNumber = '1'
	route.value.params.lessonNumber = '1'
})

afterEach(() => {
	wrapper?.unmount()
	wrapper = undefined
})

const openLessonWithEditors = async () => {
	wrapper = await mountLesson()
	findResource('lms.lms.utils.get_lesson').data = { ...lessonWithEditors }
	await flushPromises()
	expect(editors.list).toHaveLength(2)
	return editors.list.slice()
}

// Guards lesson editors being dropped without destroy(), leaking inline apps.
// Broke in #876 (editors nulled on a lesson change, never destroyed).
// Added on feat/assessment-visual-redesign once blocks mounted their own apps.
describe('Lesson.vue editor teardown', () => {
	it('destroys both editors when the learner moves to another lesson', async () => {
		const [body, notes] = await openLessonWithEditors()

		route.value.params.lessonNumber = '2'
		await flushPromises()

		expect(body.destroy).toHaveBeenCalledTimes(1)
		expect(notes.destroy).toHaveBeenCalledTimes(1)
	})

	it('destroys both editors when the lesson page unmounts', async () => {
		const [body, notes] = await openLessonWithEditors()

		wrapper!.unmount()
		wrapper = undefined
		await flushPromises()

		expect(body.destroy).toHaveBeenCalledTimes(1)
		expect(notes.destroy).toHaveBeenCalledTimes(1)
	})

	// Guards a blank first load: the holder sits under v-if="lesson.data".
	// Came with this branch's attach-each-holder-after-render change.
	// Added on feat/assessment-visual-redesign to pin the late holder lookup.
	it('renders the lesson body on first load', async () => {
		await openLessonWithEditors()

		expect(document.querySelector('#editor .rendered')).not.toBeNull()
	})

	// Guards a slow old editor's destroy() blanking the next lesson's holder.
	// Came with this branch's destroy-editors-on-lesson-change fix.
	// Added on feat/assessment-visual-redesign to pin one holder per editor.
	it("keeps the next lesson's content when the old editor finishes starting late", async () => {
		let ready: () => void = () => {}
		editors.nextReady = new Promise((done) => (ready = done))
		await openLessonWithEditors()

		route.value.params.lessonNumber = '2'
		await flushPromises()
		findResource('lms.lms.utils.get_lesson').data = { ...lessonWithEditors }
		await flushPromises()
		ready()
		await flushPromises()

		expect(document.querySelector('#editor .rendered')).not.toBeNull()
	})
})
