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

// frappe's translation layer patches String.prototype.format onto the page at
// runtime; the page title and the course-count line use it. Same shim as
// assignmentsCount.test.ts.
String.prototype.format = function (this: string, ...args: unknown[]): string {
	return this.replace(/{(\d+)}/g, (match, index) =>
		args[Number(index)] === undefined ? match : String(args[Number(index)])
	)
}

const { programResource, createResourceMock, enrollSubmit, toastSuccess } =
	vi.hoisted(() => {
		window.matchMedia ??= (() => ({
			matches: false,
			addEventListener: () => {},
			removeEventListener: () => {},
		})) as unknown as typeof window.matchMedia
		return {
			programResource: {
				data: null as Record<string, unknown> | null,
				error: null as { messages?: string[] } | null,
				loading: false,
				fetch: vi.fn(),
			},
			createResourceMock: vi.fn(),
			enrollSubmit: vi.fn(),
			toastSuccess: vi.fn(),
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

vi.mock('frappe-ui', () => ({
	createResource: createResourceMock,
	toast: { success: toastSuccess, error: vi.fn() },
	Dialog: {
		name: 'Dialog',
		props: ['open', 'title', 'size'],
		emits: ['update:open'],
		template: `<div v-if="open" role="dialog"><slot name="title" /><slot /><slot name="actions" /></div>`,
	},
	Button: {
		inheritAttrs: false,
		template: `<button v-bind="$attrs"><slot /></button>`,
	},
	Tooltip: { inheritAttrs: false, template: `<div><slot /></div>` },
}))

import ProgramEnrollment from '@/pages/Programs/ProgramEnrollment.vue'

const PROGRAM_URL = 'lms.lms.utils.get_program_details'
const ENROLL_URL = 'lms.lms.utils.enroll_in_program'

const Detail = defineComponent({ render: () => h('div', 'PROGRAM DETAIL') })

// Window carries no read_only_mode declaration; same cast the page itself uses.
const setReadOnly = (value: boolean): void => {
	;(window as Window & { read_only_mode?: boolean }).read_only_mode = value
}

// Mirrors the real table's shape: the enrollment page is a CHILD of the list,
// and the student-facing detail page is a separate top-level route.
const makeRouter = (): Router =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: '/programs',
				name: 'Programs',
				component: defineComponent({
					render: () => h('div', ['PROGRAM LIST', h(RouterView)]),
				}),
				children: [
					{
						path: ':programName/enroll',
						name: 'ProgramEnrollment',
						component: ProgramEnrollment,
						props: true,
					},
				],
			},
			{
				path: '/programs/:programName',
				name: 'ProgramDetail',
				component: Detail,
				props: true,
			},
		],
	})

const student = { name: 'student@example.com', is_student: true }

const mountPage = async (
	router: Router,
	user: Record<string, unknown> | null
) => {
	const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
		global: {
			plugins: [router],
			provide: { $user: { data: user } },
			stubs: { teleport: true, UserAvatar: true },
			mocks: { __: (text: string) => text },
		},
	})
	await flushPromises()
	return wrapper
}

const programData = {
	name: 'data-science',
	enforce_course_order: 1,
	courses: [
		{
			name: 'C1',
			title: 'Intro to Pandas',
			lessons: 4,
			enrollments: 12,
			instructors: [{ full_name: 'Ada Lovelace' }],
		},
	],
}

