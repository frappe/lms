import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import {
	createMemoryHistory,
	createRouter,
	RouterView,
	type Router,
} from 'vue-router'
import { defineComponent, h, reactive } from 'vue'

vi.stubGlobal('__', (text: string) => text)

enableAutoUnmount(afterEach)

// vi.hoisted because vi.mock's factory is hoisted above every top-level const.
// Only the *holders* live here: the fake document resource itself is built in
// beforeEach, in the test body, where `reactive` is actually initialised.
const {
	createDocumentResourceMock,
	createResourceMock,
	docOptions,
	docResource,
	insertOptions,
	insertSubmit,
	setValueSubmit,
	passthrough,
} = vi.hoisted(() => {
	// @/utils pulls in plyr, which touches matchMedia at import time.
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia

	const docOptions: { current: any } = { current: null }
	const docResource: { current: any } = { current: null }
	const insertOptions: { current: any } = { current: null }
	const insertSubmit = vi.fn()
	const setValueSubmit = vi.fn()

	return {
		docOptions,
		docResource,
		insertOptions,
		insertSubmit,
		setValueSubmit,
		// Mirrors documentResource.js:15 — no name, no resource at all.
		createDocumentResourceMock: vi.fn((options: any) => {
			docOptions.current = options
			return options.name ? docResource.current : undefined
		}),
		createResourceMock: vi.fn((options: any) => {
			insertOptions.current = options
			return { loading: false, data: null, submit: insertSubmit }
		}),
		// Renders its label, as the real Combobox/Select/MultiSelect do: a stub
		// that drops it makes "every field is labelled" pass by omission.
		passthrough: {
			inheritAttrs: false,
			props: ['label'],
			template: `<div><label v-if="label">{{ label }}</label><slot name="icon" /><slot /></div>`,
		},
	}
})

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

vi.mock('@/stores/settings', () => ({ useSettings: () => ({}) }))
vi.mock('@/stores/user', () => ({ usersStore: () => ({ userResource: {} }) }))

