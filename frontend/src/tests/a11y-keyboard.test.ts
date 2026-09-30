import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	flushPromises,
	mount,
	RouterLinkStub,
	shallowMount,
	type VueWrapper,
} from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

const pushMock = vi.hoisted(() => vi.fn())
const created = vi.hoisted(() => ({ list: [] as any[] }))
const seeds = vi.hoisted(() => ({} as Record<string, unknown>))

vi.mock('frappe-ui', async (importOriginal) => {
	const { reactive } = await import('vue')
	const resource = (config: any) => {
		const r: any = reactive({
			data: seeds[config?.url] ?? null,
			loading: false,
			promise: Promise.resolve(),
			_config: config,
			submit: vi.fn(() => Promise.resolve()),
			reload: vi.fn(() => Promise.resolve()),
			fetch: vi.fn(),
			update: vi.fn(),
			insert: { submit: vi.fn() },
		})
		created.list.push(r)
		return r
	}
	return {
		...(await importOriginal<Record<string, unknown>>()),
		createResource: resource,
		createListResource: resource,
		call: vi.fn(() => Promise.resolve({ name: 'PM-1' })),
		usePageMeta: vi.fn(),
		toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
	}
})

vi.mock('vue-router', async (importOriginal) => {
	const { reactive } = await import('vue')
	const route = reactive({
		params: { chapterNumber: '1', lessonNumber: '1' },
		query: {},
	})
	return {
		...(await importOriginal<Record<string, unknown>>()),
		useRoute: () => route,
		useRouter: () => ({ push: pushMock, replace: vi.fn() }),
	}
})

vi.mock('vuedraggable', () => ({
	default: {
		props: ['list'],
		template: `
			<div>
				<div v-for="item in list" :key="item.name">
					<slot name="item" :element="item" />
				</div>
			</div>
		`,
	},
}))

vi.mock('face-api.js', () => ({
	nets: { tinyFaceDetector: { loadFromUri: vi.fn(() => Promise.resolve()) } },
	detectAllFaces: vi.fn(() => Promise.resolve([])),
	TinyFaceDetectorOptions: vi.fn(),
}))

vi.mock('@editorjs/editorjs', () => ({
	default: class {
		isReady = Promise.resolve()
		destroy = vi.fn()
	},
}))

vi.mock('@/utils', () => ({
	getSidebarLinks: () => [],
	getEditorTools: () => ({}),
	enablePlyr: () => Promise.resolve([]),
	highlightText: vi.fn(),
	sanitizeEditorJs: (x: unknown) => x,
	decodeEntities: (s: string) => s,
}))

vi.mock('@/utils/openExternal', () => ({ openExternal: vi.fn() }))

vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ brand: {}, user: 'student@example.com' }),
}))

vi.mock('@framework/ui/components/TrialBanner/index', () => ({
	TrialBanner: { template: '<div />' },
}))

vi.mock('@framework/ui/components/Onboarding/index', () => ({
	HelpModal: { template: '<div />' },
	GettingStartedBanner: { template: '<div />' },
	IntermediateStepModal: { template: '<div />' },
	useOnboarding: () => ({ setUp: vi.fn(), isOnboardingStepsCompleted: true }),
	showHelpModal: { value: false },
	minimize: { value: false },
}))

vi.mock('@framework/ui/telemetry/index', () => ({
	useTelemetry: () => ({ capture: vi.fn() }),
}))

const translate = (s: string) => (globalThis as any).__(s)
const user = { data: { name: 'student@example.com' } }
const socket = { on: vi.fn(), off: vi.fn() }
const TooltipStub = { template: '<span><slot /></span>' }

seeds['lms.lms.api.get_user_info'] = { is_system_manager: true }

import ChapterRow from '@/components/ChapterRow.vue'
import StudentLessonSidebar from '@/components/StudentLessonSidebar.vue'
import VideoBlock from '@/components/VideoBlock.vue'
import AppSidebar from '@/components/Sidebar/AppSidebar.vue'
import NotificationPanel from '@/components/Notifications/NotificationPanel.vue'
import ProctoringMonitor from '@/components/ProctoringMonitor.vue'
import ProgramDetail from '@/pages/Programs/ProgramDetail.vue'
import Lesson from '@/pages/Lesson.vue'
import { markAsRead, notifications, panelVisible } from '@/stores/notifications'
import { useSidebar } from '@/stores/sidebar'
import type { OutlineChapter } from '@/types'

