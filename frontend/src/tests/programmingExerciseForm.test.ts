import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import {
	createMemoryHistory,
	createRouter,
	RouterView,
	type Router,
} from 'vue-router'
import { defineComponent, h } from 'vue'

vi.stubGlobal('__', (text: string) => text)

enableAutoUnmount(afterEach)

const insertSubmit = vi.fn()
const setValueSubmit = vi.fn()
const deleteSubmit = vi.fn()
const exercisesReload = vi.fn()
const countReload = vi.fn()

// vi.hoisted because vi.mock's factory is hoisted above every top-level const,
// so a bare vi.fn() referenced inside it throws "Cannot access before
// initialization".
const {
	createListResourceMock,
	createResourceMock,
	createDocumentResourceMock,
} = vi.hoisted(() => {
	// @/utils pulls in plyr, which touches matchMedia at import time.
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
	return {
		createListResourceMock: vi.fn(),
		createResourceMock: vi.fn(),
		createDocumentResourceMock: vi.fn(),
	}
})

type Row = { name: string; input: string; expected_output: string }

const exercisesResource = {
	doctype: 'LMS Programming Exercise',
	insert: { submit: insertSubmit },
	setValue: { submit: setValueSubmit, error: null as Error | null },
	delete: { submit: deleteSubmit },
	reload: exercisesReload,
	data: [] as unknown[],
}
createListResourceMock.mockReturnValue(exercisesResource)
createResourceMock.mockReturnValue({ reload: countReload, data: 0 })
// Faithful to documentResource.js:15 — no doctype+name, no resource at all.
const documentResourceStub = (doc: unknown) => (options: { name?: string }) =>
	options.name ? { doc } : undefined
createDocumentResourceMock.mockImplementation(documentResourceStub(null))

// HeaderButton wraps frappe-ui's Button in a Tooltip below the mobile
// breakpoint, and the hand-written frappe-ui mock here has no Tooltip. Stub it
// down to the bare button so the fallthrough attrs the assertions use
// (data-testid, the click handler) still land where they did before.
vi.mock('@/components/HeaderButton.vue', () => ({
	default: {
		inheritAttrs: false,
		template: `<button v-bind="$attrs" />`,
	},
}))

// Only the exports the form and FormShell use; the real barrel never loads.
vi.mock('frappe-ui', () => ({
	createListResource: createListResourceMock,
	createResource: createResourceMock,
	createDocumentResource: createDocumentResourceMock,
	toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
	Dialog: {
		name: 'Dialog',
		props: ['open', 'title', 'size'],
		emits: ['update:open'],
		template: `<div v-if="open" role="dialog"><h2>{{ title }}</h2><slot name="title" /><slot /><slot name="actions" /></div>`,
	},
	Badge: { template: `<span><slot /></span>` },
	FormControl: {
		props: ['modelValue', 'label', 'type', 'required', 'options'],
		emits: ['update:modelValue'],
		template: `<label>{{ label }}<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" /></label>`,
	},
	Breadcrumbs: {
		props: ['items'],
		template: `<nav><span v-for="i in items" :key="i.label">{{ i.label }}</span></nav>`,
	},
	LoadingIndicator: { template: `<span />` },
}))

// Preview mounts the learner's submission page, which pulls in the code
// runner. Nothing here previews.
vi.mock(
	'@/pages/ProgrammingExercises/ProgrammingExerciseSubmission.vue',
	() => ({
		default: defineComponent({ render: () => h('div') }),
	})
)

