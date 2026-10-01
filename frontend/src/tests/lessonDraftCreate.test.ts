import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'

// Every createResource() the form makes, so a test can find one by url. The
// create_lesson request stays pending until the test settles it.
const created = vi.hoisted(() => ({ list: [] as any[] }))
const createRequests = vi.hoisted(() => ({
	pending: [] as Array<(outcome: 'ok' | 'fail') => void>,
}))
const editorState = vi.hoisted(() => ({ saveData: {} as Record<string, any> }))

const CREATE_URL = 'lms.lms.api.create_lesson'
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
							handlers?.onSuccess?.(NEW_LESSON)
							resolve(NEW_LESSON)
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

const paragraph = (text: string) => ({
	blocks: [{ type: 'paragraph', data: { text } }],
})
// The newest match, so a test that remounts reads the live form's resource.
const resource = (url: string) =>
	[...created.list].reverse().find((r) => r._config.url === url)
const createLesson = () => resource(CREATE_URL)
const setValue = () => resource('frappe.client.set_value')

async function mountDraft() {
	const wrapper = mount(LessonForm, {
		props: {
			courseName: 'C1',
			chapterNumber: '1',
			lessonNumber: 'new',
			draftChapter: 'CH-1',
		},
		global: {
			mocks: { __: (s: string) => s },
			provide: {
				$user: { data: { is_moderator: true, is_instructor: true } },
			},
		},
		attachTo: document.body,
	})
	await flushPromises()
	return wrapper
}

const titleField = (wrapper: VueWrapper) =>
	wrapper.find('textarea.lesson-title')

async function typeTitle(wrapper: VueWrapper, title: string) {
	await titleField(wrapper).setValue(title)
}

async function editBody(wrapper: VueWrapper) {
	const body = wrapper
		.findAllComponents(BlockEditorStub)
		.find((c) => (c.props('uploadContext') as any)?.fieldname === 'content')
	body!.vm.$emit('change')
	await flushPromises()
}

async function settleCreate(outcome: 'ok' | 'fail' = 'ok') {
	createRequests.pending.shift()!(outcome)
	await flushPromises()
}

async function idle(ms: number) {
	vi.advanceTimersByTime(ms)
	await flushPromises()
}

