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
			_config: config,
			submit: vi.fn(() => Promise.resolve()),
			reload: vi.fn(() => Promise.resolve()),
			fetch: vi.fn(),
			update: vi.fn(),
		})
		created.list.push(r)
		return r
	}
	return {
		...(await importOriginal<Record<string, unknown>>()),
		createResource: resource,
		createListResource: resource,
		call: vi.fn(() => Promise.resolve({})),
		usePageMeta: vi.fn(),
		toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
	}
})

vi.mock('vue-router', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	useRoute: () => ({ params: {}, query: {} }),
	useRouter: () => ({ push: pushMock, replace: vi.fn() }),
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
	formatTime: (s: string) => s,
	getFormattedDateRange: () => '',
}))

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

seeds['lms.lms.api.get_user_info'] = { is_system_manager: true }

import VideoBlock from '@/components/VideoBlock.vue'
import AppSidebar from '@/components/Sidebar/AppSidebar.vue'
import NotificationPanel from '@/components/Notifications/NotificationPanel.vue'
import ProgramDetail from '@/pages/Programs/ProgramDetail.vue'
import Lesson from '@/pages/Lesson.vue'
import BatchCard from '@/pages/Batches/components/BatchCard.vue'
import CourseCard from '@/components/CourseCard.vue'
import { markAsRead, notifications, panelVisible } from '@/stores/notifications'
import { useSidebar } from '@/stores/sidebar'