// The rich text editor drags in ProseMirror; a button stands in for typing.
vi.mock('@/components/RichTextEditor.vue', () => ({
	default: defineComponent({
		emits: ['change'],
		setup:
			(_p, { emit }) =>
			() =>
				h('button', {
					'data-testid': 'statement',
					onClick: () => emit('change', '<p>Reverse it.</p>'),
				}),
	}),
}))
// Stubbed rather than mocked away entirely: the deep-link test needs to see
// what rows the form actually handed the table, which is the whole point.
vi.mock('@/components/Controls/ChildTable.vue', () => ({
	default: defineComponent({
		props: { modelValue: { type: Array, default: () => [] }, label: String },
		emits: ['update:modelValue'],
		render(this: {
			modelValue: Row[]
			label: string
			$emit: (event: string, value: unknown) => void
		}) {
			return h('div', { 'data-testid': 'test-cases' }, [
				h('label', this.label),
				h('button', {
					'data-testid': 'add-case',
					onClick: () =>
						this.$emit('update:modelValue', [
							{ input: '"abc"', expected_output: '"cba"', hidden: true },
						]),
				}),
				h('button', {
					'data-testid': 'edit-case',
					onClick: () =>
						this.$emit('update:modelValue', [
							{ input: '"abcd"', expected_output: '"dcba"', hidden: true },
						]),
				}),
				...(this.modelValue || []).map((row: Row) =>
					h('span', { class: 'test-case-row' }, row.input)
				),
			])
		},
	}),
}))

import ProgrammingExerciseForm from '@/pages/Forms/ProgrammingExerciseForm.vue'
import { toast } from 'frappe-ui'

// The form is its own page, so the list stub needs no nested RouterView.
const List = defineComponent({
	render: () => h('div', ['LIST']),
})

const makeRouter = (): Router =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: '/programming-exercises',
				name: 'ProgrammingExercises',
				component: List,
			},
			{
				path: '/programming-exercises/new',
				name: 'NewProgrammingExercise',
				component: ProgrammingExerciseForm,
			},
			{
				path: '/programming-exercises/edit/:exerciseID',
				name: 'ProgrammingExerciseForm',
				component: ProgrammingExerciseForm,
				props: true,
			},
			{
				path: '/programming-exercises/submissions',
				name: 'ProgrammingExerciseSubmissions',
				component: List,
			},
			{
				path: '/programming-exercises/:exerciseID/submission/:submissionID',
				name: 'ProgrammingExerciseSubmission',
				component: List,
			},
		],
	})

const mountForm = async (router: Router, user: Record<string, unknown>) => {
	const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
		global: {
			plugins: [router],
			provide: { $user: { data: user } },
			stubs: { teleport: true },
			// vi.stubGlobal alone doesn't reach a compiled template's `_ctx.__`
			// access — it has to be on the instance too (see FormShell.test.ts).
			mocks: { __: (text: string) => text },
		},
	})
	await flushPromises()
	return wrapper
}

const fillRequired = async (wrapper: ReturnType<typeof mount>) => {
	await wrapper.get('[data-testid="statement"]').trigger('click')
	await wrapper.get('[data-testid="add-case"]').trigger('click')
	await flushPromises()
}

const leaveContent = async (wrapper: ReturnType<typeof mount>) => {
	await wrapper.get('[data-testid="add-case"]').trigger('focusout')
	await flushPromises()
}

const moderator = { name: 'mod@example.com', is_moderator: true }
const student = {
	name: 'student@example.com',
	is_moderator: false,
	is_instructor: false,
	is_evaluator: false,
}

// Every field the exercise form is meant to collect. Pin the set: a field lost
// in the modal→route move is otherwise invisible to the rest of the suite.
const FIELD_LABELS = [
	'Title',
	'Language',
	'Starter Code',
	'Test Cases',
	'Problem Statement',
]

