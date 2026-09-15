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

// Every resource the form creates, in creation order, so a test can answer one
// by hand and watch what the form does with it.
const { createListResourceMock, createDocumentResourceMock, resources } =
	vi.hoisted(() => ({
		createListResourceMock: vi.fn(),
		createDocumentResourceMock: vi.fn(),
		resources: { lists: [] as any[], docs: [] as any[] },
	}))

// vi.mock's factory is hoisted above every top-level const, so anything it
// references has to be hoisted too.
const { passthrough } = vi.hoisted(() => ({
	passthrough: {
		inheritAttrs: false,
		template: `<div><slot name="prefix" /><slot /></div>`,
	},
}))

const insertSubmit = vi.fn()
const setValueSubmit = vi.fn()
const deleteSubmit = vi.fn()

createListResourceMock.mockImplementation((options: any) => {
	const resource = reactive({
		options,
		data: null as any[] | null,
		update: vi.fn((patch: any) => Object.assign(resource.options, patch)),
		reload: vi.fn(),
		insert: { submit: insertSubmit, loading: false },
		setValue: { submit: setValueSubmit },
		delete: { submit: deleteSubmit },
		// Stands in for the server answering: the real resource assigns `data`
		// and then calls the options' onSuccess. It refuses to answer a request
		// that was never made, so a test cannot hand the form rows it would not
		// have had on a cold deep link.
		answer(rows: any[]) {
			if (resource.reload.mock.calls.length === 0) {
				throw new Error(
					`answered ${options.doctype}, which the form never reloaded`
				)
			}
			resource.data = rows
			options.onSuccess?.(rows)
		},
	})
	resources.lists.push(resource)
	return resource
})

// Mirrors documentResource.js:15 — createDocumentResource returns undefined
// when it is handed no name, which is what "create" mode does.
createDocumentResourceMock.mockImplementation((options: any) => {
	if (!options.name) return undefined
	const resource = reactive({
		options,
		doc: null as any,
		// Same rule as the list mock: a resource that was never told to fetch
		// cannot answer.
		answer(doc: any) {
			if (!options.auto) {
				throw new Error(`answered ${options.doctype}, which never fetched`)
			}
			resource.doc = doc
		},
	})
	resources.docs.push(resource)
	return resource
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

vi.mock('frappe-ui', () => ({
	createListResource: createListResourceMock,
	createDocumentResource: createDocumentResourceMock,
	toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
	Badge: { template: `<span><slot /></span>` },
	Dialog: {
		name: 'Dialog',
		props: ['open', 'title', 'size', 'actions'],
		emits: ['update:open'],
		template: `<div v-if="open" role="dialog"><h2>{{ title }}</h2><slot /><slot name="actions" /></div>`,
	},
	Button: {
		inheritAttrs: false,
		template: `<button v-bind="$attrs"><slot name="prefix" /><slot /></button>`,
	},
	FormControl: {
		props: ['modelValue', 'label', 'type', 'required'],
		emits: ['update:modelValue'],
		template: `<label>{{ label }}<input :type="type" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" /></label>`,
	},
	ListView: passthrough,
	ListHeader: passthrough,
	ListHeaderItem: passthrough,
	ListRows: passthrough,
	ListRow: passthrough,
	ListSelectBanner: { template: `<div />` },
}))

vi.mock('@/utils', () => ({
	sanitizeHTML: (value: string) => value,
	openSettings: vi.fn(),
}))
vi.mock('vuedraggable', () => ({
	default: defineComponent({ render: () => h('div') }),
}))
vi.mock('@/components/Controls/Link.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))
vi.mock('@/components/Programs/ProgramProgressSummary.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))
// The member table's list component. It is a real SFC over frappe-ui's ListView
// and has its own tests (responsiveListView.test.ts, listPage.test.ts); rendering
// it here would only exercise those against this file's frappe-ui stubs.
vi.mock('@/components/ResponsiveListView.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))

import ProgramForm from '@/pages/Forms/ProgramForm.vue'

const savedSpy = vi.fn()

// The list page hosts the form as a child route, so it renders a nested
// RouterView. RouterView is imported rather than written as the string
// 'router-view', which h() would leave as an unresolved custom element.
// The listener is bound on the outlet exactly as Programs.vue binds
// `@saved="updatePrograms"` — RouterView forwards its attrs to the routed
// component, which is the whole mechanism the parent's refresh depends on.
const List = defineComponent({
	render: () => h('div', ['LIST', h(RouterView, { onSaved: savedSpy })]),
})

const makeRouter = (): Router =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: '/programs',
				name: 'Programs',
				component: List,
				children: [
					{
						path: ':programName/edit',
						name: 'ProgramForm',
						component: ProgramForm,
						props: true,
					},
				],
			},
		],
	})

const moderator = { name: 'mod@example.com', is_moderator: true }
const student = {
	name: 'student@example.com',
	is_moderator: false,
	is_instructor: false,
}

const $dialog = vi.fn()

// Mounts ONLY the router outlet — the parent list page is never mounted, which
// is exactly the cold-deep-link case the form used to render blank in.
const mountForm = async (router: Router, user: Record<string, unknown>) => {
	const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
		global: {
			plugins: [router],
			provide: { $user: { data: user } },
			stubs: { teleport: true },
			config: { globalProperties: { $dialog } },
			// vi.stubGlobal alone doesn't reach a compiled template's `_ctx.__`
			// access — it has to be on the instance too (see FormShell.test.ts).
			mocks: { __: (text: string) => text },
		},
	})
	await flushPromises()
	return wrapper
}

