import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'

// Shared, hoisted state the (hoisted) vi.mock factories close over.
// - `created.list` records every createResource() the component makes, so a test
//   can find a specific resource by its url and inspect/submit it.
// - `editorState.saveData` is what each mocked BlockEditor.save() returns, keyed
//   by the editor's uploadContext.fieldname ('content' vs 'instructor_content').
const created = vi.hoisted(() => ({ list: [] as any[] }))
const editorState = vi.hoisted(() => ({
	saveData: {} as Record<string, any>,
	// When true, the instructor editor's isReady() never resolves, so the form's
	// initial load never completes (initialLoadComplete stays false) — modelling a
	// title autosave that fires before the saved notes have rendered.
	holdInstructorReady: false,
	// When true, the body editor's save() rejects — modelling an EditorJS instance
	// being destroyed mid-save during teardown.
	rejectBodySave: false,
	// Same, for the instructor-notes editor.
	rejectNotesSave: false,
}))

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
				lastHandlers: null,
			})
			// Run the real makeParams so the recorded params reflect production
			// serialisation (e.g. set_value's `fieldname` is the live lesson object).
			r.submit = vi.fn((params: any, handlers: any) => {
				r.lastParams = config.makeParams ? config.makeParams(params) : params
				r.lastHandlers = handlers
				return Promise.resolve()
			})
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

// BlockEditor mock: faithful to the teardown contract — onBeforeUnmount nulls the
// instance, after which save() returns null (matching the real null guard). save()
// reads `editorState.saveData[fieldname]` so a test can stage "edited" content.
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
					isReady: () =>
						field === 'instructor_content' && editorState.holdInstructorReady
							? new Promise(() => {})
							: Promise.resolve(),
					render: async () => {},
					focus: () => {},
					save: async () => {
						if (field === 'content' && editorState.rejectBodySave) {
							throw new Error('editor torn down mid-save')
						}
						if (
							field === 'instructor_content' &&
							editorState.rejectNotesSave
						) {
							throw new Error('editor torn down mid-save')
						}
						return alive ? (editorState.saveData[field] ?? null) : null
					},
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
import BlockEditorStub from '@/components/BlockEditor.vue'

const LESSON_NAME = 'LESSON-1'
const paragraph = (text: string) => ({
	blocks: [{ type: 'paragraph', data: { text } }],
})

const findResource = (url: string, doctype?: string) =>
	created.list.find(
		(r) =>
			r._config.url === url &&
			(!doctype ||
				r._config.makeParams?.({})?.doc?.doctype === doctype ||
				r._config.makeParams?.({ lesson: '' })?.doctype === doctype)
	)

// Mount LessonForm and drive its lessonDetails resource to "loaded" so the
// editors render and autosave is armed, mirroring a real open lesson.
async function mountLoaded(lessonOverrides: Record<string, any> = {}) {
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
		(r) => r._config.url === 'lms.lms.utils.get_lesson_creation_details'
	)
	const data = {
		lesson: {
			name: LESSON_NAME,
			title: 'Existing title',
			include_in_preview: 0,
			content: '',
			instructor_content: '',
			...lessonOverrides,
		},
		chapter: { name: 'CH-1' },
	}
	details.data = data
	details._config.onSuccess(data)
	await flushPromises()
	return wrapper
}

// A title @input is real user input, so it both updates v-model and arms autosave.
async function editTitle(wrapper: VueWrapper, title: string) {
	await wrapper.find('textarea.lesson-title').setValue(title)
}

// Fire a @change from a specific BlockEditor (body vs instructor), modelling an
// edit inside that editor while it is still alive.
async function editEditor(wrapper: VueWrapper, fieldname: string) {
	const editor = wrapper
		.findAllComponents(BlockEditorStub)
		.find((c) => (c.props('uploadContext') as any)?.fieldname === fieldname)
	editor!.vm.$emit('change')
	await flushPromises()
}