const findResource = (url: string) =>
	created.list.find((r) => r._config?.url === url)

const globalOptions = (extra: Record<string, unknown> = {}) => ({
	mocks: { __: translate },
	provide: { $user: user, $socket: socket, ...(extra.provide || {}) },
	stubs: {
		RouterLink: RouterLinkStub,
		Tooltip: TooltipStub,
		...(extra.stubs || {}),
	},
})

let wrapper: VueWrapper | undefined

beforeEach(() => {
	setActivePinia(createPinia())
	pushMock.mockReset()
})

afterEach(() => {
	wrapper?.unmount()
	wrapper = undefined
	document.body.innerHTML = ''
})

const chapter = (over: Partial<OutlineChapter> = {}): OutlineChapter => ({
	name: 'CH-1',
	title: 'Chapter One',
	idx: 1,
	is_scorm_package: 0 as const,
	lessons: [{ name: 'L1', title: 'Lesson One', number: '1-1' }],
	...over,
})

const scorm = (locked: 0 | 1, isComplete: 0 | 1 = 0) =>
	chapter({
		is_scorm_package: 1 as const,
		lessons: [
			{
				name: 'L1',
				title: 'SCORM',
				number: '1-1',
				locked,
				is_complete: isComplete,
			},
		],
	})

const mountChapter = (c: OutlineChapter, props: Record<string, unknown> = {}) =>
	mount(ChapterRow, {
		props: { chapter: c, courseName: 'course-1', ...props },
		global: globalOptions(),
	})

const outside = (el: Element, selector: string) =>
	el.parentElement?.closest(selector) === null

describe('ChapterRow', () => {
	// Guards: chapter edit/delete were unfocusable icon spans. Introduced in
	// #2424; test added with the a11y audit remediation.
	it('names the chapter actions and keeps them outside the header control', async () => {
		wrapper = mountChapter(scorm(0), { allowEdit: true })

		const edit = wrapper.get('button[aria-label="Edit Chapter"]')
		const remove = wrapper.get('button[aria-label="Delete Chapter"]')
		expect(outside(edit.element, 'a, button')).toBe(true)
		expect(outside(remove.element, 'a, button')).toBe(true)
		expect(edit.classes()).toContain('group-focus-within:visible')
		expect(remove.classes()).toContain('group-focus-within:inline-flex')

		await remove.trigger('click')
		expect(wrapper.emitted('delete-chapter')).toEqual([['CH-1']])
	})

	// Guards: delete nested inside the disclosure button. Introduced in #2424;
	// test added with the a11y audit remediation.
	it('keeps the delete action out of a normal chapter disclosure button', () => {
		wrapper = mountChapter(chapter(), { allowEdit: true })

		const remove = wrapper.get('button[aria-label="Delete Chapter"]')
		expect(outside(remove.element, 'a, button')).toBe(true)
		expect(wrapper.get('button[aria-expanded]').text()).toContain('Chapter One')
	})

	// Guards: lesson delete was an unfocusable icon span. Introduced in #2424;
	// test added with the a11y audit remediation.
	it('names the lesson delete action and keeps it out of the lesson link', async () => {
		wrapper = mountChapter(chapter(), { allowEdit: true })

		const remove = wrapper.get('button[aria-label="Delete Lesson"]')
		expect(outside(remove.element, 'a, button')).toBe(true)
		expect(remove.classes()).toContain('group-focus-within:visible')

		await remove.trigger('click')
		expect(wrapper.emitted('delete-lesson')).toEqual([
			[{ lesson: 'L1', chapter: 'CH-1' }],
		])
	})

	// Guards: inline-select lesson row was a clickable div. Introduced in #2674;
	// test added with the a11y audit remediation.
	it('renders an inline-select lesson as a button', async () => {
		wrapper = mountChapter(chapter(), { inlineSelect: true })

		const row = wrapper.get('[data-testid="outline-lesson"] button')
		expect(row.attributes('type')).toBe('button')
		expect(row.text()).toContain('Lesson One')

		await row.trigger('click')
		expect(wrapper.emitted('select-lesson')).toEqual([
			[{ chapterNumber: '1', lessonNumber: '1' }],
		])
	})

	// Guards: completion shown by an icon alone. Introduced in #2247 and #2674;
	// test added with the a11y audit remediation.
	it('announces a completed lesson and a completed SCORM chapter', () => {
		wrapper = mountChapter(
			chapter({
				lessons: [
					{ name: 'L1', title: 'Lesson One', number: '1-1', is_complete: 1 },
				],
			})
		)
		expect(wrapper.get('[data-testid="outline-lesson"]').text()).toContain(
			'Completed'
		)
		expect(wrapper.get('.lucide-check').attributes('aria-hidden')).toBe('true')

		wrapper.unmount()
		wrapper = mountChapter(scorm(0, 1))
		expect(wrapper.getComponent(RouterLinkStub).text()).toContain('Completed')
	})
})