describe('the program enrollment page', () => {
	beforeEach(() => {
		programResource.data = programData
		programResource.error = null
		programResource.fetch.mockReset()
		enrollSubmit.mockReset()
		toastSuccess.mockReset()
		createResourceMock.mockReset()
		createResourceMock.mockImplementation((options: { url: string }) => {
			if (options.url === PROGRAM_URL)
				return Object.assign(programResource, {
					makeParams: options.makeParams,
				})
			if (options.url === ENROLL_URL)
				return {
					submit: enrollSubmit,
					loading: false,
					makeParams: options.makeParams,
				}
			return { submit: vi.fn(), loading: false }
		})
		setReadOnly(false)
		Object.defineProperty(window, 'innerWidth', {
			value: 1024,
			writable: true,
			configurable: true,
		})
	})

	it('mounts straight from the URL with no list page mounted', async () => {
		// The cold deep link: nothing above this page ever ran, so the summary it
		// used to receive through a parent's open-the-dialog click has to come
		// from its own fetch, keyed off the route param.
		const router = makeRouter()
		await router.push('/programs/data-science/enroll')
		const wrapper = await mountPage(router, student)

		expect(
			wrapper.find('[data-testid="program-enrollment-summary"]').exists()
		).toBe(true)
		expect(wrapper.html()).toContain('Intro to Pandas')
		expect(programResource.fetch).toHaveBeenCalledTimes(1)
		const programCall = createResourceMock.mock.calls.find(
			(call) => call[0].url === PROGRAM_URL
		)
		expect(programCall?.[0].makeParams()).toEqual({
			program_name: 'data-science',
		})
	})

	it('refuses a signed-out visitor rather than offering to enroll them', async () => {
		// enroll_in_program has no guest check of its own, so a guest reaching
		// this URL is exactly the case a button-shaped entry point never had.
		const router = makeRouter()
		await router.push('/programs/data-science/enroll')
		const wrapper = await mountPage(router, null)

		expect(
			wrapper.find('[data-testid="program-enrollment-summary"]').exists()
		).toBe(false)
		expect(
			wrapper.find('[data-testid="program-enrollment-confirm"]').exists()
		).toBe(false)
		expect(wrapper.html()).toContain('log in')
	})

	it('refuses in read-only mode', async () => {
		setReadOnly(true)
		const router = makeRouter()
		await router.push('/programs/data-science/enroll')
		const wrapper = await mountPage(router, student)

		expect(
			wrapper.find('[data-testid="program-enrollment-confirm"]').exists()
		).toBe(false)
		expect(wrapper.html()).toContain('read-only')
	})

	it("surfaces the fetch's own refusal for a program the viewer may not see", async () => {
		// get_program_details throws for an unpublished program the viewer is not
		// a member of. That throw IS the gate a URL newly exposes.
		programResource.data = null
		programResource.error = {
			messages: ['You are not authorized to view the details of this program.'],
		}
		const router = makeRouter()
		await router.push('/programs/secret/enroll')
		const wrapper = await mountPage(router, student)

		expect(
			wrapper.find('[data-testid="program-enrollment-confirm"]').exists()
		).toBe(false)
		expect(wrapper.html()).toContain('not authorized')
	})

	it('enrolls in the program named by the URL', async () => {
		const router = makeRouter()
		await router.push('/programs/data-science/enroll')
		const wrapper = await mountPage(router, student)
		await wrapper
			.find('[data-testid="program-enrollment-confirm"]')
			.trigger('click')

		expect(enrollSubmit).toHaveBeenCalledTimes(1)
		const enrollCall = createResourceMock.mock.calls.find(
			(call) => call[0].url === ENROLL_URL
		)
		expect(enrollCall?.[0].makeParams()).toEqual({ program: 'data-science' })
	})

	it('replaces its own entry when moving on to the program', async () => {
		// A push would leave Back landing on a confirmation page for a program the
		// student has already joined.
		const router = makeRouter()
		await router.push('/programs')
		await router.push({
			name: 'ProgramEnrollment',
			params: { programName: 'data-science' },
			state: { lmsFormEntry: true },
		})
		const wrapper = await mountPage(router, student)
		enrollSubmit.mockImplementation(
			(_values: unknown, options: { onSuccess: () => void }) =>
				options.onSuccess()
		)
		await wrapper
			.find('[data-testid="program-enrollment-confirm"]')
			.trigger('click')
		await flushPromises()

		expect(router.currentRoute.value.name).toBe('ProgramDetail')
		expect(router.currentRoute.value.params.programName).toBe('data-science')

		router.back()
		await flushPromises()
		expect(router.currentRoute.value.fullPath).toBe('/programs')
	})

	it('cancelling pops back to the list that opened it', async () => {
		const router = makeRouter()
		await router.push('/programs')
		await router.push({
			name: 'ProgramEnrollment',
			params: { programName: 'data-science' },
			state: { lmsFormEntry: true },
		})
		const wrapper = await mountPage(router, student)
		await wrapper
			.findComponent({ name: 'Dialog' })
			.vm.$emit('update:open', false)
		await flushPromises()

		expect(router.currentRoute.value.fullPath).toBe('/programs')
	})

	it('cancelling a DEEP-LINKED page replaces to the list', async () => {
		const router = makeRouter()
		await router.push('/programs/data-science/enroll')
		const wrapper = await mountPage(router, student)
		await wrapper
			.findComponent({ name: 'Dialog' })
			.vm.$emit('update:open', false)
		await flushPromises()

		expect(router.currentRoute.value.name).toBe('Programs')
	})
})
