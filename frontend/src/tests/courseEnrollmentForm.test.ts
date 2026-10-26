import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import {
	createMemoryHistory,
	createRouter,
	RouterView,
	type HistoryState,
	type Router,
} from 'vue-router'
import { defineComponent, h, provide, reactive } from 'vue'

vi.stubGlobal('__', (text: string) => text)

const { createResourceMock, getCachedListResourceMock, toastMock } = vi.hoisted(
	() => ({
		createResourceMock: vi.fn(),
		getCachedListResourceMock: vi.fn(),
		toastMock: { success: vi.fn(), error: vi.fn() },
	})
)

vi.mock('frappe-ui', () => ({
	createResource: createResourceMock,
	getCachedListResource: getCachedListResourceMock,
	toast: toastMock,
}))

// The form stands in as a component that shows its props and can emit.
vi.mock('@/components/Enrollment/EnrollStudentsForm.vue', () => ({
	default: {
		name: 'EnrollStudentsForm',
		props: ['target', 'refusal', 'loading'],
		emits: ['close', 'enrolled'],
		template: `<div data-testid="enroll-form">{{ loading ? 'Loading...' : refusal }}</div>`,
	},
}))

import CourseEnrollmentForm from '@/pages/Forms/CourseEnrollmentForm.vue'

type CourseData = {
	name: string
	instructors: { username: string }[]
	paid_course?: number
	paid_certificate?: number
	price?: string
}

const courseResource = reactive<{
	data: CourseData | null
	loading: boolean
}>({ data: null, loading: false })

createResourceMock.mockImplementation(() => courseResource)

const optionsFor = (url: string): Record<string, unknown> =>
	(
		createResourceMock.mock.calls.find(
			(call) => (call[0] as { url: string }).url === url
		) as [Record<string, unknown>]
	)[0]

const reloadCourseDetails = vi.fn()

