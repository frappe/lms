import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import {
	createMemoryHistory,
	createRouter,
	RouterView,
	type HistoryState,
	type Router,
} from 'vue-router'
import { defineComponent, h, reactive } from 'vue'

vi.stubGlobal('__', (text: string) => text)

// frappe-ui's internal module resolution doesn't work under vitest (see
// chapterForm.test.ts), so every export the form and FormShell pull in has to be
// stubbed by hand.
const { createResourceMock, getCachedListResourceMock, openSettingsMock } =
	vi.hoisted(() => {
		window.matchMedia ??= (() => ({
			matches: false,
			addEventListener: () => {},
			removeEventListener: () => {},
		})) as unknown as typeof window.matchMedia
		return {
			createResourceMock: vi.fn(),
			getCachedListResourceMock: vi.fn(),
			openSettingsMock: vi.fn(),
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
	getCachedListResource: getCachedListResourceMock,
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
		props: ['modelValue', 'label', 'type'],
		emits: ['update:modelValue'],
		template: `<label>{{ label }}<input type="checkbox" :checked="modelValue" @change="$emit('update:modelValue', $event.target.checked)" /></label>`,
	},
}))

// @/utils is the barrel that pulls in plyr and the settings store; only
// openSettings is used here.
vi.mock('@/utils', () => ({ openSettings: openSettingsMock }))

// The stub calls onCreate the way the real Link does outside inlineCreate mode:
// with exactly ONE argument (see linkOnCreate.test.ts).
vi.mock('@/components/Controls/Link.vue', () => ({
	default: {
		props: [
			'modelValue',
			'doctype',
			'label',
			'required',
			'placeholder',
			'onCreate',
		],
		emits: ['update:modelValue'],
		template: `<label :data-testid="'link-' + doctype">{{ label }}
			<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />
			<button type="button" :data-testid="'create-' + doctype" @click="onCreate && onCreate(null)" />
		</label>`,
	},
}))

import CourseEnrollmentForm from '@/pages/Forms/CourseEnrollmentForm.vue'

const courseResource = reactive<{
	data: { name: string; instructors: { name: string }[] } | null
	loading: boolean
}>({ data: null, loading: false })
const enrollResource = reactive({ loading: false, submit: vi.fn() })

createResourceMock.mockImplementation((options: { url: string }) =>
	options.url === 'lms.lms.utils.get_course_details'
		? courseResource
		: enrollResource
)

const optionsFor = (url: string): Record<string, unknown> =>
	(
		createResourceMock.mock.calls.find(
			(call) => (call[0] as { url: string }).url === url
		) as [Record<string, unknown>]
	)[0]

// The parent page is a route component too, so it has to render a nested
// RouterView or the child never mounts.
const CoursePage = defineComponent({
	render: () => h('div', ['COURSE', h(RouterView)]),
})

const makeRouter = (): Router =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: '/courses/:courseName',
				name: 'CourseDetail',
				component: CoursePage,
				props: true,
				children: [
					{
						path: 'enrollment/new',
						name: 'NewCourseEnrollment',
						component: CourseEnrollmentForm,
						props: true,
					},
				],
			},
		],
	})

const moderator = { name: 'mod@example.com', is_moderator: true }
const instructor = { name: 'teacher@example.com' }
const outsider = { name: 'someone@example.com' }

// TabbedDetailPage hashes the tab KEY, and the Enroll button only exists on the
// dashboard tab.
const COURSE_TAB = '#dashboard'

const openForm = async (router: Router, state?: HistoryState) => {
	await router.push({
		name: 'NewCourseEnrollment',
		params: { courseName: 'COURSE-1' },
		hash: COURSE_TAB,
		state,
	})
}

