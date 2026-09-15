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

// The form registers a window-level keydown listener and only removes it on
// unmount. Without this, wrappers left mounted by earlier tests keep listening
// and the Ctrl+S test sees one call per surviving instance.
enableAutoUnmount(afterEach)

const insertSubmit = vi.fn()
const listResource = {
	insert: { submit: insertSubmit, loading: false },
	data: [],
}
// A vi.fn (not a bare arrow) so a test can assert what it was called WITH —
// specifically the cache key, the single load-bearing reason a created course
// shows up in the list at all (Courses.vue:152 has to use the byte-identical
// key for createListResource's shared-instance cache to hand back the SAME
// resource). vi.hoisted because vi.mock's factory is hoisted above ALL
// top-level code, so a bare `vi.fn()` referenced inside it would throw
// "Cannot access before initialization".
const { createListResourceMock } = vi.hoisted(() => ({
	createListResourceMock: vi.fn(),
}))
createListResourceMock.mockReturnValue(listResource)

// canCreateCourse() (utils/index.js:826) reads usersStore().userResource, not
// the injected $user, so the permission gate is driven from here.
const { userResource } = vi.hoisted(() => ({
	userResource: { data: null as Record<string, unknown> | null },
}))

// frappe-ui's internal module resolution doesn't work under vitest (see
// NewMemberModal.test.ts, FormShell.test.ts), so importActual() on it throws
// ERR_MODULE_NOT_FOUND. Every export the form, FormShell and the Controls/*
// wrappers pull in has to be stubbed here by hand.
const { passthrough } = vi.hoisted(() => {
	// @/utils pulls in plyr, which touches matchMedia at import time. hoisted so
	// it lands before the (hoisted) component import runs.
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
	return {
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
vi.mock('@/stores/user', () => ({ usersStore: () => ({ userResource }) }))

vi.mock('frappe-ui', () => ({
	createListResource: createListResourceMock,
	createResource: () => ({ data: [], reload: vi.fn(), loading: false }),
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
		props: ['modelValue', 'label', 'type', 'required'],
		emits: ['update:modelValue'],
		template: `<label>{{ label }}<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" /></label>`,
	},
	FormLabel: {
		props: ['label', 'required', 'id'],
		template: `<label :for="id">{{ label }}</label>`,
	},
	// Uploader drives its whole body off this slot's props; a bare passthrough
	// would bind `undefined` to a @click and warn.
	FileUploader: {
		template: `<div><slot :uploading="false" :progress="0" :openFileSelector="() => {}" /></div>`,
	},
	Avatar: passthrough,
	Combobox: passthrough,
	MultiSelect: passthrough,
	Select: passthrough,
}))

vi.mock('frappe-ui/frappe', () => ({
	useTelemetry: () => ({ capture: vi.fn() }),
	useOnboarding: () => ({ updateOnboardingStep: vi.fn() }),
}))

// The rich text editor drags in ProseMirror; the form's behaviour under test
// does not involve it.
vi.mock('@/components/RichTextEditor.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))
vi.mock('@/components/Modals/NewMemberModal.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))

import NewCourseForm from '@/pages/Forms/NewCourseForm.vue'

// The list page hosts the form as a child route, so it has to render a nested
// RouterView — otherwise the child never mounts. RouterView is imported rather
// than written as the string 'router-view', which h() would leave as an
// unresolved custom element.
const List = defineComponent({
	render: () => h('div', ['LIST', h(RouterView)]),
})

const makeRouter = (): Router =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: '/courses',
				name: 'Courses',
				component: List,
				children: [
					{ path: 'new', name: 'NewCourse', component: NewCourseForm },
				],
			},
			{
				path: '/courses/:courseName',
				name: 'CourseDetail',
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
}

// Every field the course form is meant to collect. The form was converted from
// a modal by moving this grid wholesale, so pin the set: a field dropped in the
// move is otherwise invisible to the rest of the suite.
const FIELD_LABELS = [
	'Title',
	'Category',
	'Instructors',
	'Course thumbnail',
	'Short introduction',
	'Course description',
]

// Ctrl/Cmd+S is handled on window, but the handler ignores events whose target
// is not an HTMLElement — so this has to be dispatched from an element and
// allowed to bubble, or the test would pass without exercising the guard.
const pressCtrlS = (): void => {
	document.body.dispatchEvent(
		new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true })
	)
}

describe('NewCourseForm as a route', () => {
	beforeEach(() => {
		insertSubmit.mockReset()
		createListResourceMock.mockClear()
		userResource.data = { ...moderator }
		Object.defineProperty(window, 'innerWidth', {
			value: 1024,
			writable: true,
			configurable: true,
		})
	})

	it('mounts straight from the URL with no parent list', async () => {
		const router = makeRouter()
		await router.push({ name: 'NewCourse' })
		const wrapper = await mountForm(router, moderator)
		expect(wrapper.find('[data-testid="new-course-fields"]').exists()).toBe(
			true
		)
		expect(wrapper.html()).toContain('New Course')
	})

	it('refuses to render the form for a user who cannot create courses', async () => {
		userResource.data = { ...student }
		const router = makeRouter()
		await router.push({ name: 'NewCourse' })
		const wrapper = await mountForm(router, student)
		expect(wrapper.find('[data-testid="new-course-fields"]').exists()).toBe(
			false
		)
		expect(wrapper.html()).toContain('not permitted')
	})

	it('carries every field of the course form', async () => {
		const router = makeRouter()
		await router.push({ name: 'NewCourse' })
		const wrapper = await mountForm(router, moderator)

		const fields = wrapper.find('[data-testid="new-course-fields"]')
		expect(fields.exists()).toBe(true)
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
	})

	it('ignores Ctrl+S for a user who cannot create courses', async () => {
		const router = makeRouter()
		await router.push({ name: 'NewCourse' })

		// Control: the shortcut does reach saveCourse for a permitted user, so a
		// green refusal below cannot be the dispatch silently going nowhere.
		const permitted = await mountForm(router, moderator)
		pressCtrlS()
		expect(insertSubmit).toHaveBeenCalledTimes(1)
		permitted.unmount()

		insertSubmit.mockReset()
		userResource.data = { ...student }
		await mountForm(router, student)
		pressCtrlS()
		expect(insertSubmit).not.toHaveBeenCalled()
	})

	it('inserts through its own resource, not a parent-supplied one', async () => {
		const router = makeRouter()
		await router.push({ name: 'NewCourse' })
		const wrapper = await mountForm(router, moderator)

		await wrapper.find('[data-testid="new-course-save"]').trigger('click')
		expect(insertSubmit).toHaveBeenCalledTimes(1)
	})

	it('scopes its list resource to the SAME cache key Courses.vue uses', async () => {
		// The design doc (C4) records this as the single load-bearing reason a
		// created course appears in the list at all: createListResource hands
		// back whichever instance was cached first under this key, so if this key
		// ever drifts from Courses.vue:152's, a save silently stops showing up in
		// the list with no test failing — until now.
		const router = makeRouter()
		await router.push({ name: 'NewCourse' })
		await mountForm(router, moderator)

		expect(createListResourceMock).toHaveBeenCalledWith(
			expect.objectContaining({ cache: ['courses', 'mod@example.com'] })
		)
	})

	it('mobile: the back control pops the router back to the list', async () => {
		const router = makeRouter()
		await router.push({ name: 'Courses' })
		await router.push({ name: 'NewCourse', state: { lmsFormEntry: true } })
		Object.defineProperty(window, 'innerWidth', {
			value: 390,
			writable: true,
			configurable: true,
		})
		const wrapper = await mountForm(router, moderator)

		await wrapper.find('[data-testid="form-shell-back"]').trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('Courses')
	})

	it('desktop: dismissing the Dialog (Escape/backdrop/X) pops the router', async () => {
		const router = makeRouter()
		await router.push({ name: 'Courses' })
		await router.push({ name: 'NewCourse', state: { lmsFormEntry: true } })
		const wrapper = await mountForm(router, moderator)

		await wrapper
			.findComponent({ name: 'Dialog' })
			.vm.$emit('update:open', false)
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('Courses')
	})

	it('replaces rather than pushes on save, so Back reaches the list', async () => {
		const router = makeRouter()
		await router.push({ name: 'Courses' })
		await router.push({ name: 'NewCourse', state: { lmsFormEntry: true } })
		const wrapper = await mountForm(router, moderator)

		insertSubmit.mockImplementation(
			(_doc: unknown, options: { onSuccess: (d: unknown) => void }) => {
				options.onSuccess({ name: 'COURSE-0001' })
			}
		)
		await wrapper.find('[data-testid="new-course-save"]').trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('CourseDetail')

		router.back()
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('Courses')
	})
})