// CourseDetail hands its key-less course resource's reload down to the forms
// in its <router-view>; this stands in for it.
const CoursePage = defineComponent({
	setup() {
		provide('reloadCourseDetails', reloadCourseDetails)
		return () => h('div', ['COURSE', h(RouterView)])
	},
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

const moderator = {
	name: 'mod@example.com',
	username: 'mod',
	is_moderator: true,
}
const instructor = { name: 'teacher@example.com', username: 'teacher' }
const outsider = { name: 'someone@example.com', username: 'someone' }
// What get_course_details sends a non-staff caller: no `name`, which is the
// instructor's login email.
const publicInstructor = { username: 'teacher', full_name: 'Teacher' }

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

const form = (wrapper: ReturnType<typeof mount>) =>
	wrapper.findComponent({ name: 'EnrollStudentsForm' })

const course = (extra: Partial<CourseData> = {}): CourseData => ({
	name: 'COURSE-1',
	instructors: [publicInstructor],
	...extra,
})

describe('CourseEnrollmentForm as a route', () => {
	beforeEach(() => {
		courseResource.data = null
		courseResource.loading = false
		createResourceMock.mockClear()
		getCachedListResourceMock.mockReset()
		getCachedListResourceMock.mockReturnValue(null)
		toastMock.success.mockReset()
		reloadCourseDetails.mockReset()
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
		courseResource.data = course()
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router, outsider)

		expect(form(wrapper).props('refusal')).toContain('do not have permission')
	})

	it('refuses everyone on a read-only site', async () => {
		;(window as Window & { read_only_mode?: boolean }).read_only_mode = true
		courseResource.data = course()
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router)
		delete (window as Window & { read_only_mode?: boolean }).read_only_mode

		expect(form(wrapper).props('refusal')).toContain('read-only')
	})

	// The gate CourseDetail put on the Dashboard tab was moderator OR instructor,
	// and instructor-ness is only knowable from the fetched course.
	it('lets an instructor of the course through once the fetch lands', async () => {
		courseResource.data = course()
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router, instructor)

		expect(form(wrapper).props('refusal')).toBe('')
	})

	it('never matches a visitor with no username to an instructor row', async () => {
		courseResource.data = course({ instructors: [{ username: '' }] })
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router, { name: 'someone@example.com' })

		expect(form(wrapper).props('refusal')).toContain('do not have permission')
	})

	it('says so while the course it needs to judge that is still in flight', async () => {
		courseResource.loading = true
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router, instructor)

		expect(form(wrapper).props('loading')).toBe(true)
		expect(wrapper.html()).toContain('Loading...')
	})

	it('hands the form a course target with its paid kind and price', async () => {
		courseResource.data = course({ paid_certificate: 1, price: '₹999' })
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router)

		expect(form(wrapper).props('target')).toEqual({
			doctype: 'LMS Course',
			name: 'COURSE-1',
			paidKind: 'certificate',
			priceLabel: '₹999',
		})
	})

	it('hands the form no paid kind for a free course', async () => {
		courseResource.data = course()
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router)

		expect(form(wrapper).props('target')).toMatchObject({
			paidKind: null,
			priceLabel: null,
		})
	})

	it('survives enrolling with no dashboard list to reload', async () => {
		courseResource.data = course()
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router)

		form(wrapper).vm.$emit('enrolled', {
			added: ['a@x.com'],
			upgraded: [],
			errors: [],
		})
		await flushPromises()

		expect(getCachedListResourceMock).toHaveBeenCalledWith([
			'courseProgress',
			'COURSE-1',
		])
		expect(router.currentRoute.value.name).toBe('NewCourseEnrollment')
	})

	it('reloads the dashboard list on enrolled and stays open', async () => {
		const list = { reload: vi.fn() }
		getCachedListResourceMock.mockReturnValue(list)
		courseResource.data = course()
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router)

		form(wrapper).vm.$emit('enrolled', {
			added: ['a@x.com'],
			upgraded: [],
			errors: [],
		})
		await flushPromises()

		expect(list.reload).toHaveBeenCalledTimes(1)
		expect(router.currentRoute.value.name).toBe('NewCourseEnrollment')
	})

	// Regression from the bulk-enroll PR (feat/bulk-enroll): the page toasted on
	// top of the dialog's own outcome toast, so one enroll showed two.
	it('leaves the success toast to the dialog', async () => {
		courseResource.data = course()
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router)

		form(wrapper).vm.$emit('enrolled', {
			added: ['a@x.com'],
			upgraded: ['b@x.com'],
			errors: [],
		})
		await flushPromises()

		expect(toastMock.success).not.toHaveBeenCalled()
	})

	// Regression from the bulk-enroll PR (feat/bulk-enroll): the dashboard's
	// Enrolled stat stayed stale after enrolling until the page was reloaded.
	it('reloads the course details behind the Enrolled stat only when someone was added', async () => {
		courseResource.data = course()
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router)

		form(wrapper).vm.$emit('enrolled', {
			added: [],
			upgraded: ['a@x.com'],
			errors: [{ member: 'b@x.com', error: 'x' }],
		})
		await flushPromises()
		expect(reloadCourseDetails).not.toHaveBeenCalled()

		form(wrapper).vm.$emit('enrolled', {
			added: ['c@x.com'],
			upgraded: [],
			errors: [],
		})
		await flushPromises()
		expect(reloadCourseDetails).toHaveBeenCalledTimes(1)
	})

	it('returns to the tab and lesson it was opened from when the form closes', async () => {
		courseResource.data = course()
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

		form(wrapper).vm.$emit('close')
		await flushPromises()

		expect(router.currentRoute.value.name).toBe('CourseDetail')
		expect(router.currentRoute.value.hash).toBe(COURSE_TAB)
		expect(router.currentRoute.value.query.lesson).toBe('1-2')

		// One entry deep, not two: the form entry was consumed by the close.
		router.back()
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('CourseDetail')
	})
})