describe('LessonForm teardown autosave', () => {
	let wrapper: VueWrapper

	beforeEach(() => {
		created.list.length = 0
		editorState.saveData = {}
		editorState.holdInstructorReady = false
		editorState.rejectBodySave = false
		editorState.rejectNotesSave = false
	})

	afterEach(() => {
		try {
			wrapper?.unmount()
		} catch {
			// already unmounted by the test
		}
		document.body.innerHTML = ''
	})

	it('folds in instructor-note edits even when unmount flushes during the body save', async () => {
		wrapper = await mountLoaded()
		// Body has real content (so the save isn't skipped) and the instructor
		// editor holds a fresh, unsaved note.
		editorState.saveData.content = paragraph('Body text')
		editorState.saveData.instructor_content = paragraph('Edited note')
		await editTitle(wrapper, 'Edited title')

		// Unmount flush: the body save resolves on a microtask, by which point the
		// instructor editor has torn down. The instructor note must NOT be dropped.
		wrapper.unmount()
		await flushPromises()

		const editLesson = findResource('frappe.client.set_value')
		expect(editLesson.submit).toHaveBeenCalledTimes(1)
		expect(editLesson.lastParams.name).toBe(LESSON_NAME)
		expect(editLesson.lastParams.fieldname.instructor_content).toContain(
			'Edited note'
		)
	})

	it('still persists the lesson when an editor save rejects during teardown', async () => {
		wrapper = await mountLoaded()
		// The body editor's save() rejects (its EditorJS instance is being torn
		// down). The title edit must still be written — not lost to a rejected
		// Promise.all.
		editorState.rejectBodySave = true
		await editTitle(wrapper, 'Edited title')

		wrapper.unmount()
		await flushPromises()

		const editLesson = findResource('frappe.client.set_value')
		expect(editLesson.submit).toHaveBeenCalledTimes(1)
		expect(editLesson.lastParams.fieldname.title).toBe('Edited title')
	})

	it('persists the latest body edit captured before teardown even when the body save rejects', async () => {
		// Lesson opens with stored body content.
		wrapper = await mountLoaded({
			content: JSON.stringify(paragraph('Old body')),
		})

		// User edits the body; the @change captures the new content into the local
		// lesson while the editor is still alive (no teardown race yet).
		editorState.saveData.content = paragraph('New body')
		await editEditor(wrapper, 'content')

		// Now the editor is torn down and its save() rejects on the unmount flush.
		// The freshly-captured "New body" must win — not the stale stored content,
		// and not a silently-dropped edit behind a successful-looking save.
		editorState.rejectBodySave = true
		wrapper.unmount()
		await flushPromises()

		const editLesson = findResource('frappe.client.set_value')
		expect(editLesson.submit).toHaveBeenCalledTimes(1)
		expect(editLesson.lastParams.fieldname.content).toContain('New body')
		expect(editLesson.lastParams.fieldname.content).not.toContain('Old body')
	})

	it('persists the latest instructor-note edit captured before teardown even when its save rejects', async () => {
		wrapper = await mountLoaded({
			content: JSON.stringify(paragraph('Body text')),
			instructor_content: JSON.stringify(paragraph('Old note')),
		})

		// Edit the instructor note; captured while the editor is alive.
		editorState.saveData.content = paragraph('Body text')
		editorState.saveData.instructor_content = paragraph('New note')
		await editEditor(wrapper, 'instructor_content')

		// The instructor editor's save() rejects on the unmount flush (its EditorJS
		// instance is being destroyed). The captured note must still be persisted.
		editorState.rejectNotesSave = true
		wrapper.unmount()
		await flushPromises()

		const editLesson = findResource('frappe.client.set_value')
		expect(editLesson.submit).toHaveBeenCalledTimes(1)
		expect(editLesson.lastParams.fieldname.instructor_content).toContain(
			'New note'
		)
		expect(editLesson.lastParams.fieldname.instructor_content).not.toContain(
			'Old note'
		)
	})

	it('does not wipe stored instructor notes on a title-only flush before the notes finish loading', async () => {
		// The instructor editor never finishes loading its saved notes, so the
		// form's initial load stays incomplete and the editor still serialises to
		// its empty default.
		editorState.holdInstructorReady = true
		const STORED_NOTES = JSON.stringify(paragraph('Saved notes'))
		wrapper = await mountLoaded({ instructor_content: STORED_NOTES })

		editorState.saveData.content = paragraph('Body text')
		editorState.saveData.instructor_content = { blocks: [] } // empty default
		// A title edit arms autosave even before the editors finish rendering.
		await editTitle(wrapper, 'Edited title')

		wrapper.unmount()
		await flushPromises()

		const editLesson = findResource('frappe.client.set_value')
		expect(editLesson.submit).toHaveBeenCalledTimes(1)
		// The stored notes must survive — folding the empty default would wipe them.
		expect(editLesson.lastParams.fieldname.instructor_content).toBe(STORED_NOTES)
	})

	it('does not save the lesson on teardown once it has been marked deleted', async () => {
		wrapper = await mountLoaded()
		editorState.saveData.content = paragraph('Body text')
		await editTitle(wrapper, 'Edited title')

		// The open lesson was deleted elsewhere; CourseEditor signals this before
		// the form unmounts. The flush must not write to the deleted document.
		;(wrapper.vm as any).markDeleted()
		wrapper.unmount()
		await flushPromises()

		const editLesson = findResource('frappe.client.set_value')
		expect(editLesson.submit).not.toHaveBeenCalled()
	})

	it('still flushes a dirty lesson on genuine navigation (not deleted)', async () => {
		wrapper = await mountLoaded()
		editorState.saveData.content = paragraph('Body text')
		await editTitle(wrapper, 'Edited title')

		// No deletion signal — a normal navigate-away must still persist the edit.
		wrapper.unmount()
		await flushPromises()

		const editLesson = findResource('frappe.client.set_value')
		expect(editLesson.submit).toHaveBeenCalledTimes(1)
		expect(editLesson.lastParams.name).toBe(LESSON_NAME)
	})
})