describe('StudentLessonSidebar', () => {
	// Guards: completion shown by an icon alone. Introduced in #2674; test added
	// with the a11y audit remediation.
	it('announces a completed lesson', () => {
		seeds['lms.lms.utils.get_course_outline'] = [
			{
				name: 'CH-1',
				title: 'Chapter One',
				idx: 1,
				lessons: [
					{ name: 'L1', title: 'Done', number: '1-1', is_complete: 1 },
					{ name: 'L2', title: 'Next', number: '1-2', is_complete: 0 },
				],
			},
		]
		wrapper = mount(StudentLessonSidebar, {
			props: {
				courseName: 'course-1',
				courseTitle: 'Course',
				progress: 50,
				selectedLessonNumber: '1-1',
			},
			global: globalOptions(),
		})
		delete seeds['lms.lms.utils.get_course_outline']

		const rows = wrapper.findAll('li li')
		expect(rows[0].get('.sr-only').text()).toBe('Completed')
		expect(rows[1].find('.sr-only').exists()).toBe(false)
	})
})

describe('VideoBlock', () => {
	// Guards: keyboard play dropped focus and the bar hid from keyboard users.
	// Introduced in #882; test added with the a11y audit remediation.
	beforeEach(() => {
		vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() =>
			Promise.resolve()
		)
		vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(
			() => undefined
		)
	})

	const mountVideo = async () => {
		const w = mount(VideoBlock, {
			props: { file: '/files/v.mp4' },
			attachTo: document.body,
			global: globalOptions({
				stubs: {
					Quiz: true,
					QuizInVideo: true,
					Dialog: true,
					Dropdown: { template: '<div><slot /></div>' },
				},
			}),
		})
		await new Promise((resolve) => setTimeout(resolve))
		return w
	}

	it('moves focus to Pause while the control bar is still visible', async () => {
		wrapper = await mountVideo()
		const button = wrapper.get('[aria-label="Play"]').element as HTMLElement
		const bar = button.parentElement!
		const barHiddenAtFocus: boolean[] = []
		vi.spyOn(button, 'focus').mockImplementation(function (this: HTMLElement) {
			barHiddenAtFocus.push(bar.classList.contains('invisible'))
			HTMLElement.prototype.focus.call(this)
		})

		await wrapper.get('[aria-label="Play video"]').trigger('click')

		expect(barHiddenAtFocus).toEqual([false])
		expect(bar.classList).toContain('invisible')
		expect(bar.classList).toContain('group-focus-within:visible')
		expect(document.activeElement).toBe(button)
		expect(button.getAttribute('aria-label')).toBe('Pause')
	})

	it('leaves focus alone for a mouse click on the overlay', async () => {
		wrapper = await mountVideo()

		wrapper
			.get('[aria-label="Play video"]')
			.element.dispatchEvent(
				new MouseEvent('click', { bubbles: true, detail: 1 })
			)
		await nextTick()
		await nextTick()

		expect(document.activeElement?.getAttribute('aria-label')).not.toBe('Pause')
	})
})

