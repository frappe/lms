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
const testCasesUpdate = vi.fn()
const testCasesReload = vi.fn()
const countReload = vi.fn()

// vi.hoisted because vi.mock's factory is hoisted above every top-level const,
// so a bare vi.fn() referenced inside it throws "Cannot access before
// initialization".
const {
	createListResourceMock,
	createResourceMock,
	createDocumentResourceMock,
	passthrough,
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
		// Renders its label, as the real Combobox/Select/MultiSelect do: a stub
		// that drops it makes "every field is labelled" pass by omission.
		passthrough: {
			inheritAttrs: false,
			props: ['label'],
			template: `<div><label v-if="label">{{ label }}</label><slot name="icon" /><slot /></div>`,
		},
	}
})

type Row = { name: string; input: string; expected_output: string }

const exercisesResource = {
	doctype: 'LMS Programming Exercise',
	insert: { submit: insertSubmit },
	setValue: { submit: setValueSubmit },
	delete: { submit: deleteSubmit },
	reload: exercisesReload,
	data: [] as unknown[],
}
const testCasesResource = {
	doctype: 'LMS Test Case',
	update: testCasesUpdate,
	reload: testCasesReload,
	data: [] as Row[],
}

createListResourceMock.mockImplementation((options: { doctype: string }) =>
	options.doctype === 'LMS Test Case' ? testCasesResource : exercisesResource
)
createResourceMock.mockReturnValue({ reload: countReload, data: 0 })
// Faithful to documentResource.js:15 — no doctype+name, no resource at all.
const documentResourceStub = (doc: unknown) => (options: { name?: string }) =>
	options.name ? { doc } : undefined
createDocumentResourceMock.mockImplementation(documentResourceStub(null))

// frappe-ui's internal module resolution doesn't work under vitest (see
// FormShell.test.ts), so importActual() on it throws ERR_MODULE_NOT_FOUND.
// Every export the form and FormShell pull in has to be stubbed by hand.
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

vi.mock('frappe-ui', () => ({
	createListResource: createListResourceMock,
	createResource: createResourceMock,
	createDocumentResource: createDocumentResourceMock,
	call: vi.fn(),
	toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
	Dialog: {
		name: 'Dialog',
		props: ['open', 'title', 'size'],
		emits: ['update:open'],
		template: `<div v-if="open" role="dialog"><h2>{{ title }}</h2><slot name="title" /><slot /><slot name="actions" /></div>`,
	},
	Badge: { template: `<span><slot /></span>` },
	Button: {
		inheritAttrs: false,
		template: `<button v-bind="$attrs"><slot name="prefix" /><slot name="icon" /><slot /></button>`,
	},
	FormControl: {
		props: ['modelValue', 'label', 'type', 'required', 'options'],
		emits: ['update:modelValue'],
		template: `<label>{{ label }}<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" /></label>`,
	},
	FormLabel: {
		props: ['label', 'required', 'id'],
		template: `<label :for="id">{{ label }}</label>`,
	},
	Combobox: passthrough,
	MultiSelect: passthrough,
	Select: passthrough,
}))

