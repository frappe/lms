/**
 * Autosave and Ctrl+S together used to insert the new lesson twice. A save
 * made while the insert is in flight now waits and goes through the edit path.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'

// Every createResource() the form makes, so a test can find one by url. The
// create_lesson request stays pending until the test settles it.
const created = vi.hoisted(() => ({ list: [] as any[] }))
const createRequests = vi.hoisted(() => ({
	pending: [] as Array<(outcome: 'ok' | 'fail') => void>,
}))
const editorState = vi.hoisted(() => ({ saveData: {} as Record<string, any> }))

const CREATE_URL = 'frappe.client.insert'
const NEW_LESSON = '0042 Intro'

vi.mock('frappe-ui', async () => {
	const { reactive } = await import('vue')
	const stub = (name: string) => ({ name, render: () => null })
	return {
		createResource: (config: any) => {
			const r: any = reactive({
				data: null,
				loading: false,
				_config: config,
				lastParams: null,
			})
			r.submit = vi.fn((params: any, handlers: any) => {
				r.lastParams = config.makeParams ? config.makeParams(params) : params
				if (config.url !== CREATE_URL) return Promise.resolve()
				return new Promise((resolve, reject) => {
					createRequests.pending.push((outcome) => {
						if (outcome === 'ok') {
							handlers?.onSuccess?.({ name: NEW_LESSON })
							resolve({ name: NEW_LESSON })
						} else {
							const error = { messages: ['Lesson title cannot be empty.'] }
							handlers?.onError?.(error)
							reject(error)
						}
					})
				})
			})
			r.reload = vi.fn()
			r.fetch = vi.fn()
			created.list.push(r)
			return r
		},
		call: vi.fn(),
		toast: { success: vi.fn(), error: vi.fn() },
		Badge: stub('Badge'),
		Button: stub('Button'),
		Switch: stub('Switch'),
		Tooltip: stub('Tooltip'),
	}
})

vi.mock('@/components/BlockEditor.vue', async () => {
	const { defineComponent, h, onBeforeUnmount } = await import('vue')
	return {
		default: defineComponent({
			props: { uploadContext: { type: Object, default: () => ({}) } },
			emits: ['change'],
			setup(props, { expose }) {
				let alive = true
				onBeforeUnmount(() => {
					alive = false
				})
				const field = props.uploadContext?.fieldname
				expose({
					isReady: () => Promise.resolve(),
					render: async () => {},
					focus: () => {},
					save: async () =>
						alive ? editorState.saveData[field] ?? null : null,
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
vi.mock(
	'@framework/ui/components/Onboarding/index',
	async (importOriginal) => ({
		...(await importOriginal<
			typeof import('@framework/ui/components/Onboarding/index')
		>()),
		useOnboarding: () => ({ updateOnboardingStep: vi.fn() }),
	})
)
vi.mock('@framework/ui/telemetry/index', async (importOriginal) => ({
	...(await importOriginal<typeof import('@framework/ui/telemetry/index')>()),
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

import { toast } from 'frappe-ui'
import LessonForm from '@/pages/LessonForm.vue'
import BlockEditorStub from '@/components/BlockEditor.vue'

const resource = (url: string) =>
	[...created.list].reverse().find((r) => r._config.url === url)
// The lesson insert and its chapter link both use frappe.client.insert.
const inserts = () =>
	created.list
		.filter((r) => r._config.url === CREATE_URL)
		.flatMap((r) => r.submit.mock.calls)

describe('LessonForm: a new lesson saved twice while it is being created', () => {
	let wrapper: VueWrapper

	beforeEach(() => {
		created.list.length = 0
		createRequests.pending.length = 0
		editorState.saveData = {}
	})

	afterEach(() => {
		wrapper?.unmount()
		document.body.innerHTML = ''
	})

	it('inserts the lesson once, then saves the second edit as an update', async () => {
		wrapper = mount(LessonForm, {
			props: { courseName: 'C1', chapterNumber: '1', lessonNumber: 'new' },
			global: {
				mocks: { __: (s: string) => s },
				provide: {
					$user: { data: { is_moderator: true, is_instructor: true } },
				},
			},
			attachTo: document.body,
		})
		await flushPromises()
		const details = resource('lms.lms.utils.get_lesson_creation_details')
		details.data = { chapter: { name: 'CH-1' } }
		await wrapper.find('textarea.lesson-title').setValue('Intro')
		;(wrapper.vm as any).saveLesson()
		await flushPromises()
		;(wrapper.vm as any).saveLesson()
		await flushPromises()

		expect(inserts()).toHaveLength(1)

		details.data = {
			chapter: { name: 'CH-1' },
			lesson: { name: NEW_LESSON, title: 'Intro' },
		}
		// The lesson insert, then its chapter link.
		while (createRequests.pending.length) {
			createRequests.pending.shift()!('ok')
			await flushPromises()
		}

		expect(inserts()).toHaveLength(2)
		expect(resource('frappe.client.set_value').submit).toHaveBeenCalled()
	})
})