// frappe-ui's ESM build does not resolve under vitest, so every export the
// form, FormShell and the Controls wrappers use is stubbed by hand.
vi.mock('frappe-ui', () => ({
	createDocumentResource: createDocumentResourceMock,
	createResource: createResourceMock,
	createListResource: vi.fn(() => ({ data: [], insert: { submit: vi.fn() } })),
	call: vi.fn(),
	toast: { success: vi.fn(), error: vi.fn() },
	Dialog: {
		name: 'Dialog',
		props: ['open', 'title', 'size'],
		emits: ['update:open'],
		template: `<div v-if="open" role="dialog"><h2>{{ title }}</h2><slot /><slot name="actions" /></div>`,
	},
	Button: {
		inheritAttrs: false,
		template: `<button v-bind="$attrs"><slot name="icon" /><slot /></button>`,
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

vi.mock('@/components/RichTextEditor.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))
vi.mock('@/components/Controls/Link.vue', () => ({
	default: {
		props: ['modelValue', 'label', 'doctype', 'placeholder'],
		template: `<label>{{ label }}<input data-testid="assignment-course" :value="modelValue" /></label>`,
	},
}))

import AssignmentForm from '@/pages/Forms/AssignmentForm.vue'

// The list page hosts the form as a child route, so the stub has to render a
// nested RouterView or the child never mounts. RouterView is imported rather
// than written as the string 'router-view', which h() would leave unresolved.
const created = vi.fn()
const List = defineComponent({
	render: () => h('div', ['LIST', h(RouterView, { onCreated: created })]),
})

const makeRouter = (): Router =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: '/assignments',
				name: 'Assignments',
				component: List,
				children: [
					{
						path: ':assignmentID',
						name: 'AssignmentForm',
						component: AssignmentForm,
						props: true,
					},
				],
			},
			{
				path: '/assignment-submissions',
				name: 'AssignmentSubmissionList',
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

// The form was converted from a modal by moving this field set wholesale, so
// pin it: a field dropped in the move is otherwise invisible to the suite.
const FIELD_LABELS = ['Title', 'Submission Type', 'Course', 'Question']

const RECORD = {
	name: 'ASG-0001',
	title: 'Write an essay',
	type: 'Text',
	question: '<p>Why?</p>',
	course: 'COURSE-1',
}

const inputs = (wrapper: any) =>
	wrapper.find('[data-testid="assignment-fields"]').findAll('input')

describe('AssignmentForm as a route', () => {
	beforeEach(() => {
		insertSubmit.mockReset()
		setValueSubmit.mockReset()
		created.mockReset()
		createDocumentResourceMock.mockClear()
		docOptions.current = null
		insertOptions.current = null
		docResource.current = reactive({
			doc: null as Record<string, string> | null,
			setValue: { submit: setValueSubmit, loading: false },
		})
		Object.defineProperty(window, 'innerWidth', {
			value: 1024,
			writable: true,
			configurable: true,
		})
	})

	it('mounts straight from the URL with no parent list', async () => {
		const router = makeRouter()
		await router.push({
			name: 'AssignmentForm',
			params: { assignmentID: 'new' },
		})
		const wrapper = await mountForm(router, moderator)
		expect(wrapper.html()).toContain('Create an Assignment')
		expect(wrapper.find('[data-testid="assignment-fields"]').exists()).toBe(
			true
		)
	})

	it('refuses to render the form for a user who cannot manage assignments', async () => {
		const router = makeRouter()
		await router.push({
			name: 'AssignmentForm',
			params: { assignmentID: 'new' },
		})
		const wrapper = await mountForm(router, student)
		expect(wrapper.find('[data-testid="assignment-fields"]').exists()).toBe(
			false
		)
		expect(wrapper.find('[data-testid="assignment-save"]').exists()).toBe(false)
		expect(wrapper.html()).toContain('not permitted')
	})

	it('carries every field of the assignment form', async () => {
		const router = makeRouter()
		await router.push({
			name: 'AssignmentForm',
			params: { assignmentID: 'new' },
		})
		const wrapper = await mountForm(router, moderator)

		const fields = wrapper.find('[data-testid="assignment-fields"]')
		// InputLabel appends RequiredIndicator ("*" plus an sr-only "(required)"),
		// so the field's own name has to be read out of that.
		const labels = fields
			.findAll('label')
			.map((label: any) =>
				label
					.text()
					.replace(/\(required\)|\*/g, '')
					.replace(/\s+/g, ' ')
					.trim()
			)
			.filter((text: string) => text !== '')
		expect(labels).toEqual(FIELD_LABELS)
		expect(
			fields.find('[data-testid="assignment-question-label"]').text()
		).toContain('Question')
	})

	it('fetches the record itself on a cold deep link into edit mode', async () => {
		// C4. The form used to read edit values out of the parent list's
		// in-memory array, which is empty when the list has never been mounted —
		// so this is the case that rendered a blank form and could then save the
		// blanks back over the record.
		const router = makeRouter()
		await router.push({
			name: 'AssignmentForm',
			params: { assignmentID: 'ASG-0001' },
		})
		await mountForm(router, moderator)

		expect(docOptions.current).toMatchObject({
			doctype: 'LMS Assignment',
			name: 'ASG-0001',
			auto: true,
		})
	})

	it('populates the fields from a document resource that is already loaded', async () => {
		// documentResource hands back a cached, populated instance for a record
		// visited earlier in the session, so the watcher has to run immediately —
		// without `immediate: true` the fields stay empty.
		const router = makeRouter()
		docResource.current.doc = RECORD
		await router.push({
			name: 'AssignmentForm',
			params: { assignmentID: 'ASG-0001' },
		})
		const wrapper = await mountForm(router, moderator)

		const values = inputs(wrapper).map((i: any) => i.element.value)
		expect(values).toEqual(['Write an essay', 'Text', 'COURSE-1'])
		expect(wrapper.html()).toContain('Edit Assignment')
	})

	it('populates the fields when the fetch lands after mount', async () => {
		const router = makeRouter()
		await router.push({
			name: 'AssignmentForm',
			params: { assignmentID: 'ASG-0001' },
		})
		const wrapper = await mountForm(router, moderator)
		expect(inputs(wrapper).map((i: any) => i.element.value)).toEqual([
			'',
			'',
			'',
		])

		docResource.current.doc = RECORD
		await flushPromises()
		expect(inputs(wrapper).map((i: any) => i.element.value)).toEqual([
			'Write an essay',
			'Text',
			'COURSE-1',
		])
	})

	it('does not fetch a document in create mode', async () => {
		const router = makeRouter()
		await router.push({
			name: 'AssignmentForm',
			params: { assignmentID: 'new' },
		})
		await mountForm(router, moderator)

		expect(docOptions.current).toMatchObject({ name: undefined, auto: false })
	})

	it('creates through its own resource, not a parent-supplied one', async () => {
		const router = makeRouter()
		await router.push({
			name: 'AssignmentForm',
			params: { assignmentID: 'new' },
		})
		const wrapper = await mountForm(router, moderator)

		await wrapper.find('[data-testid="assignment-save"]').trigger('click')
		expect(insertSubmit).toHaveBeenCalledTimes(1)
		expect(insertOptions.current.url).toBe('frappe.client.insert')
		expect(insertOptions.current.makeParams()).toEqual({
			doc: {
				doctype: 'LMS Assignment',
				title: '',
				type: '',
				question: '',
				course: '',
			},
		})
	})

	it('updates through its own document resource in edit mode', async () => {
		const router = makeRouter()
		docResource.current.doc = RECORD
		await router.push({
			name: 'AssignmentForm',
			params: { assignmentID: 'ASG-0001' },
		})
		const wrapper = await mountForm(router, moderator)

		await wrapper.find('[data-testid="assignment-save"]').trigger('click')
		expect(setValueSubmit).toHaveBeenCalledTimes(1)
		expect(setValueSubmit.mock.calls[0][0]).toEqual({
			title: 'Write an essay',
			type: 'Text',
			question: '<p>Why?</p>',
			course: 'COURSE-1',
		})
		expect(insertSubmit).not.toHaveBeenCalled()
	})

	it('ignores a save from a user who cannot manage assignments', async () => {
		const router = makeRouter()
		await router.push({
			name: 'AssignmentForm',
			params: { assignmentID: 'new' },
		})
		const wrapper = await mountForm(router, student)

		// The button is gated too, so reach past it to the handler itself —
		// otherwise this only re-tests the refusal render above.
		const vm = wrapper.findComponent(AssignmentForm).vm as any
		expect(typeof vm.saveAssignment).toBe('function')
		vm.saveAssignment()
		await flushPromises()
		expect(insertSubmit).not.toHaveBeenCalled()
	})

	it('signals the parent list to refetch after a create', async () => {
		// The form deliberately does NOT share Assignments.vue's list cache key
		// (design C4b — that page configures its list through constructor
		// options), so this emit is the only way a new row reaches the list.
		const router = makeRouter()
		await router.push({
			name: 'AssignmentForm',
			params: { assignmentID: 'new' },
		})
		const wrapper = await mountForm(router, moderator)

		insertSubmit.mockImplementation(() =>
			insertOptions.current.onSuccess({ name: 'ASG-0002' })
		)
		await wrapper.find('[data-testid="assignment-save"]').trigger('click')
		await flushPromises()
		expect(created).toHaveBeenCalledTimes(1)
	})

	it('replaces rather than pushes on save, so Back reaches the list', async () => {
		const router = makeRouter()
		await router.push({ name: 'Assignments' })
		await router.push({
			name: 'AssignmentForm',
			params: { assignmentID: 'new' },
			state: { lmsFormEntry: true },
		})
		const wrapper = await mountForm(router, moderator)

		insertSubmit.mockImplementation(() =>
			insertOptions.current.onSuccess({ name: 'ASG-0002' })
		)
		await wrapper.find('[data-testid="assignment-save"]').trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('Assignments')

		// A push would have left the form as the previous entry.
		router.back()
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('Assignments')
	})

	it('mobile: the back control pops the router back to the list', async () => {
		const router = makeRouter()
		await router.push({ name: 'Assignments' })
		await router.push({
			name: 'AssignmentForm',
			params: { assignmentID: 'new' },
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
		expect(router.currentRoute.value.name).toBe('Assignments')
	})

	it('desktop: dismissing the Dialog (Escape/backdrop/X) pops the router', async () => {
		const router = makeRouter()
		await router.push({ name: 'Assignments' })
		await router.push({
			name: 'AssignmentForm',
			params: { assignmentID: 'new' },
			state: { lmsFormEntry: true },
		})
		const wrapper = await mountForm(router, moderator)

		await wrapper
			.findComponent({ name: 'Dialog' })
			.vm.$emit('update:open', false)
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('Assignments')
	})
})