const mountForm = async (
	router: Router,
	user: Record<string, unknown> | null = moderator
) => {
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

const fields = (wrapper: ReturnType<typeof mount>) =>
	wrapper.find('[data-testid="course-enrollment-fields"]')

const pickStudent = async (wrapper: ReturnType<typeof mount>) => {
	const input = wrapper.find('[data-testid="link-User"] input')
	await input.setValue('student@example.com')
}

describe('CourseEnrollmentForm as a route', () => {
	beforeEach(() => {
		courseResource.data = null
		courseResource.loading = false
		enrollResource.submit.mockReset()
		enrollResource.loading = false
		createResourceMock.mockClear()
		getCachedListResourceMock.mockReset()
		getCachedListResourceMock.mockReturnValue(null)
		openSettingsMock.mockReset()
		// openSettings reports whether the dialog is actually mounted; the form
		// only leaves for it when it is. Desktop is the default here.
		openSettingsMock.mockReturnValue(true)
		Object.defineProperty(window, 'innerWidth', {
			value: 1024,
			writable: true,
			configurable: true,
		})
	})

	// The whole point of the conversion: no CourseDashboard tab is mounted, so
	// there is no parent to hand this page a course or a student list.
	it('mounts straight from the URL with no parent dashboard mounted', async () => {
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router)

		expect(wrapper.text()).toContain('COURSE')
		expect(fields(wrapper).exists()).toBe(true)
		expect(wrapper.html()).toContain('Enroll a Student')
	})

	it('fetches the course itself, keyed off the route param', async () => {
		const router = makeRouter()
		await openForm(router)
		await mountForm(router)

		const options = optionsFor('lms.lms.utils.get_course_details')
		expect((options.makeParams as () => unknown)()).toEqual({
			course: 'COURSE-1',
		})
		// No cache key: CourseDetail's own resource deliberately has none, so
		// there is no shared instance to join, and adding one here would file
		// the next course's data under this one.
		expect(options.cache).toBeUndefined()
	})

	it('refuses a visitor who is neither moderator nor an instructor of it', async () => {
		courseResource.data = { name: 'COURSE-1', instructors: [instructor] }
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router, outsider)

		expect(fields(wrapper).exists()).toBe(false)
		expect(
			wrapper.find('[data-testid="course-enrollment-save"]').exists()
		).toBe(false)
		expect(wrapper.html()).toContain('do not have permission')
	})

	// The gate CourseDetail put on the Dashboard tab was moderator OR instructor,
	// and instructor-ness is only knowable from the fetched course.
	it('lets an instructor of the course through once the fetch lands', async () => {
		courseResource.data = { name: 'COURSE-1', instructors: [instructor] }
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router, instructor)

		expect(fields(wrapper).exists()).toBe(true)
	})

	it('says so while the course it needs to judge that is still in flight', async () => {
		courseResource.loading = true
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router, instructor)

		expect(wrapper.html()).toContain('Loading...')
		expect(fields(wrapper).exists()).toBe(false)
		expect(
			wrapper.find('[data-testid="course-enrollment-save"]').exists()
		).toBe(false)
	})

	it('will not submit an empty student', async () => {
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router)

		await wrapper
			.find('[data-testid="course-enrollment-save"]')
			.trigger('click')
		expect(enrollResource.submit).not.toHaveBeenCalled()
	})

	it('inserts through its own resource, against the routed course', async () => {
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router)
		await pickStudent(wrapper)

		await wrapper
			.find('[data-testid="course-enrollment-save"]')
			.trigger('click')
		expect(enrollResource.submit).toHaveBeenCalledTimes(1)
		expect(
			(
				optionsFor('frappe.client.insert').makeParams as () => { doc: unknown }
			)()
		).toEqual({
			doc: {
				doctype: 'LMS Enrollment',
				course: 'COURSE-1',
				member: 'student@example.com',
				payment: null,
				purchased_certificate: false,
			},
		})
	})

	it('survives a save with no dashboard list to reload', async () => {
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router)
		await pickStudent(wrapper)

		enrollResource.submit.mockImplementation(
			(_params: unknown, options: { onSuccess: () => void }) => {
				options.onSuccess()
			}
		)
		await wrapper
			.find('[data-testid="course-enrollment-save"]')
			.trigger('click')
		await flushPromises()

		expect(getCachedListResourceMock).toHaveBeenCalledWith([
			'courseProgress',
			'COURSE-1',
		])
		expect(router.currentRoute.value.name).toBe('CourseDetail')
	})

	it('reloads the dashboard list when that tab IS mounted behind it', async () => {
		const list = { reload: vi.fn() }
		getCachedListResourceMock.mockReturnValue(list)
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router)
		await pickStudent(wrapper)

		enrollResource.submit.mockImplementation(
			(_params: unknown, options: { onSuccess: () => void }) => {
				options.onSuccess()
			}
		)
		await wrapper
			.find('[data-testid="course-enrollment-save"]')
			.trigger('click')
		await flushPromises()

		expect(list.reload).toHaveBeenCalledTimes(1)
	})

	it('returns to the tab and lesson it was opened from', async () => {
		const router = makeRouter()
		await router.push({
			name: 'CourseDetail',
			params: { courseName: 'COURSE-1' },
			hash: COURSE_TAB,
			query: { lesson: '1-2' },
		})
		await router.push({
			name: 'NewCourseEnrollment',
			params: { courseName: 'COURSE-1' },
			hash: COURSE_TAB,
			query: { lesson: '1-2' },
			state: { lmsFormEntry: true },
		})
		const wrapper = await mountForm(router)
		await pickStudent(wrapper)

		enrollResource.submit.mockImplementation(
			(_params: unknown, options: { onSuccess: () => void }) => {
				options.onSuccess()
			}
		)
		await wrapper
			.find('[data-testid="course-enrollment-save"]')
			.trigger('click')
		await flushPromises()

		expect(router.currentRoute.value.name).toBe('CourseDetail')
		expect(router.currentRoute.value.hash).toBe(COURSE_TAB)
		expect(router.currentRoute.value.query.lesson).toBe('1-2')

		// One entry deep, not two: the form entry was consumed by the replace.
		router.back()
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('CourseDetail')
	})

	// Link hands its onCreate exactly one argument; a handler that expected a
	// second `close` callback threw on every click.
	it('opens Settings from "Create New" without a second callback', async () => {
		const router = makeRouter()
		await router.push({
			name: 'CourseDetail',
			params: { courseName: 'COURSE-1' },
			hash: COURSE_TAB,
		})
		await openForm(router, { lmsFormEntry: true })
		const wrapper = await mountForm(router)

		await wrapper.find('[data-testid="create-User"]').trigger('click')
		await flushPromises()

		expect(openSettingsMock).toHaveBeenCalledWith('Members')
		expect(router.currentRoute.value.name).toBe('CourseDetail')
	})

	// Settings is mounted only in the desktop sidebar. Closing the form for a
	// dialog that never appears threw away whatever the user had typed and left
	// them with no way to add the member they came for.
	it('stays put when Settings has nowhere to open', async () => {
		openSettingsMock.mockReturnValue(false)
		const router = makeRouter()
		await router.push({
			name: 'CourseDetail',
			params: { courseName: 'C1' },
		})
		await openForm(router, { lmsFormEntry: true })
		const wrapper = await mountForm(router)

		await wrapper.find('[data-testid="create-User"]').trigger('click')
		await flushPromises()

		expect(openSettingsMock).toHaveBeenCalledWith('Members')
		expect(router.currentRoute.value.name).toBe('NewCourseEnrollment')
	})

	it('mobile: the back control pops the router back to the course', async () => {
		const router = makeRouter()
		await router.push({
			name: 'CourseDetail',
			params: { courseName: 'COURSE-1' },
			hash: COURSE_TAB,
		})
		await openForm(router, { lmsFormEntry: true })
		Object.defineProperty(window, 'innerWidth', {
			value: 390,
			writable: true,
			configurable: true,
		})
		const wrapper = await mountForm(router)

		await wrapper.find('[data-testid="form-shell-back"]').trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('CourseDetail')
	})
})