const globalOptions = (extra: Record<string, any> = {}) => ({
	mocks: { __: (s: string) => (globalThis as any).__(s) },
	provide: {
		$user: { data: { name: 'student@example.com' } },
		$socket: { on: vi.fn(), off: vi.fn() },
		...extra.provide,
	},
	stubs: {
		RouterLink: RouterLinkStub,
		Tooltip: { template: '<span><slot /></span>' },
		...extra.stubs,
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

describe('VideoBlock', () => {
	// Guards: keyboard play dropped focus and the bar hid from keyboard users.
	// Introduced in #882; test added with the a11y audit remediation.
	beforeEach(async () => {
		vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
		vi.spyOn(HTMLMediaElement.prototype, 'pause').mockReturnValue()
		wrapper = mount(VideoBlock, {
			props: { file: '/files/v.mp4' },
			attachTo: document.body,
			global: globalOptions({
				stubs: { Quiz: true, QuizInVideo: true, Dialog: true },
			}),
		})
		await new Promise((resolve) => setTimeout(resolve))
	})

	it('moves keyboard focus to Pause while the control bar is visible', async () => {
		const button = wrapper!.get('[aria-label="Play"]').element as HTMLElement
		const hiddenAtFocus: boolean[] = []
		vi.spyOn(button, 'focus').mockImplementation(function (this: HTMLElement) {
			hiddenAtFocus.push(button.parentElement!.classList.contains('invisible'))
			HTMLElement.prototype.focus.call(this)
		})

		await wrapper!.get('[aria-label="Play video"]').trigger('click')

		expect(hiddenAtFocus).toEqual([false])
		expect(document.activeElement).toBe(button)
		expect(button.getAttribute('aria-label')).toBe('Pause')
	})

	it('leaves focus alone for a mouse click on the overlay', async () => {
		wrapper!
			.get('[aria-label="Play video"]')
			.element.dispatchEvent(
				new MouseEvent('click', { bubbles: true, detail: 1 })
			)
		await nextTick()

		expect(document.activeElement?.getAttribute('aria-label')).not.toBe('Pause')
	})
})

describe('AppSidebar', () => {
	// Guards: Help and Powered by were clickable spans, and the collapsed
	// read-only notice lived only in a tooltip. Introduced in #1399, #1450 and
	// #1479; test added with the a11y audit remediation.
	afterEach(() => {
		delete (window as any).read_only_mode
	})

	it('renders Help as a button, Powered by as a link, and the notice as text', async () => {
		;(window as any).read_only_mode = true
		useSidebar().isSidebarCollapsed = true
		wrapper = mount(AppSidebar, {
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
		await flushPromises()

		expect(wrapper.get('button[aria-label="Help"]').attributes('type')).toBe(
			'button'
		)
		expect(
			wrapper.get('a[aria-label="Powered by Frappe Learning"]').attributes()
		).toMatchObject({ href: 'https://frappe.io/learning', target: '_blank' })
		expect(wrapper.find('.sr-only').text()).toContain(
			'This site is being updated'
		)
	})
})

describe('NotificationPanel', () => {
	// Guards: notifications were clickable divs with unread shown by weight
	// alone. Introduced in #1971; test added with the a11y audit remediation.
	it('renders rows as a link or a button, each marked unread', async () => {
		panelVisible.value = true
		const row = { read: 0, creation: '2026-10-01', from_user_details: {} }
		;(notifications as any).data = [
			{ ...row, name: 'N1', subject: 'Course', link: '/lms/courses/course-1' },
			{ ...row, name: 'N2', subject: 'System note', link: '' },
		]
		wrapper = mount(NotificationPanel, {
			global: globalOptions({
				provide: { $dayjs: () => ({ fromNow: () => 'just now' }) },
				stubs: { teleport: true },
			}),
		})

		const link = wrapper.getComponent(RouterLinkStub)
		expect(link.props('to')).toEqual({
			name: 'CourseDetail',
			params: { courseName: 'course-1' },
		})
		expect(link.get('.sr-only').text()).toBe('Unread')

		const button = wrapper
			.findAll('button[type="button"]')
			.find((b) => b.text().includes('System note'))!
		expect(button.get('.sr-only').text()).toBe('Unread')
		await button.trigger('click')
		expect((markAsRead as any).submit).toHaveBeenCalledWith({ name: 'N2' })
	})
})

describe('Course and batch cards', () => {
	// Guards: instructor links nested inside card links. Introduced in #779 and
	// #2081; test added with the a11y audit remediation.
	const instructors = [
		{ username: 'ada', first_name: 'Ada', full_name: 'Ada L' },
		{ username: 'bo', first_name: 'Bo', full_name: 'Bo K' },
	]
	const to = { name: 'Detail', params: { name: 'x-1' } }

	it.each([
		[BatchCard, { batch: { name: 'x-1', title: 'Card', instructors }, to }],
		[CourseCard, { course: { name: 'x-1', title: 'Card', instructors }, to }],
	])(
		'%#: links the title and keeps instructor links unnested',
		(card, props) => {
			wrapper = mount(card as any, {
				props: props as Record<string, unknown>,
				global: globalOptions({ stubs: { UserAvatar: true } }),
			})

			const links = wrapper.findAllComponents(RouterLinkStub)
			expect(wrapper.find('a a').exists()).toBe(false)
			expect(links[0].text()).toBe('Card')
			expect(links.map((l) => l.props('to'))).toEqual([
				to,
				{ name: 'Profile', params: { username: 'ada' } },
				{ name: 'Profile', params: { username: 'bo' } },
			])
		}
	)
})

describe('ProgramDetail', () => {
	// Guards: course cards opened by a click handler on a div, lock note hover-
	// only. Introduced in #1686; test added with the a11y audit remediation.
	it('links an open course and describes a locked one', async () => {
		const course = (name: string, eligible: boolean) => ({
			name,
			title: name,
			instructors: [],
			eligible,
		})
		seeds['lms.lms.utils.get_program_details'] = {
			name: 'P1',
			progress: 50,
			enforce_course_order: 1,
			courses: [course('open', true), course('locked', false)],
		}
		wrapper = mount(ProgramDetail, {
			props: { programName: 'P1' },
			attachTo: document.body,
			global: globalOptions({
				stubs: {
					PageHeader: true,
					PageBody: { template: '<div><slot name="name" /><slot /></div>' },
					UserAvatar: true,
				},
			}),
		})
		delete seeds['lms.lms.utils.get_program_details']
		await flushPromises()

		expect(wrapper.getComponent(RouterLinkStub).props('to')).toEqual({
			name: 'CourseDetail',
			params: { courseName: 'open' },
		})
		const locked = wrapper.get('[aria-describedby]')
		expect(locked.attributes('tabindex')).toBe('0')
		expect(locked.find('a').exists()).toBe(false)
		const note = document.getElementById(locked.attributes('aria-describedby')!)
		expect(note?.textContent).toContain('Please complete the previous course')
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

	it('puts the completion figure on a focusable trigger and in text', async () => {
		wrapper = shallowMount(Lesson, {
			props: { courseName: 'course-1', chapterNumber: '1', lessonNumber: '1' },
			global: globalOptions(),
		})
		await flushPromises()
		created.list.find(
			(r) => r._config?.url === 'lms.lms.utils.get_lesson'
		).data = {
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
	})
})
