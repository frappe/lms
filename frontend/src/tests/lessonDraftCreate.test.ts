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
const { completeStepMock } = vi.hoisted(() => ({ completeStepMock: vi.fn() }))
vi.mock('@/onboarding/useLearningOnboarding', () => ({
	useLearningOnboarding: () => ({
		completeStep: completeStepMock,
		refetchFacts: vi.fn(),
	}),
}))
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
			// ComponentCustomProperties types $dialog; the mock only records calls.
			config: { globalProperties: { $dialog: dialogMock } as never },
		},
		attachTo: document.body,
	})
	await flushPromises()
	return wrapper
}

type DialogAction = {
	label: string
	onClick: (c: { close: () => void }) => void
}
const dialogMock = vi.fn()
const lastDialog = () =>
	dialogMock.mock.calls.at(-1)![0] as {
		title: string
		message: string
		actions: DialogAction[]
	}
const press = (label: string) =>
	lastDialog()
		.actions.find((a) => a.label === label)!
		.onClick({ close: () => {} })

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

	// A textarea matches :focus-visible on click and programmatic focus too, so
	// the ring follows the last input modality: only a Tab arrival rings it.
	describe('title focus ring', () => {
		const ringed = (w: VueWrapper) => {
			const classes = titleField(w).classes()
			return (
				classes.includes('ring-2') && classes.includes('ring-outline-gray-5')
			)
		}

		async function refocus(w: VueWrapper, before: Event) {
			const title = titleField(w).element as HTMLTextAreaElement
			title.blur()
			await flushPromises()
			document.body.dispatchEvent(before)
			title.focus()
			await flushPromises()
		}

		// Guards: keyboard users losing the title's focus ring. The ring rules come
		// from develop (frappe/lms#2848); test added in this branch
		// (feat/onboarding-flows, PR pending) with the Tab-only ring fix.
		it('rings the title when focus arrives by Tab', async () => {
			wrapper = await mountDraft()
			await refocus(
				wrapper,
				new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
			)
			expect(ringed(wrapper)).toBe(true)
			expect(titleField(wrapper).classes()).not.toContain('focus:ring-0')
			;(titleField(wrapper).element as HTMLTextAreaElement).blur()
			await flushPromises()
			expect(ringed(wrapper)).toBe(false)
		})

		// Guards: a click ringing the title. Introduced in frappe/lms#2848; test
		// added in this branch (feat/onboarding-flows, PR pending) for that fix.
		it('does not ring the title when focus follows a pointerdown', async () => {
			wrapper = await mountDraft()
			document.body.dispatchEvent(
				new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
			)
			await refocus(wrapper, new Event('pointerdown', { bubbles: true }))
			expect(ringed(wrapper)).toBe(false)
			expect(titleField(wrapper).classes()).toContain('focus:ring-0')
		})

		// Guards: every new lesson opening with a ringed title from its autofocus.
		// Introduced in frappe/lms#2848; test added in this branch
		// (feat/onboarding-flows, PR pending) for that fix.
		it('does not ring the title on programmatic focus', async () => {
			wrapper = await mountDraft()
			expect(document.activeElement).toBe(titleField(wrapper).element)
			expect(ringed(wrapper)).toBe(false)
			expect(titleField(wrapper).classes()).toEqual(
				expect.arrayContaining(['focus:outline-none', 'focus:ring-0'])
			)
		})
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

	// Guards: the draft create never ticking Add a lesson (only the old insert
	// path did). Introduced in this branch (feat/onboarding-flows, PR pending)
	// on rebase onto develop's draft lessons; test added there as the fix guard.
	it('ticks the onboarding lesson step once the lesson is created', async () => {
		completeStepMock.mockClear()
		wrapper = await mountDraft()
		await typeTitle(wrapper, 'Intro')
		await idle(3000)
		expect(completeStepMock).not.toHaveBeenCalled()
		await settleCreate()
		expect(completeStepMock).toHaveBeenCalledWith('create_first_lesson')
	})

	// Guards: Add a lesson ticking for a lesson that was never created.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there with the draft-create tick.
	it('does not tick the step when the create fails', async () => {
		completeStepMock.mockClear()
		wrapper = await mountDraft()
		await typeTitle(wrapper, 'Intro')
		await idle(3000)
		await settleCreate('fail')
		expect(completeStepMock).not.toHaveBeenCalled()
	})

	// Guards: an untitled lesson being created from body edits alone. Introduced
	// in this branch (feat/onboarding-flows, PR pending); test added there with
	// the discard prompt, which relies on nothing being saved.
	it('creates nothing from a body with no title, on save or on leaving', async () => {
		wrapper = await mountDraft()
		await editBody(wrapper)
		;(wrapper.vm as any).saveLesson({ flush: true })
		await idle(3000)
		wrapper.unmount()
		await flushPromises()
		expect(createLesson().submit).not.toHaveBeenCalled()
	})

	// Guards: a draft lesson looking saved before it exists. Introduced in this
	// branch (feat/onboarding-flows, PR pending); test added there to pin when
	// the Not saved badge shows and what it says is missing.
	it('says Not saved beside the title until the lesson is created', async () => {
		wrapper = await mountDraft()
		const badge = () => wrapper.findComponent({ name: 'UnsavedBadge' })
		expect(badge().props('missing')).toEqual(['a title'])
		await typeTitle(wrapper, 'Intro')
		expect(badge().props('missing')).toEqual([])
		await idle(3000)
		await settleCreate()
		expect(badge().exists()).toBe(false)
	})

	describe('leaving an unsaved lesson', () => {
		const guard = (w: VueWrapper, leave: () => void) =>
			(w.vm as any).guardLeave(leave) as boolean

		beforeEach(() => dialogMock.mockReset())

		// Guards: a discard prompt on a lesson with nothing to lose. Introduced in
		// this branch (feat/onboarding-flows, PR pending); test added there.
		it('leaves an empty new lesson silently', async () => {
			wrapper = await mountDraft()
			expect(guard(wrapper, vi.fn())).toBe(true)
			expect(dialogMock).not.toHaveBeenCalled()
		})

		// Guards: a discard prompt on a titled lesson, which leaving saves anyway.
		// Introduced in this branch (feat/onboarding-flows, PR pending); test
		// added there.
		it('leaves a titled one silently, since leaving creates it', async () => {
			wrapper = await mountDraft()
			await typeTitle(wrapper, 'Intro')
			expect(guard(wrapper, vi.fn())).toBe(true)
			expect(dialogMock).not.toHaveBeenCalled()
		})

		// Guards: body edits on an untitled lesson vanishing without a prompt.
		// Introduced in this branch (feat/onboarding-flows, PR pending); test
		// added there to pin the prompt's wording and actions.
		it('asks before discarding a body that has no title to save it under', async () => {
			wrapper = await mountDraft()
			await editBody(wrapper)
			const leave = vi.fn()
			expect(guard(wrapper, leave)).toBe(false)
			expect(lastDialog().title).toBe('Discard changes?')
			expect(lastDialog().message).toBe(
				"This lesson hasn't been saved. Your changes will be lost."
			)
			expect(lastDialog().actions.map((a) => a.label)).toEqual([
				'Discard',
				'Keep editing',
			])
		})

		// Guards: the prompt's buttons doing the wrong thing or Discard re-asking.
		// Introduced in this branch (feat/onboarding-flows, PR pending); test
		// added there.
		it('Keep editing stays; Discard leaves and does not ask again', async () => {
			wrapper = await mountDraft()
			await editBody(wrapper)
			const leave = vi.fn()
			guard(wrapper, leave)
			press('Keep editing')
			expect(leave).not.toHaveBeenCalled()
			guard(wrapper, leave)
			press('Discard')
			expect(leave).toHaveBeenCalledTimes(1)
			expect(guard(wrapper, vi.fn())).toBe(true)
		})

		// Guards: closing the tab silently dropping an untitled lesson's body.
		// Introduced in this branch (feat/onboarding-flows, PR pending); test
		// added there for the beforeunload prompt.
		it('has the browser ask before closing the tab', async () => {
			wrapper = await mountDraft()
			const event = new Event('beforeunload', { cancelable: true })
			window.dispatchEvent(event)
			expect(event.defaultPrevented).toBe(false)
			await editBody(wrapper)
			const lost = new Event('beforeunload', { cancelable: true })
			window.dispatchEvent(lost)
			expect(lost.defaultPrevented).toBe(true)
		})
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