// The rich text editor drags in ProseMirror; nothing under test involves it.
vi.mock('@/components/RichTextEditor.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))
// Stubbed rather than mocked away entirely: the deep-link test needs to see
// what rows the form actually handed the table, which is the whole point.
vi.mock('@/components/Controls/ChildTable.vue', () => ({
	default: defineComponent({
		props: { modelValue: { type: Array, default: () => [] }, label: String },
		render(this: { modelValue: Row[]; label: string }) {
			return h('div', { 'data-testid': 'test-cases' }, [
				h('label', this.label),
				...(this.modelValue || []).map((row: Row) =>
					h('span', { class: 'test-case-row' }, row.input)
				),
			])
		},
	}),
}))

import ProgrammingExerciseForm from '@/pages/Forms/ProgrammingExerciseForm.vue'

// The list page hosts the form as a child route, so the parent stub has to
// render a nested RouterView or the child never mounts. RouterView is imported
// rather than written as the string 'router-view', which h() would leave as an
// unresolved custom element.
const List = defineComponent({
	render: () => h('div', ['LIST', h(RouterView)]),
})

const makeRouter = (): Router =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: '/programming-exercises',
				name: 'ProgrammingExercises',
				component: List,
				children: [
					{
						path: 'edit/:exerciseID',
						name: 'ProgrammingExerciseForm',
						component: ProgrammingExerciseForm,
						props: true,
					},
				],
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

const moderator = { name: 'mod@example.com', is_moderator: true }
const student = {
	name: 'student@example.com',
	is_moderator: false,
	is_instructor: false,
	is_evaluator: false,
}

// Every field the exercise form is meant to collect. Pin the set: a field lost
// in the modal→route move is otherwise invisible to the rest of the suite.
const FIELD_LABELS = ['Title', 'Language', 'Test Cases', 'Problem Statement']

describe('ProgrammingExerciseForm as a route', () => {
	beforeEach(() => {
		insertSubmit.mockReset()
		setValueSubmit.mockReset()
		deleteSubmit.mockReset()
		exercisesReload.mockReset()
		countReload.mockReset()
		testCasesUpdate.mockReset()
		testCasesReload.mockReset()
		createListResourceMock.mockClear()
		createResourceMock.mockClear()
		createDocumentResourceMock.mockClear()
		createDocumentResourceMock.mockImplementation(documentResourceStub(null))
		testCasesResource.data = []
		Object.defineProperty(window, 'innerWidth', {
			value: 1024,
			writable: true,
			configurable: true,
		})
	})

	it('mounts straight from the URL with no parent list', async () => {
		const router = makeRouter()
		await router.push('/programming-exercises/edit/new')
		const wrapper = await mountForm(router, moderator)
		expect(wrapper.html()).toContain('Create Programming Exercise')
		expect(
			wrapper.find('[data-testid="programming-exercise-fields"]').exists()
		).toBe(true)
	})

	it('refuses to render the form for a user who cannot manage exercises', async () => {
		const router = makeRouter()
		await router.push('/programming-exercises/edit/new')
		const wrapper = await mountForm(router, student)
		expect(
			wrapper.find('[data-testid="programming-exercise-fields"]').exists()
		).toBe(false)
		expect(
			wrapper.find('[data-testid="programming-exercise-save"]').exists()
		).toBe(false)
		expect(wrapper.html()).toContain('not permitted')
	})

	it('carries every field of the exercise form', async () => {
		const router = makeRouter()
		await router.push('/programming-exercises/edit/new')
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
		await router.push('/programming-exercises/edit/new')
		const wrapper = await mountForm(router, moderator)

		expect(createDocumentResourceMock).not.toHaveBeenCalled()
		expect(
			wrapper.find('[data-testid="programming-exercise-fields"]').exists()
		).toBe(true)
	})

	it('loads the test cases on a cold deep link, not an empty table', async () => {
		// The subtlest half of C3: the test cases are a SECOND resource, and the
		// watch that fetched them had no `immediate`, so a directly-mounted edit
		// route showed an empty Test Cases table — and saving wrote that back.
		testCasesReload.mockImplementation(() => {
			testCasesResource.data = [
				{ name: 'TC-1', input: '"abc"', expected_output: '"cba"' },
			]
		})
		const router = makeRouter()
		await router.push('/programming-exercises/edit/EX-0001')
		const wrapper = await mountForm(router, moderator)

		expect(testCasesUpdate).toHaveBeenCalledWith({
			filters: {
				parent: 'EX-0001',
				parenttype: 'LMS Programming Exercise',
				parentfield: 'test_cases',
			},
		})
		expect(testCasesReload).toHaveBeenCalledTimes(1)
		expect(wrapper.findAll('.test-case-row').map((r) => r.text())).toEqual([
			'"abc"',
		])
	})

	it('does not fetch test cases in create mode', async () => {
		const router = makeRouter()
		await router.push('/programming-exercises/edit/new')
		await mountForm(router, moderator)
		expect(testCasesReload).not.toHaveBeenCalled()
	})

	it('scopes its list resource to the SAME cache key ProgrammingExercises.vue uses', async () => {
		// The single load-bearing reason a created or deleted exercise reaches
		// the list: createListResource hands back whichever instance was cached
		// first under this key, and insert/delete refetch THAT instance. If this
		// key drifts from ProgrammingExercises.vue:133's, a save silently stops
		// showing up with no other test failing.
		const router = makeRouter()
		await router.push('/programming-exercises/edit/new')
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

	it('inserts through its own resource, not a parent-supplied one', async () => {
		const router = makeRouter()
		await router.push('/programming-exercises/edit/new')
		const wrapper = await mountForm(router, moderator)

		await wrapper
			.find('[data-testid="programming-exercise-save"]')
			.trigger('click')
		expect(insertSubmit).toHaveBeenCalledTimes(1)
		expect(setValueSubmit).not.toHaveBeenCalled()
	})

	it('updates through its own resource in edit mode and refreshes the count', async () => {
		createDocumentResourceMock.mockImplementation(
			documentResourceStub({ name: 'EX-0001', title: 'T', language: 'Python' })
		)
		setValueSubmit.mockImplementation(
			(_doc: unknown, options: { onSuccess: () => void }) => options.onSuccess()
		)
		const router = makeRouter()
		await router.push('/programming-exercises/edit/EX-0001')
		const wrapper = await mountForm(router, moderator)

		await wrapper
			.find('[data-testid="programming-exercise-save"]')
			.trigger('click')
		expect(setValueSubmit).toHaveBeenCalledTimes(1)
		expect(setValueSubmit.mock.calls[0][0]).toMatchObject({ name: 'EX-0001' })
		expect(exercisesReload).toHaveBeenCalledTimes(1)
	})

	it('reloads the header count after a create', async () => {
		// The old form did this through a defineModel typed `number` that the
		// parent filled with a resource. The model is gone; the refresh is not.
		insertSubmit.mockImplementation(
			(_doc: unknown, options: { onSuccess: () => void }) => options.onSuccess()
		)
		const router = makeRouter()
		await router.push('/programming-exercises/edit/new')
		const wrapper = await mountForm(router, moderator)

		await wrapper
			.find('[data-testid="programming-exercise-save"]')
			.trigger('click')
		expect(countReload).toHaveBeenCalledTimes(1)
	})

	it('replaces rather than pushes on save, so Back never reaches the form', async () => {
		insertSubmit.mockImplementation(
			(_doc: unknown, options: { onSuccess: () => void }) => options.onSuccess()
		)
		const router = makeRouter()
		await router.push({ name: 'ProgrammingExercises' })
		await router.push({
			path: '/programming-exercises/edit/new',
			state: { lmsFormEntry: true },
		})
		const wrapper = await mountForm(router, moderator)

		await wrapper
			.find('[data-testid="programming-exercise-save"]')
			.trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('ProgrammingExercises')

		// A push would have left the form entry behind for Back to land on.
		router.back()
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('ProgrammingExercises')
	})

	it('closes back to the list after a delete', async () => {
		createDocumentResourceMock.mockImplementation(
			documentResourceStub({ name: 'EX-0001', title: 'T', language: 'Python' })
		)
		deleteSubmit.mockImplementation(
			(_name: string, options: { onSuccess: () => void }) => options.onSuccess()
		)
		const router = makeRouter()
		await router.push({ name: 'ProgrammingExercises' })
		await router.push({
			path: '/programming-exercises/edit/EX-0001',
			state: { lmsFormEntry: true },
		})
		const wrapper = await mountForm(router, moderator)

		await wrapper
			.find('[data-testid="programming-exercise-delete"]')
			.trigger('click')
		await flushPromises()
		expect(deleteSubmit.mock.calls[0][0]).toBe('EX-0001')
		expect(router.currentRoute.value.name).toBe('ProgrammingExercises')
	})

	it('mobile: the back control pops the router back to the list', async () => {
		const router = makeRouter()
		await router.push({ name: 'ProgrammingExercises' })
		await router.push({
			path: '/programming-exercises/edit/new',
			state: { lmsFormEntry: true },
		})
		Object.defineProperty(window, 'innerWidth', {
			value: 390,
			writable: true,
			configurable: true,
		})
		const wrapper = await mountForm(router, moderator)

		await wrapper.find('[data-testid="form-shell-back"]').trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('ProgrammingExercises')
	})

	it('desktop: dismissing the Dialog (Escape/backdrop/X) pops the router', async () => {
		const router = makeRouter()
		await router.push({ name: 'ProgrammingExercises' })
		await router.push({
			path: '/programming-exercises/edit/new',
			state: { lmsFormEntry: true },
		})
		const wrapper = await mountForm(router, moderator)

		await wrapper
			.findComponent({ name: 'Dialog' })
			.vm.$emit('update:open', false)
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('ProgrammingExercises')
	})
})
