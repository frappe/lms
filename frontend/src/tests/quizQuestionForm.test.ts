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

// FormShell registers a document-level keydown listener and moves real focus,
// so wrappers left mounted by earlier tests would keep listening.
enableAutoUnmount(afterEach)

// Shared collection points for the resource mocks. vi.hoisted because vi.mock's
// factory is hoisted above ALL top-level code — a bare `const` referenced inside
// it throws "Cannot access before initialization".
const H = vi.hoisted(() => {
	// @/utils (pulled in transitively) touches matchMedia at import time.
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
	return {
		resources: [] as any[],
		docs: [] as any[],
		// Seeded BEFORE mount to simulate an already-warm document cache; left
		// empty to simulate the cold deep link, where `doc` starts null and the
		// resource fetches it.
		seeds: {} as Record<string, any>,
		createResource: vi.fn(),
		createDocumentResource: vi.fn(),
		toast: { success: vi.fn(), error: vi.fn() },
	}
})

// frappe-ui's ESM build doesn't resolve under vitest (see NewMemberModal.test.ts,
// FormShell.test.ts), so importActual() throws. Everything the form and FormShell
// pull in is stubbed by hand. The factory is async so it can reach `reactive` —
// the row resource's `doc` has to be reactive for the component's watch to fire
// when the fetch lands, which is the whole cold-deep-link path under test.
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

vi.mock('frappe-ui', async () => {
	const { reactive } = await import('vue')

	H.createResource.mockImplementation((options: any) => {
		const resource = reactive({
			options,
			data: null,
			loading: false,
			fetch: vi.fn(),
			reload: vi.fn(),
			submit: vi.fn(),
		})
		H.resources.push(resource)
		return resource
	})

	// Mirrors documentResource.js:15 — no doctype/name pair, no resource at all.
	// That is what the form relies on for the 'new' sentinel.
	H.createDocumentResource.mockImplementation((options: any) => {
		if (!(options.doctype && options.name)) return undefined
		const resource = reactive({
			options,
			doc: H.seeds[`${options.doctype}:${options.name}`] ?? null,
			loading: false,
			reload: vi.fn(),
		})
		H.docs.push(resource)
		return resource
	})

	return {
		createResource: H.createResource,
		createDocumentResource: H.createDocumentResource,
		toast: H.toast,
		Dialog: {
			name: 'Dialog',
			props: ['open', 'title', 'size'],
			emits: ['update:open'],
			template: `<div v-if="open" role="dialog"><slot name="title" /><slot /><slot name="actions" /></div>`,
		},
		Button: {
			inheritAttrs: false,
			template: `<button v-bind="$attrs"><slot name="icon" /><slot name="prefix" /><slot /></button>`,
		},
		FormControl: {
			props: ['modelValue', 'label', 'type', 'required', 'options'],
			emits: ['update:modelValue'],
			template: `<label>{{ label }}<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" /></label>`,
		},
	}
})

vi.mock('frappe-ui/frappe', () => ({
	useOnboarding: () => ({ updateOnboardingStep: vi.fn() }),
}))

vi.mock('@/components/Controls/BooleanSwitch.vue', () => ({
	default: {
		props: ['modelValue', 'label', 'description', 'size'],
		emits: ['update:modelValue'],
		template: `<label>{{ label }}</label>`,
	},
}))
vi.mock('@/components/Controls/Link.vue', () => ({
	default: {
		props: ['modelValue', 'label', 'doctype'],
		emits: ['update:modelValue'],
		template: `<label>{{ label }}</label>`,
	},
}))
vi.mock('@/components/RichTextEditor.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))

// The form is a plain-JS SFC, so vue-tsc has no declaration for it (TS7016) —
// the same shape as Billing.test.ts and PersonaForm.test.ts. Suppressed rather
// than left to raise the branch's type-error count.
// @ts-expect-error - untyped .vue module
import QuizQuestionForm from '@/pages/Forms/QuizQuestionForm.vue'

const QuizPage = defineComponent({
	render: () => h('div', ['QUIZ', h(RouterView)]),
})

const makeRouter = (): Router =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: '/quizzes/:quizID',
				name: 'QuizForm',
				component: QuizPage,
				props: true,
				children: [
					{
						path: 'question/:questionName',
						name: 'QuizQuestion',
						component: QuizQuestionForm,
						props: true,
					},
				],
			},
		],
	})