describe('LessonForm draft: a new lesson is created from its title', () => {
	let wrapper: VueWrapper

	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
		created.list.length = 0
		createRequests.pending.length = 0
		editorState.saveData = {}
		vi.mocked(toast.error).mockClear()
	})

	afterEach(() => {
		try {
			wrapper?.unmount()
		} catch {
			// already unmounted by the test
		}
		document.body.innerHTML = ''
		vi.useRealTimers()
	})

	it('opens empty and focused, loading and creating nothing', async () => {
		wrapper = await mountDraft()

		const title = titleField(wrapper).element as HTMLTextAreaElement
		expect(title.value).toBe('')
		expect(title.placeholder).toBe('Lesson title')
		expect(document.activeElement).toBe(title)
		expect(
			resource('lms.lms.utils.get_lesson_creation_details')._config.auto
		).toBe(false)
		expect(createLesson().submit).not.toHaveBeenCalled()
	})

	it('creates the lesson once the title has been idle for 3 s', async () => {
		wrapper = await mountDraft()
		await typeTitle(wrapper, '  Intro  ')

		await idle(2999)
		expect(createLesson().submit).not.toHaveBeenCalled()

		await idle(1)
		expect(createLesson().submit).toHaveBeenCalledTimes(1)
		expect(createLesson().lastParams).toEqual({
			chapter: 'CH-1',
			title: 'Intro',
		})
	})

	it('restarts the idle wait on every keystroke', async () => {
		wrapper = await mountDraft()
		await typeTitle(wrapper, 'In')
		await idle(2000)
		await typeTitle(wrapper, 'Intro')
		await idle(2000)

		expect(createLesson().submit).not.toHaveBeenCalled()
		await idle(1000)
		expect(createLesson().submit).toHaveBeenCalledTimes(1)
	})

	it('creates at once on blur or on save', async () => {
		wrapper = await mountDraft()
		await typeTitle(wrapper, 'Intro')
		await titleField(wrapper).trigger('blur')
		expect(createLesson().submit).toHaveBeenCalledTimes(1)

		wrapper.unmount()
		wrapper = await mountDraft()
		await typeTitle(wrapper, 'Intro')
		;(wrapper.vm as any).saveLesson()
		expect(createLesson().submit).toHaveBeenCalledTimes(1)
	})

	it('does not create a second lesson while the first request is in flight', async () => {
		wrapper = await mountDraft()
		await typeTitle(wrapper, 'Intro')
		await idle(3000)

		await typeTitle(wrapper, 'Intro to')
		await idle(3000)
		await titleField(wrapper).trigger('blur')
		;(wrapper.vm as any).saveLesson()
		wrapper.unmount()
		await flushPromises()

		expect(createLesson().submit).toHaveBeenCalledTimes(1)
	})

	it('retries after a failed create instead of staying stuck', async () => {
		wrapper = await mountDraft()
		await typeTitle(wrapper, 'Intro')
		await idle(3000)
		await settleCreate('fail')
		expect(toast.error).toHaveBeenCalledWith('Lesson title cannot be empty.')

		await typeTitle(wrapper, 'Intro!')
		await idle(3000)
		expect(createLesson().submit).toHaveBeenCalledTimes(2)
	})

	it.each(['', '   '])(
		'creates nothing for the blank title %j: not on idle, blur, save or unmount',
		async (blank) => {
			wrapper = await mountDraft()
			await typeTitle(wrapper, 'x')
			await typeTitle(wrapper, blank)
			await idle(3000)
			await titleField(wrapper).trigger('blur')
			;(wrapper.vm as any).saveLesson()
			wrapper.unmount()
			await idle(3000)

			expect(createLesson().submit).not.toHaveBeenCalled()
		}
	)

	it('flushes the create on unmount when the title is set', async () => {
		wrapper = await mountDraft()
		await typeTitle(wrapper, 'Intro')
		wrapper.unmount()
		await idle(3000)

		expect(createLesson().submit).toHaveBeenCalledTimes(1)
		expect(createLesson().lastParams.title).toBe('Intro')
	})

	it('reports the created lesson and keeps the title focused', async () => {
		wrapper = await mountDraft()
		await typeTitle(wrapper, 'Intro')
		await idle(3000)
		await settleCreate()

		expect(wrapper.emitted('created')).toEqual([
			[{ name: NEW_LESSON, chapter: 'CH-1' }],
		])
		expect((wrapper.vm as any).lessonName()).toBe(NEW_LESSON)
		expect(document.activeElement).toBe(titleField(wrapper).element)
		// Nothing changed since the create, so there is nothing to save.
		await idle(800)
		expect(setValue().submit).not.toHaveBeenCalled()
	})

	it('saves body edits made during the draft right after the create', async () => {
		wrapper = await mountDraft()
		editorState.saveData.content = paragraph('Body before the title')
		await editBody(wrapper)
		await idle(800)
		expect(setValue().submit).not.toHaveBeenCalled()

		await typeTitle(wrapper, 'Intro')
		await idle(3000)
		await settleCreate()
		await idle(800)

		expect(setValue().submit).toHaveBeenCalledTimes(1)
		expect(setValue().lastParams.name).toBe(NEW_LESSON)
		expect(setValue().lastParams.fieldname.content).toContain(
			'Body before the title'
		)
	})

	it('saves title text typed while the create was in flight', async () => {
		wrapper = await mountDraft()
		await typeTitle(wrapper, 'Intro')
		await idle(3000)
		await typeTitle(wrapper, 'Intro to sets')
		await settleCreate()
		await idle(800)

		expect(setValue().submit).toHaveBeenCalledTimes(1)
		expect(setValue().lastParams.fieldname.title).toBe('Intro to sets')
	})

	it('autosaves later title edits after 800 ms, not 3 s', async () => {
		wrapper = await mountDraft()
		await typeTitle(wrapper, 'Intro')
		await idle(3000)
		await settleCreate()

		await typeTitle(wrapper, 'Introduction')
		await idle(800)

		expect(createLesson().submit).toHaveBeenCalledTimes(1)
		expect(setValue().submit).toHaveBeenCalledTimes(1)
		expect(setValue().lastParams.name).toBe(NEW_LESSON)
		expect(setValue().lastParams.fieldname.title).toBe('Introduction')
	})

	it('writes body edits once the create lands after an unmount flush', async () => {
		wrapper = await mountDraft()
		editorState.saveData.content = paragraph('Unsaved body')
		await editBody(wrapper)
		await typeTitle(wrapper, 'Intro')
		wrapper.unmount()
		await flushPromises()
		await settleCreate()

		expect(setValue().submit).toHaveBeenCalledTimes(1)
		expect(setValue().lastParams.name).toBe(NEW_LESSON)
		expect(setValue().lastParams.fieldname.content).toContain('Unsaved body')
	})

	it('creates nothing once the draft is marked deleted', async () => {
		wrapper = await mountDraft()
		await typeTitle(wrapper, 'Intro')
		;(wrapper.vm as any).markDeleted()
		wrapper.unmount()
		await idle(3000)

		expect(createLesson().submit).not.toHaveBeenCalled()
	})
})
