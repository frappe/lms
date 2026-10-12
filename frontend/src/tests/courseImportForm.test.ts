import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import {
	createMemoryHistory,
	createRouter,
	RouterView,
	type Router,
} from 'vue-router'
import { defineComponent, h } from 'vue'
import { toast } from 'frappe-ui'

vi.stubGlobal('__', (text: string) => text)
enableAutoUnmount(afterEach)

// canCreateCourse() (utils/index.js:826) reads usersStore().userResource, not
// an injected user, so the permission gate is driven from here.
const { userResource } = vi.hoisted(() => ({
	userResource: { data: null as Record<string, unknown> | null },
}))

const { callMock, uploadMock } = vi.hoisted(() => {
	// @/utils pulls in plyr, which touches matchMedia at import time.
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
	return { callMock: vi.fn(), uploadMock: vi.fn() }
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

// frappe-ui's ESM build does not resolve under vitest, so every export the
// form and FormShell pull in is stubbed by hand.
vi.mock('frappe-ui', () => ({
	call: callMock,
	toast: { success: vi.fn(), error: vi.fn() },
	FileUploadHandler: class {
		on() {}
		upload(...args: unknown[]) {
			return uploadMock(...args)
		}
	},
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
}))

import CourseImportForm from '@/pages/Forms/CourseImportForm.vue'

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
					{ path: 'import', name: 'CourseImport', component: CourseImportForm },
				],
			},
			{
				path: '/courses/:courseName',
				name: 'CourseDetail',
				component: List,
			},
		],
	})

// Errors thrown inside an event handler are swallowed by Vue's
// callWithErrorHandling, so a click that blows up still looks like a passing
// test. Collect them and let the no-ZIP test assert on them — without this its
// "the endpoint was not called" assertion cannot fail: with the guard removed,
// reading zip.value.file_url throws BEFORE call() is reached, so the spy stays
// clean either way.
const handlerErrors: unknown[] = []