describe('ProgrammingExerciseForm as a route', () => {
	beforeEach(() => {
		insertSubmit.mockReset()
		setValueSubmit.mockReset()
		deleteSubmit.mockReset()
		exercisesReload.mockReset()
		countReload.mockReset()
		exercisesResource.setValue.error = null
		createListResourceMock.mockClear()
		createResourceMock.mockClear()
		createDocumentResourceMock.mockClear()
		createDocumentResourceMock.mockImplementation(documentResourceStub(null))
		Object.defineProperty(window, 'innerWidth', {
			value: 1024,
			writable: true,
			configurable: true,
		})
	})

	it('mounts straight from the URL with no parent list', async () => {
		const router = makeRouter()
		await router.push('/programming-exercises/new')
		const wrapper = await mountForm(router, moderator)
		expect(wrapper.html()).toContain('New Programming Exercise')
		expect(
			wrapper.find('[data-testid="programming-exercise-fields"]').exists()
		).toBe(true)
	})

	it('refuses to render the form for a user who cannot manage exercises', async () => {
		const router = makeRouter()
		await router.push('/programming-exercises/new')
		const wrapper = await mountForm(router, student)
		expect(
			wrapper.find('[data-testid="programming-exercise-fields"]').exists()
		).toBe(false)
		expect(
			wrapper.find('[data-testid="programming-exercise-delete"]').exists()
		).toBe(false)
		expect(wrapper.html()).toContain('not permitted')
	})

	it('carries every field of the exercise form', async () => {
		createDocumentResourceMock.mockImplementation(
			documentResourceStub({
				name: 'EX-0001',
				title: 'T',
				language: 'Python',
				test_cases: [],
			})
		)
		const router = makeRouter()
		await router.push('/programming-exercises/edit/EX-0001')
		const wrapper = await mountForm(router, moderator)

		const fields = wrapper.find('[data-testid="programming-exercise-fields"]')
		// InputLabel appends RequiredIndicator ("*" plus an sr-only "(required)"),
		// so the field's own name has to be read out of that.
		const labels = fields
			.findAll('label')
			.map((label) =>
				label
					.text()
					.replace(/\(required\)|\*/g, '')
					.replace(/\s+/g, ' ')
					.trim()
			)
			.filter((text) => text !== '')
		for (const label of FIELD_LABELS) {
			expect(labels).toContain(label)
		}
		// Exact count, so an added field has to be added here too.
		expect(labels).toHaveLength(FIELD_LABELS.length)
		// Problem Statement is a rich text editor, not a <label>.
		expect(fields.text()).toContain('Problem Statement')
	})

	// Guards the starter code clipping in a six-row sidebar textarea.
	// Came with this branch's programming exercise authoring page.
	// Added on feat/assessment-visual-redesign: the learner's code editor, tall.
	it('edits the starter code in the code editor the learner uses', async () => {
		createDocumentResourceMock.mockImplementation(
			documentResourceStub({
				name: 'EX-0001',
				title: 'T',
				language: 'Python',
				starter_code: 'x = 1',
				test_cases: [],
			})
		)
		const router = makeRouter()
		await router.push('/programming-exercises/edit/EX-0001')
		const wrapper = await mountForm(router, moderator)

		const field = wrapper.get(
			'[data-testid="programming-exercise-starter-code"]'
		)
		const editor = field.get('[data-testid="exercise-code-editor"]')
		expect(editor.classes()).toContain('min-h-[24rem]')
		expect(field.find('textarea').exists()).toBe(false)
	})

	it('fetches its own record on a cold deep link into edit mode', async () => {
		// C4 — edit mode used to be seeded from the list page's in-memory rows,
		// which are empty when the route is opened cold.
		createDocumentResourceMock.mockImplementation(
			documentResourceStub({
				name: 'EX-0001',
				title: 'Reverse a string',
				language: 'Python',
				problem_statement: '<p>reverse it</p>',
			})
		)
		const router = makeRouter()
		await router.push('/programming-exercises/edit/EX-0001')
		const wrapper = await mountForm(router, moderator)

		expect(createDocumentResourceMock).toHaveBeenCalledWith(
			expect.objectContaining({
				doctype: 'LMS Programming Exercise',
				name: 'EX-0001',
				auto: true,
			})
		)
		expect((wrapper.find('input').element as HTMLInputElement).value).toBe(
			'Reverse a string'
		)
	})

	it('does not build a document resource in create mode', async () => {
		// Not cosmetic: the real createDocumentResource returns UNDEFINED for a
		// falsy name (documentResource.js:15), so a form that constructs one
		// unconditionally and then reads `.doc` off it throws on /edit/new.
		const router = makeRouter()
		await router.push('/programming-exercises/new')
		const wrapper = await mountForm(router, moderator)

		expect(createDocumentResourceMock).not.toHaveBeenCalled()
		expect(
			wrapper.find('[data-testid="programming-exercise-fields"]').exists()
		).toBe(true)
	})

	// Guards a deep-linked edit showing, then saving back, an empty case table.
	// Broke in #2662 (deep-linked form, rows a second resource since #1593).
	// Added on feat/assessment-visual-redesign, which reads rows off the record.
	it('loads the test cases from the record on a cold deep link', async () => {
		createDocumentResourceMock.mockImplementation(
			documentResourceStub({
				name: 'EX-0001',
				title: 'T',
				language: 'Python',
				test_cases: [{ input: '"abc"', expected_output: '"cba"' }],
			})
		)
		const router = makeRouter()
		await router.push('/programming-exercises/edit/EX-0001')
		const wrapper = await mountForm(router, moderator)

		expect(wrapper.findAll('.test-case-row').map((r) => r.text())).toEqual([
			'"abc"',
		])
	})

	it('scopes its list resource to the SAME cache key ProgrammingExercises.vue uses', async () => {
		// The single load-bearing reason a created or deleted exercise reaches
		// the list: createListResource hands back whichever instance was cached
		// first under this key, and insert/delete refetch THAT instance. If this
		// key drifts from ProgrammingExercises.vue:133's, a save silently stops
		// showing up with no other test failing.
		const router = makeRouter()
		await router.push('/programming-exercises/new')
		await mountForm(router, moderator)

		expect(createListResourceMock).toHaveBeenCalledWith(
			expect.objectContaining({ cache: ['programmingExercises'] })
		)
		expect(createResourceMock).toHaveBeenCalledWith(
			expect.objectContaining({
				cache: ['programming_exercises_count', 'mod@example.com'],
			})
		)
	})

	// Guards a half-typed title naming the document for good (docname is a slug).
	// Came with this branch's create-on-blur exercise change.
	// Added on feat/assessment-visual-redesign to pin insert-on-blur only.
	it('inserts through its own resource when the title loses focus', async () => {
		insertSubmit.mockImplementation(
			(_doc: unknown, options: { onSuccess: (d: { name: string }) => void }) =>
				options.onSuccess({ name: 'reverse-a-string' })
		)
		const router = makeRouter()
		await router.push('/programming-exercises/new')
		const wrapper = await mountForm(router, moderator)

		const title = wrapper.find('[data-testid="programming-exercise-title"]')
		await title.find('input').setValue('Reverse a string')
		await fillRequired(wrapper)
		expect(insertSubmit).not.toHaveBeenCalled()

		await title.trigger('blur')
		await flushPromises()
		expect(insertSubmit).toHaveBeenCalledTimes(1)
		expect(setValueSubmit).not.toHaveBeenCalled()
	})

	// Guards an edit being written without a Save button.
	// Came with this branch's autosaving-document composable.
	// Added on feat/assessment-visual-redesign when the Save button went away.
	it('autosaves an edit through its own resource', async () => {
		vi.useFakeTimers()
		createDocumentResourceMock.mockImplementation(
			documentResourceStub({
				name: 'EX-0001',
				title: 'T',
				language: 'Python',
				test_cases: [],
			})
		)
		setValueSubmit.mockResolvedValue({})
		const router = makeRouter()
		await router.push('/programming-exercises/edit/EX-0001')
		const wrapper = await mountForm(router, moderator)

		await wrapper
			.find('[data-testid="programming-exercise-title"] input')
			.setValue('Renamed')
		await vi.advanceTimersByTimeAsync(1500)

		expect(setValueSubmit).toHaveBeenCalledTimes(1)
		expect(setValueSubmit.mock.calls[0][0]).toMatchObject({
			name: 'EX-0001',
			title: 'Renamed',
		})
		vi.useRealTimers()
	})

	// Guards a failed autosave being silently remembered and never retried.
	// Came with this branch's autosaving-document composable.
	// Added on feat/assessment-visual-redesign to pin the toast and Mod+S retry.
	it('reports a failed autosave and retries it on Mod+S', async () => {
		vi.useFakeTimers()
		createDocumentResourceMock.mockImplementation(
			documentResourceStub({ name: 'EX-0001', title: 'T', language: 'Python' })
		)
		setValueSubmit.mockImplementation(async () => {
			exercisesResource.setValue.error = new Error('Not permitted')
		})
		const router = makeRouter()
		await router.push('/programming-exercises/edit/EX-0001')
		const wrapper = await mountForm(router, moderator)

		await wrapper
			.find('[data-testid="programming-exercise-title"] input')
			.setValue('Renamed')
		await vi.advanceTimersByTimeAsync(1500)
		expect(toast.error).toHaveBeenCalled()

		window.dispatchEvent(
			new KeyboardEvent('keydown', { key: 's', ctrlKey: true })
		)
		await vi.advanceTimersByTimeAsync(0)
		expect(setValueSubmit).toHaveBeenCalledTimes(2)
		vi.useRealTimers()
	})

	// Guards a title-only insert, which the server refuses (statement and a case
	// are required). Came with this branch's exercise-as-a-page change.
	// Added on feat/assessment-visual-redesign to pin create-when-complete.
	it('waits for a problem statement and a test case before creating', async () => {
		const router = makeRouter()
		await router.push('/programming-exercises/new')
		const wrapper = await mountForm(router, moderator)

		const title = wrapper.find('[data-testid="programming-exercise-title"]')
		await title.find('input').setValue('Reverse a string')
		await title.trigger('blur')
		await flushPromises()
		expect(insertSubmit).not.toHaveBeenCalled()

		await fillRequired(wrapper)
		expect(insertSubmit).not.toHaveBeenCalled()

		await leaveContent(wrapper)
		expect(insertSubmit).toHaveBeenCalledTimes(1)
	})

	// Guards a late keystroke naming the exercise after the title was left.
	// Came with this branch's create-on-blur exercise change.
	// Added on feat/assessment-visual-redesign to pin the blur-time title.
	it('never names the exercise from a title typed after the title was left', async () => {
		const router = makeRouter()
		await router.push('/programming-exercises/new')
		const wrapper = await mountForm(router, moderator)
		const title = wrapper.find('[data-testid="programming-exercise-title"]')
		await title.trigger('blur')
		await fillRequired(wrapper)

		await title.find('input').setValue('R')
		await leaveContent(wrapper)

		expect(insertSubmit).not.toHaveBeenCalled()
	})

	// Guards a landing create dragging an author back from the page they left.
	// Came with this branch's create-on-blur exercise change.
	// Added on feat/assessment-visual-redesign to pin no redirect after leaving.
	it('stays on the page the author left for while the create lands', async () => {
		let finishInsert: () => void = () => {}
		insertSubmit.mockImplementation(
			(
				_doc: unknown,
				options: { onSuccess: (d: { name: string }) => void }
			) => {
				finishInsert = () => options.onSuccess({ name: 'reverse-a-string' })
			}
		)
		const router = makeRouter()
		await router.push('/programming-exercises/new')
		const wrapper = await mountForm(router, moderator)
		const title = wrapper.find('[data-testid="programming-exercise-title"]')
		await title.find('input').setValue('Reverse a string')
		await fillRequired(wrapper)
		await title.trigger('blur')

		await router.push({ name: 'ProgrammingExercises' })
		finishInsert()
		await flushPromises()

		expect(router.currentRoute.value.name).toBe('ProgrammingExercises')
	})

	// Guards an edit made during the insert being overwritten by the record.
	// Came with this branch's create-on-blur exercise change.
	// Added on feat/assessment-visual-redesign to pin edits kept across create.
	it('keeps an edit made while the create is in flight', async () => {
		let finishInsert: () => void = () => {}
		insertSubmit.mockImplementation(
			(
				_doc: unknown,
				options: { onSuccess: (d: { name: string }) => void }
			) => {
				finishInsert = () => options.onSuccess({ name: 'reverse-a-string' })
			}
		)
		createDocumentResourceMock.mockImplementation(
			documentResourceStub({
				name: 'reverse-a-string',
				title: 'Reverse a string',
				language: 'Python',
				problem_statement: '<p>Reverse it.</p>',
				test_cases: [{ input: '"abc"', expected_output: '"cba"', hidden: 1 }],
			})
		)
		const router = makeRouter()
		await router.push('/programming-exercises/new')
		const wrapper = await mountForm(router, moderator)
		const title = wrapper.find('[data-testid="programming-exercise-title"]')
		await title.find('input').setValue('Reverse a string')
		await fillRequired(wrapper)
		await title.trigger('blur')

		await wrapper.get('[data-testid="edit-case"]').trigger('click')
		finishInsert()
		await flushPromises()

		expect(wrapper.findAll('.test-case-row').map((r) => r.text())).toEqual([
			'"abcd"',
		])
	})

	it('reloads the header count after a create', async () => {
		// The old form did this through a defineModel typed `number` that the
		// parent filled with a resource. The model is gone; the refresh is not.
		insertSubmit.mockImplementation(
			(_doc: unknown, options: { onSuccess: (d: { name: string }) => void }) =>
				options.onSuccess({ name: 'reverse-a-string' })
		)
		const router = makeRouter()
		await router.push('/programming-exercises/new')
		const wrapper = await mountForm(router, moderator)

		const title = wrapper.find('[data-testid="programming-exercise-title"]')
		await title.find('input').setValue('Reverse a string')
		await fillRequired(wrapper)
		await title.trigger('blur')
		await flushPromises()
		expect(countReload).toHaveBeenCalledTimes(1)
	})

	it('replaces onto the saved route, so Back never reaches the empty form', async () => {
		insertSubmit.mockImplementation(
			(_doc: unknown, options: { onSuccess: (d: { name: string }) => void }) =>
				options.onSuccess({ name: 'reverse-a-string' })
		)
		const router = makeRouter()
		await router.push({ name: 'ProgrammingExercises' })
		await router.push('/programming-exercises/new')
		const wrapper = await mountForm(router, moderator)

		const title = wrapper.find('[data-testid="programming-exercise-title"]')
		await title.find('input').setValue('Reverse a string')
		await fillRequired(wrapper)
		await title.trigger('blur')
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('ProgrammingExerciseForm')
		expect(router.currentRoute.value.params.exerciseID).toBe('reverse-a-string')

		// A push would have left the unnamed form behind for Back to land on.
		router.back()
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('ProgrammingExercises')
	})

	it('closes back to the list after a delete', async () => {
		createDocumentResourceMock.mockImplementation(
			documentResourceStub({
				name: 'EX-0001',
				title: 'T',
				language: 'Python',
				test_cases: [],
			})
		)
		deleteSubmit.mockImplementation(
			(_name: string, options: { onSuccess: () => void }) => options.onSuccess()
		)
		const router = makeRouter()
		await router.push({ name: 'ProgrammingExercises' })
		await router.push('/programming-exercises/edit/EX-0001')
		const wrapper = await mountForm(router, moderator)

		await wrapper
			.find('[data-testid="programming-exercise-delete"]')
			.trigger('click')
		await flushPromises()
		expect(deleteSubmit.mock.calls[0][0]).toBe('EX-0001')
		expect(router.currentRoute.value.name).toBe('ProgrammingExercises')
	})
})