const deepLink = async (
	programName: string,
	user: Record<string, unknown> = moderator
) => {
	const router = makeRouter()
	await router.push(`/programs/${programName}/edit`)
	const wrapper = await mountForm(router, user)
	return { router, wrapper }
}

const listFor = (doctype: string) =>
	resources.lists.find((resource) => resource.options.doctype === doctype)

const COURSE_ROWS = [
	{ name: 'row-c1', course: 'course-a', course_title: 'Course A', idx: 1 },
]
const MEMBER_ROWS = [
	{ name: 'row-m1', member: 'member@example.com', full_name: 'A Member' },
]

// Every label the form is meant to collect. Pin the set: a field lost in the
// modal→page move is otherwise invisible to the rest of the suite.
const FIELD_LABELS = ['Title', 'Published', 'Enforce Course Order']

beforeEach(() => {
	resources.lists.length = 0
	resources.docs.length = 0
	insertSubmit.mockReset()
	setValueSubmit.mockReset()
	deleteSubmit.mockReset()
	$dialog.mockReset()
	savedSpy.mockReset()
	Object.defineProperty(window, 'innerWidth', {
		value: 1024,
		writable: true,
		configurable: true,
	})
})

describe('ProgramForm as a route', () => {
	it('mounts straight from the URL with no parent list', async () => {
		const { wrapper } = await deepLink('new')
		expect(wrapper.html()).toContain('Create Program')
		expect(wrapper.find('[data-testid="program-fields"]').exists()).toBe(true)
	})

	it('refuses to render the form for a user who cannot manage programs', async () => {
		const { wrapper } = await deepLink('new', student)
		expect(wrapper.find('[data-testid="program-fields"]').exists()).toBe(false)
		expect(wrapper.find('[data-testid="program-save"]').exists()).toBe(false)
		expect(wrapper.html()).toContain('not permitted')
	})

	it('carries every field of the program form', async () => {
		const { wrapper } = await deepLink('new')
		const fields = wrapper.find('[data-testid="program-fields"]')
		const labels = fields
			.findAll('label')
			.map((label) => label.text())
			.filter((text) => text !== '')
		for (const label of FIELD_LABELS) {
			expect(labels).toContain(label)
		}
		// Exact count, so an added field has to be added here too.
		expect(labels).toHaveLength(FIELD_LABELS.length)
		// Both child tables are still on the page.
		expect(fields.text()).toContain('Courses')
		expect(fields.text()).toContain('Members')
	})

	it('inserts through its own resource on the create sentinel', async () => {
		const { wrapper } = await deepLink('new')
		// R3: `new` must reach the CREATE branch. The prop used to arrive as null
		// from the parent, and every `=== 'new'` check then took the edit path.
		expect(wrapper.find('[data-testid="program-delete"]').exists()).toBe(false)

		await wrapper.find('[data-testid="program-save"]').trigger('click')
		expect(insertSubmit).toHaveBeenCalledTimes(1)
		expect(setValueSubmit).not.toHaveBeenCalled()
	})

	it('replaces rather than pushes on save, so Back reaches the list', async () => {
		const router = makeRouter()
		await router.push({ name: 'Programs' })
		await router.push({
			name: 'ProgramForm',
			params: { programName: 'new' },
			state: { lmsFormEntry: true },
		})
		const wrapper = await mountForm(router, moderator)

		insertSubmit.mockImplementation(
			(_doc: unknown, options: { onSuccess: () => void }) => options.onSuccess()
		)
		await wrapper.find('[data-testid="program-save"]').trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('Programs')

		// The form entry was consumed, so Back leaves the list rather than
		// returning to a stale form.
		router.back()
		await flushPromises()
		expect(router.currentRoute.value.name).not.toBe('ProgramForm')
	})

	it('asks the list page to refetch rather than reloading its resource', async () => {
		const router = makeRouter()
		await router.push({ name: 'Programs' })
		await router.push({
			name: 'ProgramForm',
			params: { programName: 'new' },
			state: { lmsFormEntry: true },
		})
		const wrapper = await mountForm(router, moderator)

		insertSubmit.mockImplementation(
			(_doc: unknown, options: { onSuccess: () => void }) => options.onSuccess()
		)
		await wrapper.find('[data-testid="program-save"]').trigger('click')
		await flushPromises()

		// The list page refetches through updatePrograms(), which also drives its
		// loading flag and its footer count; a bare reload from here would skip
		// both. The listener reaching the form at all is the outlet forwarding it.
		expect(savedSpy).toHaveBeenCalledTimes(1)
	})

	it('mobile: the back control pops the router back to the list', async () => {
		const router = makeRouter()
		await router.push({ name: 'Programs' })
		await router.push({
			name: 'ProgramForm',
			params: { programName: 'new' },
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
		expect(router.currentRoute.value.name).toBe('Programs')
	})

	it('desktop: dismissing the Dialog (Escape/backdrop/X) pops the router', async () => {
		const router = makeRouter()
		await router.push({ name: 'Programs' })
		await router.push({
			name: 'ProgramForm',
			params: { programName: 'new' },
			state: { lmsFormEntry: true },
		})
		const wrapper = await mountForm(router, moderator)

		await wrapper
			.findComponent({ name: 'Dialog' })
			.vm.$emit('update:open', false)
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('Programs')
	})

	describe('edit mode, arrived at cold', () => {
		it('fetches its own record instead of reading a parent array (C4)', async () => {
			const { wrapper } = await deepLink('data-science')

			expect(createDocumentResourceMock).toHaveBeenCalledWith(
				expect.objectContaining({
					doctype: 'LMS Program',
					name: 'data-science',
					auto: true,
				})
			)

			// And the fetched document is what fills the form.
			resources.docs[0].answer({
				name: 'data-science',
				title: 'data-science',
				published: 1,
				enforce_course_order: 1,
			})
			await flushPromises()
			expect(
				(wrapper.find('input[type="text"]').element as HTMLInputElement).value
			).toBe('data-science')
		})

		it('loads both child tables on mount, with no prop change to trigger it (C3)', async () => {
			await deepLink('data-science')

			for (const doctype of ['LMS Program Course', 'LMS Program Member']) {
				const resource = listFor(doctype)
				expect(resource, doctype).toBeDefined()
				expect(resource.update).toHaveBeenCalledWith({
					filters: expect.objectContaining({
						parent: 'data-science',
						parenttype: 'LMS Program',
					}),
				})
				expect(resource.reload).toHaveBeenCalledTimes(1)
			}
		})

		it('does not wipe the child tables when saved straight after a deep link', async () => {
			// The most damaging shape of C4: the form used to seed itself from the
			// parent's in-memory array, which is empty on a cold deep link, and the
			// Save that followed posted two empty child tables over the real ones.
			const { wrapper } = await deepLink('data-science')

			listFor('LMS Program Course').answer(COURSE_ROWS)
			listFor('LMS Program Member').answer(MEMBER_ROWS)
			resources.docs[0].answer({
				name: 'data-science',
				title: 'data-science',
				published: 1,
				enforce_course_order: 0,
			})
			await flushPromises()

			await wrapper.find('[data-testid="program-save"]').trigger('click')
			expect(setValueSubmit).toHaveBeenCalledTimes(1)
			const payload = setValueSubmit.mock.calls[0][0]
			expect(payload.name).toBe('data-science')
			expect(payload.program_courses).toEqual(COURSE_ROWS)
			expect(payload.program_members).toEqual(MEMBER_ROWS)
			expect(payload.published).toBe(true)
		})

		it('offers Delete only for a real program', async () => {
			const { wrapper } = await deepLink('data-science')
			await wrapper.find('[data-testid="program-delete"]').trigger('click')
			expect($dialog).toHaveBeenCalledTimes(1)
		})
	})
})