describe('AppSidebar', () => {
	const mountSidebar = () =>
		mount(AppSidebar, {
			global: globalOptions({
				stubs: {
					Sidebar: { template: '<nav><slot /></nav>' },
					SidebarCard: true,
					SidebarItem: true,
					SidebarSection: true,
					SidebarCollapseToggle: true,
					UserDropdown: true,
					SidebarLink: true,
					CommandPalette: true,
				},
			}),
		})

	afterEach(() => {
		delete (window as any).read_only_mode
	})

	// Guards: Help and Powered by were clickable spans. Introduced in #1399 and
	// #1450; test added with the a11y audit remediation.
	it('renders Help as a named button and Powered by as an external link', async () => {
		wrapper = mountSidebar()
		await flushPromises()

		const help = wrapper.get('button[aria-label="Help"]')
		expect(help.attributes('type')).toBe('button')

		const powered = wrapper.get('a[aria-label="Powered by Frappe Learning"]')
		expect(powered.attributes()).toMatchObject({
			href: 'https://frappe.io/learning',
			target: '_blank',
			rel: 'noopener noreferrer',
		})
	})

	// Guards: collapsed read-only notice lived only in a tooltip. Introduced in
	// #1479; test added with the a11y audit remediation.
	it('gives the collapsed read-only notice text, not just a tooltip', async () => {
		;(window as any).read_only_mode = true
		useSidebar().isSidebarCollapsed = true
		wrapper = mountSidebar()
		await flushPromises()

		const alert = wrapper.get('.lucide-circle-alert')
		expect(alert.attributes('aria-hidden')).toBe('true')
		expect(wrapper.find('.sr-only').text()).toContain(
			'This site is being updated'
		)
	})
})

describe('NotificationPanel', () => {
	// Guards: notifications were clickable divs with unread shown by weight
	// alone. Introduced in #1971; test added with the a11y audit remediation.
	const mountPanel = () => {
		panelVisible.value = true
		;(notifications as any).data = [
			{
				name: 'N1',
				read: 0,
				subject: 'Course update',
				link: '/lms/courses/course-1',
				creation: '2026-10-01',
				from_user_details: {},
			},
			{
				name: 'N2',
				read: 0,
				subject: 'System note',
				link: '',
				creation: '2026-10-01',
				from_user_details: {},
			},
		]
		return mount(NotificationPanel, {
			global: globalOptions({
				provide: { $dayjs: () => ({ fromNow: () => 'just now' }) },
				stubs: { teleport: true },
			}),
		})
	}

	it('renders a routable notification as a link marked unread', () => {
		wrapper = mountPanel()

		const link = wrapper.getComponent(RouterLinkStub)
		expect(link.props('to')).toEqual({
			name: 'CourseDetail',
			params: { courseName: 'course-1' },
		})
		expect(link.classes()).toContain('font-medium')
		expect(link.get('.sr-only').text()).toBe('Unread')
	})

	it('renders a notification with nowhere to go as a button', async () => {
		wrapper = mountPanel()

		const row = wrapper
			.findAll('button[type="button"]')
			.find((b) => b.text().includes('System note'))!
		expect(row.get('.sr-only').text()).toBe('Unread')

		await row.trigger('click')
		expect((markAsRead as any).submit).toHaveBeenCalledWith({ name: 'N2' })
		expect(panelVisible.value).toBe(false)
	})
})

describe('ProctoringMonitor', () => {
	// Guards: lost focus on minimise, and face status and camera errors not
	// announced. Introduced in #2659; test added with the a11y audit remediation.
	beforeEach(() => {
		const track = { addEventListener: vi.fn(), stop: vi.fn() }
		Object.defineProperty(global, 'navigator', {
			value: {
				mediaDevices: {
					getUserMedia: vi.fn(() =>
						Promise.resolve({
							getVideoTracks: () => [track],
							getTracks: () => [track],
						})
					),
				},
			},
			writable: true,
			configurable: true,
		})
	})

	const mountMonitor = (active: boolean) =>
		mount(ProctoringMonitor, {
			props: { maxViolations: 3, active },
			attachTo: document.body,
			global: globalOptions(),
		})

	it('makes the minimised camera inert and hands focus to Show camera', async () => {
		wrapper = mountMonitor(true)
		await flushPromises()

		const minimise = document.querySelector<HTMLElement>(
			'[aria-label="Minimise camera"]'
		)!
		expect(minimise.classList).toContain('size-6')
		const panel = minimise.closest('.overflow-hidden')!
		expect(panel.hasAttribute('inert')).toBe(false)

		minimise.click()
		await nextTick()
		await nextTick()

		expect(panel.hasAttribute('inert')).toBe(true)
		expect(document.activeElement?.getAttribute('aria-label')).toBe(
			'Show camera'
		)
		;(document.activeElement as HTMLElement).click()
		await nextTick()
		await nextTick()

		expect(panel.hasAttribute('inert')).toBe(false)
		expect(document.activeElement).toBe(minimise)
	})

	it('keeps the face status in an always-mounted status region', async () => {
		wrapper = mountMonitor(false)
		const region = wrapper.get('[role="status"]:not(.fui-spinner)')

		await flushPromises()

		expect(wrapper.get('[role="status"]:not(.fui-spinner)').element).toBe(
			region.element
		)
		expect(region.text()).toContain('Position your face')
	})

	it('announces a camera error as an alert', async () => {
		;(navigator.mediaDevices.getUserMedia as any).mockImplementation(() =>
			Promise.reject(new Error('NotAllowedError'))
		)
		wrapper = mountMonitor(false)
		await flushPromises()

		expect(wrapper.get('[role="alert"]').text()).toContain(
			'Camera access was denied'
		)
	})
})