const mountForm = async (router: Router, user: Record<string, unknown>) => {
	const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
		global: {
			plugins: [router],
			provide: { $user: { data: user } },
			stubs: { teleport: true },
			// vi.stubGlobal alone doesn't reach a compiled template's `_ctx.__`.
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
}

// Finds a createResource by its endpoint AND the doctype its makeParams builds:
// the form owns two frappe.client.insert resources and two set_value resources,
// so the URL alone is ambiguous.
const findResource = (url: string, doctype: string) =>
	H.resources.find((resource) => {
		if (resource.options.url !== url) return false
		const params = resource.options.makeParams({})
		return (params.doc?.doctype ?? params.doctype) === doctype
	})

const findDoc = (doctype: string, name: string) =>
	H.docs.find(
		(doc) => doc.options.doctype === doctype && doc.options.name === name
	)

// The full LMS Question row: enough option/possibility fields to prove the
// visible-count restore, and a `question` body to prove the chained fetch.
const QUESTION_DOC = {
	name: 'QSTN-0007',
	question: '<p>What is 2 + 2?</p>',
	type: 'Choices',
	option_1: 'three',
	is_correct_1: 0,
	explanation_1: 'no',
	option_2: 'four',
	is_correct_2: 1,
	explanation_2: 'yes',
	option_3: 'five',
	is_correct_3: 0,
}

// Every label the question form is meant to render for a brand-new Choices
// question. Pinned so a field lost in the modal→page move fails a test.
const NEW_FIELD_LABELS = [
	'Choose an existing question',
	'Question',
	'Marks',
	'Type',
	'Option 1',
	'Explanation',
	'Correct Answer',
	'Option 2',
	'Explanation',
	'Correct Answer',
]

const openNew = async (router: Router) => {
	await router.push({
		name: 'QuizQuestion',
		params: { quizID: 'QUIZ-1', questionName: 'new' },
	})
}

const openExisting = async (router: Router) => {
	await router.push({
		name: 'QuizQuestion',
		params: { quizID: 'QUIZ-1', questionName: 'ROW-1' },
	})
}

describe('QuizQuestionForm as a route', () => {
	beforeEach(() => {
		H.resources.length = 0
		H.docs.length = 0
		for (const key of Object.keys(H.seeds)) delete H.seeds[key]
		// mockClear, not mockReset: mockReset would drop the implementations the
		// (once-run) module factory installed and every later test would get
		// `undefined` back from createResource.
		H.createResource.mockClear()
		H.createDocumentResource.mockClear()
		H.toast.success.mockClear()
		H.toast.error.mockClear()
		Object.defineProperty(window, 'innerWidth', {
			value: 1024,
			writable: true,
			configurable: true,
		})
	})

	it('mounts straight from the URL with no quiz page of its own', async () => {
		const router = makeRouter()
		await openNew(router)
		const wrapper = await mountForm(router, moderator)
		expect(wrapper.find('[data-testid="quiz-question-fields"]').exists()).toBe(
			true
		)
		expect(wrapper.html()).toContain('Add Question')
	})

	it('titles itself Edit Question when the URL names a row', async () => {
		const router = makeRouter()
		await openExisting(router)
		const wrapper = await mountForm(router, moderator)
		expect(wrapper.html()).toContain('Edit Question')
	})

	it('refuses to render the fields for a user who cannot manage the quiz', async () => {
		const router = makeRouter()
		await openNew(router)
		const wrapper = await mountForm(router, student)
		expect(wrapper.find('[data-testid="quiz-question-fields"]').exists()).toBe(
			false
		)
		expect(wrapper.find('[data-testid="quiz-question-save"]').exists()).toBe(
			false
		)
		expect(wrapper.html()).toContain('not permitted')
	})

	it('carries every field of the new-question form', async () => {
		const router = makeRouter()
		await openNew(router)
		const wrapper = await mountForm(router, moderator)

		const fields = wrapper.find('[data-testid="quiz-question-fields"]')
		const labels = fields
			.findAll('label')
			.map((label) => label.text())
			.filter((text) => text !== '')
		expect(labels).toEqual(NEW_FIELD_LABELS)
	})

	it('treats the "new" sentinel as a sentinel, not as a row name', async () => {
		const router = makeRouter()
		await openNew(router)
		await mountForm(router, moderator)

		// The old sentinel was an empty string. If 'new' ever leaks through as a
		// docname, this fetches a row called "new" and the form edits a ghost.
		expect(findDoc('LMS Quiz Question', 'new')).toBeUndefined()
		expect(
			H.createDocumentResource.mock.calls.some(
				(call) => call[0].doctype === 'LMS Quiz Question' && call[0].auto
			)
		).toBe(false)
	})

	it('fetches the row itself on a cold deep link, then the question it links to', async () => {
		const router = makeRouter()
		await openExisting(router)
		await mountForm(router, moderator)

		// C4: nothing is scraped from the parent's in-memory questions array.
		const row = findDoc('LMS Quiz Question', 'ROW-1')
		expect(row).toBeDefined()
		expect(row.options.auto).toBe(true)

		const questionGet = findResource('frappe.client.get', 'LMS Question')
		// Chained, not parallel: the LMS Question docname is only known once the
		// row lands.
		expect(questionGet.fetch).not.toHaveBeenCalled()

		row.doc = { name: 'ROW-1', question: 'QSTN-0007', marks: 7 }
		await flushPromises()

		expect(questionGet.fetch).toHaveBeenCalledTimes(1)
		expect(questionGet.options.makeParams()).toEqual({
			doctype: 'LMS Question',
			name: 'QSTN-0007',
		})
	})

	it('renders the fetched question and takes marks from the ROW, not the question', async () => {
		const router = makeRouter()
		H.seeds['LMS Quiz Question:ROW-1'] = {
			name: 'ROW-1',
			question: 'QSTN-0007',
			marks: 7,
		}
		await openExisting(router)
		await mountForm(router, moderator)

		const questionGet = findResource('frappe.client.get', 'LMS Question')
		// C3: the row resource handed back an already-populated doc, so the chain
		// only starts if the watch is `immediate`. Without it the form renders
		// blank on exactly this path.
		expect(questionGet.fetch).toHaveBeenCalledTimes(1)
		// The LMS Question doctype has no `marks` field at all; marks is a column
		// of the LMS Quiz Question child row (R2).
		questionGet.options.onSuccess({ ...QUESTION_DOC, marks: 999 })
		await flushPromises()

		const update = findResource('frappe.client.set_value', 'LMS Question')
		const payload = update.options.makeParams({}).fieldname
		expect(payload.question).toBe('<p>What is 2 + 2?</p>')
		expect(payload.option_3).toBe('five')
		expect(payload.is_correct_2).toBe(true)
		expect(payload.marks).toBe(7)
	})

	it('writes marks back to the LMS Quiz Question ROW named by the URL', async () => {
		const router = makeRouter()
		H.seeds['LMS Quiz Question:ROW-1'] = {
			name: 'ROW-1',
			question: 'QSTN-0007',
			marks: 7,
		}
		await openExisting(router)
		const wrapper = await mountForm(router, moderator)

		const marks = findResource('frappe.client.set_value', 'LMS Quiz Question')
		// R2, the whole reason the route param is the row name: `marks` is
		// unrecoverable from the LMS Question docname.
		expect(marks.options.makeParams({})).toEqual({
			doctype: 'LMS Quiz Question',
			name: 'ROW-1',
			fieldname: { marks: 7 },
		})

		const update = findResource('frappe.client.set_value', 'LMS Question')
		update.submit.mockImplementation(
			(_values: unknown, opts: { onSuccess: () => void }) => opts.onSuccess()
		)
		await wrapper.find('[data-testid="quiz-question-save"]').trigger('click')
		expect(marks.submit).toHaveBeenCalledTimes(1)
	})

	it('creates the question and its quiz row through its own resources', async () => {
		const router = makeRouter()
		await openNew(router)
		const wrapper = await mountForm(router, moderator)

		const create = findResource('frappe.client.insert', 'LMS Question')
		const insertRow = findResource('frappe.client.insert', 'LMS Quiz Question')
		create.submit.mockImplementation(
			(_values: unknown, opts: { onSuccess: (d: unknown) => void }) =>
				opts.onSuccess({ name: 'QSTN-0009' })
		)

		await wrapper.find('[data-testid="quiz-question-save"]').trigger('click')
		expect(create.submit).toHaveBeenCalledTimes(1)
		expect(insertRow.submit).toHaveBeenCalledWith(
			{ question: 'QSTN-0009', marks: 1 },
			expect.anything()
		)
		// The row is parented to the quiz from the URL, not from a prop.
		expect(insertRow.options.makeParams({}).doc).toMatchObject({
			parent: 'QUIZ-1',
			parenttype: 'LMS Quiz',
			parentfield: 'questions',
		})
	})

	it('reloads the quiz through the SAME document resource QuizForm.vue owns', async () => {
		const router = makeRouter()
		await openNew(router)
		const wrapper = await mountForm(router, moderator)

		// QuizForm.vue renders quizDetails.doc.questions — a child table, not a
		// list resource — so the shared-instance mechanism is
		// createDocumentResource's [doctype, name] cache. If either half drifts
		// from QuizForm.vue:375-379, a saved question silently stops appearing.
		const quiz = findDoc('LMS Quiz', 'QUIZ-1')
		expect(quiz).toBeDefined()

		const create = findResource('frappe.client.insert', 'LMS Question')
		const insertRow = findResource('frappe.client.insert', 'LMS Quiz Question')
		create.submit.mockImplementation(
			(_v: unknown, opts: { onSuccess: (d: unknown) => void }) =>
				opts.onSuccess({ name: 'QSTN-0009' })
		)
		insertRow.submit.mockImplementation(
			(_v: unknown, opts: { onSuccess: () => void }) => opts.onSuccess()
		)

		await wrapper.find('[data-testid="quiz-question-save"]').trigger('click')
		await flushPromises()
		expect(quiz.reload).toHaveBeenCalledTimes(1)
	})

	it('replaces rather than pushes on save, so Back reaches the quiz', async () => {
		const router = makeRouter()
		await router.push({ name: 'QuizForm', params: { quizID: 'QUIZ-1' } })
		await router.push({
			name: 'QuizQuestion',
			params: { quizID: 'QUIZ-1', questionName: 'new' },
			state: { lmsFormEntry: true },
		})
		const wrapper = await mountForm(router, moderator)

		const create = findResource('frappe.client.insert', 'LMS Question')
		const insertRow = findResource('frappe.client.insert', 'LMS Quiz Question')
		create.submit.mockImplementation(
			(_v: unknown, opts: { onSuccess: (d: unknown) => void }) =>
				opts.onSuccess({ name: 'QSTN-0009' })
		)
		insertRow.submit.mockImplementation(
			(_v: unknown, opts: { onSuccess: () => void }) => opts.onSuccess()
		)

		await wrapper.find('[data-testid="quiz-question-save"]').trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('QuizForm')

		// A push would have left the form entry in place, so Back would land on
		// a stale, empty form instead of the quiz.
		router.back()
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('QuizForm')
	})

	it('mobile: the back control pops the router back to the quiz', async () => {
		const router = makeRouter()
		await router.push({ name: 'QuizForm', params: { quizID: 'QUIZ-1' } })
		await router.push({
			name: 'QuizQuestion',
			params: { quizID: 'QUIZ-1', questionName: 'new' },
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
		expect(router.currentRoute.value.name).toBe('QuizForm')
	})

	it('desktop: dismissing the Dialog (Escape/backdrop/X) pops the router', async () => {
		const router = makeRouter()
		await router.push({ name: 'QuizForm', params: { quizID: 'QUIZ-1' } })
		await router.push({
			name: 'QuizQuestion',
			params: { quizID: 'QUIZ-1', questionName: 'new' },
			state: { lmsFormEntry: true },
		})
		const wrapper = await mountForm(router, moderator)

		await wrapper
			.findComponent({ name: 'Dialog' })
			.vm.$emit('update:open', false)
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('QuizForm')
	})
})