const mountForm = async (router: Router) => {
	handlerErrors.length = 0
	const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
		global: {
			plugins: [router],
			stubs: { teleport: true },
			mocks: { __: (text: string) => text },
			config: {
				errorHandler: (err: unknown) => {
					handlerErrors.push(err)
				},
			},
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

// Drives the real upload path: the hidden <input type="file"> the drop zone
// clicks through to. jsdom won't let `files` be assigned, so define it on the
// element and let the component's own @change handler read it off the event.
const attachZip = async (wrapper: {
	find: (s: string) => {
		element: HTMLInputElement
		trigger: (e: string) => any
	}
}) => {
	const input = wrapper.find('input[type="file"]')
	const file = new File(['zip-bytes'], 'course.zip', {
		type: 'application/zip',
	})
	Object.defineProperty(input.element, 'files', {
		value: [file],
		configurable: true,
	})
	await input.trigger('change')
	await flushPromises()
}

describe('CourseImportForm as a route', () => {
	beforeEach(() => {
		callMock.mockReset()
		uploadMock.mockReset()
		vi.mocked(toast.error).mockClear()
		uploadMock.mockResolvedValue({
			file_url: '/files/course.zip',
			file_name: 'course.zip',
			file_size: 2048,
		})
		userResource.data = { ...moderator }
		Object.defineProperty(window, 'innerWidth', {
			value: 1024,
			writable: true,
			configurable: true,
		})
	})

	it('mounts straight from the URL with no parent list', async () => {
		const router = makeRouter()
		await router.push({ name: 'CourseImport' })
		const wrapper = await mountForm(router)
		expect(wrapper.find('[data-testid="course-import-fields"]').exists()).toBe(
			true
		)
		expect(wrapper.html()).toContain('Import Course from ZIP')
	})

	it('refuses to render the form for a user who cannot create courses', async () => {
		userResource.data = { ...student }
		const router = makeRouter()
		await router.push({ name: 'CourseImport' })
		const wrapper = await mountForm(router)
		expect(wrapper.find('[data-testid="course-import-fields"]').exists()).toBe(
			false
		)
		expect(wrapper.find('[data-testid="course-import-submit"]').exists()).toBe(
			false
		)
		expect(wrapper.html()).toContain('not permitted')
	})

	it('does not call the import endpoint before a ZIP has been uploaded', async () => {
		const router = makeRouter()
		await router.push({ name: 'CourseImport' })
		const wrapper = await mountForm(router)

		await wrapper.find('[data-testid="course-import-submit"]').trigger('click')
		expect(callMock).not.toHaveBeenCalled()
		// The guard has to be what stopped it, not a TypeError on the way to it.
		expect(handlerErrors).toEqual([])
	})

	it('sends the uploaded file path to the import endpoint', async () => {
		callMock.mockResolvedValue('imported-course')
		const router = makeRouter()
		await router.push({ name: 'CourseImport' })
		const wrapper = await mountForm(router)

		await attachZip(wrapper)
		expect(wrapper.html()).toContain('course.zip')

		await wrapper.find('[data-testid="course-import-submit"]').trigger('click')
		expect(callMock).toHaveBeenCalledWith(
			'lms.lms.api.import_course_from_zip',
			{
				zip_file_path: '/files/course.zip',
			}
		)
	})

	// Both cases build the error the way call() does: `message` is
	// "<method> <exc_type>" and the server's own text lives in `messages` — which
	// call() never leaves empty, substituting 'Internal Server Error' when the
	// response carried nothing.
	const importError = (messages: string[]) => {
		const error: Error & { messages: string[] } = Object.assign(
			new Error('lms.lms.api.import_course_from_zip ValidationError'),
			{ messages }
		)
		return error
	}

	const rejectImportWith = async (messages: string[]) => {
		callMock.mockRejectedValue(importError(messages))
		const router = makeRouter()
		await router.push({ name: 'CourseImport' })
		const wrapper = await mountForm(router)

		await attachZip(wrapper)
		await wrapper.find('[data-testid="course-import-submit"]').trigger('click')
		await flushPromises()
	}

	it('reports the server message when the import is rejected', async () => {
		// Reporting error.message alone told the user
		// "...import_course_from_zip ValidationError" and dropped the reason.
		await rejectImportWith(['Invalid course ZIP: Missing course.json'])

		expect(toast.error).toHaveBeenCalledWith('Invalid course ZIP: Missing course.json')
	})

	it('falls back to the raw error when the server sent no message', async () => {
		// call()'s placeholder is not a message anyone can act on, so it must not
		// win over the fallback — which still names the method and exception.
		await rejectImportWith(['Internal Server Error'])

		expect(toast.error).toHaveBeenCalledWith(
			'Error importing course: lms.lms.api.import_course_from_zip ValidationError'
		)
	})

	it('replaces rather than pushes on import, so Back reaches the list', async () => {
		callMock.mockResolvedValue('imported-course')
		const router = makeRouter()
		await router.push({ name: 'Courses' })
		await router.push({ name: 'CourseImport', state: { lmsFormEntry: true } })
		const wrapper = await mountForm(router)

		await attachZip(wrapper)
		await wrapper.find('[data-testid="course-import-submit"]').trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('CourseDetail')
		expect(router.currentRoute.value.params.courseName).toBe('imported-course')

		router.back()
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('Courses')
	})

	it('mobile: the back control pops the router back to the list', async () => {
		const router = makeRouter()
		await router.push({ name: 'Courses' })
		await router.push({ name: 'CourseImport', state: { lmsFormEntry: true } })
		Object.defineProperty(window, 'innerWidth', {
			value: 390,
			writable: true,
			configurable: true,
		})
		const wrapper = await mountForm(router)

		await wrapper.find('[data-testid="form-shell-back"]').trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('Courses')
	})

	it('desktop: dismissing the Dialog (Escape/backdrop/X) pops the router', async () => {
		const router = makeRouter()
		await router.push({ name: 'Courses' })
		await router.push({ name: 'CourseImport', state: { lmsFormEntry: true } })
		const wrapper = await mountForm(router)

		await wrapper
			.findComponent({ name: 'Dialog' })
			.vm.$emit('update:open', false)
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('Courses')
	})

	it('renders at frappe-ui Dialog default size so desktop is unchanged', async () => {
		// The modal this replaced passed no `size`, i.e. frappe-ui's 'lg'
		// (Dialog.vue:260). FormShell defaults to '3xl', so dropping the explicit
		// size would silently widen the dialog by a lot.
		const router = makeRouter()
		await router.push({ name: 'CourseImport' })
		const wrapper = await mountForm(router)
		expect(wrapper.findComponent({ name: 'Dialog' }).props('size')).toBe('lg')
	})
})