describe('ProgramDetail', () => {
	// Guards: course cards opened by a click handler on a div, lock note hover-
	// only. Introduced in #1686; test added with the a11y audit remediation.
	it('links an open course and describes a locked one', async () => {
		seeds['lms.lms.utils.get_program_details'] = {
			name: 'P1',
			progress: 50,
			enforce_course_order: 1,
			courses: [
				{ name: 'open-course', eligible: true },
				{ name: 'locked-course', eligible: false },
			],
		}
		wrapper = mount(ProgramDetail, {
			props: { programName: 'P1' },
			attachTo: document.body,
			global: globalOptions({
				stubs: {
					PageHeader: true,
					PageBody: { template: '<div><slot name="name" /><slot /></div>' },
					CourseCard: {
						props: ['course'],
						template: '<div>{{ course.name }}</div>',
					},
				},
			}),
		})
		delete seeds['lms.lms.utils.get_program_details']
		await flushPromises()

		const link = wrapper.getComponent(RouterLinkStub)
		expect(link.props('to')).toEqual({
			name: 'CourseDetail',
			params: { courseName: 'open-course' },
		})

		expect(wrapper.find('button').exists()).toBe(false)
		const locked = wrapper.get('[aria-describedby]')
		expect(locked.element.tagName).toBe('DIV')
		expect(locked.attributes('tabindex')).toBe('0')
		expect(locked.text()).toContain('locked-course')
		const note = document.getElementById(locked.attributes('aria-describedby')!)
		expect(note?.textContent).toContain('Please complete the previous course')
		expect(note?.className).toContain('group-focus-within:visible')

		await locked.trigger('click')
		expect(pushMock).not.toHaveBeenCalled()

		expect(wrapper.get('.lucide-info').attributes('aria-hidden')).toBe('true')
		expect(wrapper.get('.sr-only').text()).toContain(
			'Courses must be completed in order'
		)
	})
})

describe('Lesson zen mode', () => {
	// Guards: completion figure shown only on hover. Introduced in #928; test
	// added with the a11y audit remediation.
	afterEach(() => {
		delete (document as any).fullscreenElement
	})

	it('shows the completion figure on keyboard focus and to screen readers', async () => {
		wrapper = shallowMount(Lesson, {
			props: { courseName: 'course-1', chapterNumber: '1', lessonNumber: '1' },
			global: globalOptions(),
		})
		await flushPromises()
		findResource('lms.lms.utils.get_lesson').data = {
			name: 'L1',
			title: 'Lesson One',
			course_title: 'Course',
			chapter_title: 'Chapter',
			instructors: [],
			membership: { progress: 42.2 },
		}
		Object.defineProperty(document, 'fullscreenElement', {
			value: document.body,
			configurable: true,
		})
		document.dispatchEvent(new Event('fullscreenchange'))
		await flushPromises()

		const trigger = wrapper.get('[tabindex="0"]')
		expect(trigger.text()).toContain('Chapter - Course')
		expect(trigger.get('.sr-only').text()).toBe('43% completed')
		expect(trigger.get('.group-focus-within\\:block').exists()).toBe(true)
	})
})
