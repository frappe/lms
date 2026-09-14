import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'

// Records every createResource() the component makes so a test can find the
// lesson-details one by url and drive it to "loaded".
const created = vi.hoisted(() => ({ list: [] as any[] }))

vi.mock('frappe-ui', async () => {
	const { reactive } = await import('vue')
	const stub = (name: string) => ({ name, render: () => null })
	return {
		createResource: (config: any) => {
			const r: any = reactive({ data: null, loading: false, _config: config })
			r.submit = vi.fn(() => Promise.resolve())
			r.reload = vi.fn()
			r.fetch = vi.fn()
			created.list.push(r)
			return r
		},
		toast: { success: vi.fn(), error: vi.fn() },
		Badge: stub('Badge'),
		Button: stub('Button'),
		Switch: stub('Switch'),
		Tooltip: stub('Tooltip'),
	}
})

vi.mock('@/components/BlockEditor.vue', async () => {
	const { defineComponent, h } = await import('vue')
	return {
		default: defineComponent({
			props: { uploadContext: { type: Object, default: () => ({}) } },
			emits: ['change'],
			setup(_props, { expose }) {
				expose({
					isReady: () => Promise.resolve(),
					render: async () => {},
					focus: () => {},
					save: async () => null,
				})
				return () => h('div', { class: 'block-editor-stub' })
			},
		}),
	}
})

vi.mock('lucide-vue-next', () => ({
	ChevronRight: { render: () => null },
	NotebookPen: { render: () => null },
}))

vi.mock('frappe-ui/frappe', () => ({
	useOnboarding: () => ({ updateOnboardingStep: vi.fn() }),
	useTelemetry: () => ({ capture: vi.fn() }),
}))

vi.mock('@/composables/useKeyboardShortcuts', () => ({
	useKeyboardShortcuts: () => {},
	saveShortcut: (fn: () => void) => ({ key: 's', handler: fn }),
}))

vi.mock('@/utils', () => ({
	enablePlyr: () => {},
	sanitizeEditorJs: (x: any) => x,
}))

vi.mock('@/utils/video', () => ({ hasVideoContent: () => false }))

import LessonForm from '@/pages/LessonForm.vue'

// Mount LessonForm and resolve its lessonDetails resource with `chapter`, which
// is what the backend's get_lesson_creation_details returns.
async function mountWithChapter(chapter: Record<string, any>) {
	const wrapper = mount(LessonForm, {
		props: { courseName: 'C1', chapterNumber: '1', lessonNumber: '1' },
		global: {
			config: { globalProperties: { __: (s: string) => s } as any },
			provide: {
				$user: {
					data: {
						is_moderator: true,
						is_instructor: true,
						is_system_manager: false,
					},
				},
			},
		},
		attachTo: document.body,
	})
	const details = created.list.find(
		(r) => r._config.url === 'lms.lms.utils.get_lesson_creation_details',
	)
	const data = {
		lesson: {
			name: 'LESSON-1',
			title: 'Existing title',
			include_in_preview: 0,
			content: '',
			instructor_content: '',
		},
		chapter,
	}
	details.data = data
	details._config.onSuccess(data)
	await flushPromises()
	return wrapper
}

describe('LessonForm chapter title', () => {
	let wrapper: VueWrapper

	beforeEach(() => {
		created.list.length = 0
	})

	// These tests mount into document.body, so the body is cleared whatever
	// happens. An unmount failure is a real defect here — nothing in this file
	// provokes one — so it is left to fail the test rather than swallowed.
	afterEach(() => {
		try {
			wrapper?.unmount()
		} finally {
			document.body.innerHTML = ''
		}
	})

	it('shows the chapter the lesson belongs to', async () => {
		wrapper = await mountWithChapter({ name: 'CH-1', title: 'Getting Started' })
		expect(wrapper.find('.lesson-chapter-title').text()).toBe('Getting Started')
	})

	it('shows it above the lesson title, not in place of it', async () => {
		wrapper = await mountWithChapter({ name: 'CH-1', title: 'Getting Started' })
		expect(wrapper.find('textarea.lesson-title').element.value).toBe(
			'Existing title',
		)
		const html = wrapper.html()
		const chapterAt = html.indexOf('lesson-chapter-title')
		const titleAt = html.indexOf('lesson-title block')
		expect(chapterAt).toBeGreaterThan(-1)
		expect(titleAt).toBeGreaterThan(-1)
		expect(chapterAt).toBeLessThan(titleAt)
	})

	it('renders nothing when the chapter has no title', async () => {
		wrapper = await mountWithChapter({ name: 'CH-1' })
		expect(wrapper.find('.lesson-chapter-title').exists()).toBe(false)
	})
})
