import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import type { CertificationInfo } from '@/types'

// LMS Student has no read permission on LMS Course, so this page has to get the
// title and the evaluator from the whitelisted endpoint. Reading them with
// frappe.client.get_value throws a PermissionError for the learner the page is
// for, `courses` stays empty, and no Schedule button is ever rendered.
const { createResourceMock, pushMock, callMock, toastMock } = vi.hoisted(() => {
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
	return {
		createResourceMock: vi.fn(),
		pushMock: vi.fn(),
		callMock: vi.fn(() => Promise.resolve({})),
		toastMock: { success: vi.fn(), error: vi.fn() },
	}
})

vi.mock('@/stores/session', () => ({ sessionStore: () => ({ brand: {} }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: pushMock }) }))
vi.mock('frappe-ui', () => ({
	createResource: createResourceMock,
	usePageMeta: vi.fn(),
	toast: toastMock,
	call: callMock,
}))
vi.mock('@/components/Layouts/pages/PageHeader.vue', () => ({
	default: { template: '<div><slot /></div>' },
}))
vi.mock('@/components/Layouts/pages/PageBody.vue', () => ({
	default: { template: '<div><slot /></div>' },
}))
vi.mock('@/components/UpcomingEvaluations.vue', () => ({
	default: {
		name: 'UpcomingEvaluations',
		props: ['courses', 'batch', 'endDate', 'forHome'],
		template: '<div />',
	},
}))

import CourseCertification from '@/pages/Courses/CourseCertification.vue'

type ResourceOptions = {
	url: string
	makeParams: () => { course: string }
	auto: boolean
	onSuccess: (data: CertificationInfo | null) => void
	onError: (error: unknown) => void
}

type MockResource = {
	data: CertificationInfo | null
	fetch: ReturnType<typeof vi.fn>
}

const COURSE = 'python-basics'

const ENROLLED: CertificationInfo = {
	title: 'Python Basics',
	evaluator: 'eval@example.com',
	membership: { purchased_certificate: 1 },
	certificate: null,
}

const CERTIFIED: CertificationInfo = {
	...ENROLLED,
	certificate: {
		name: 'CERT-0001',
		template: 'Default',
		issue_date: '2026-01-01',
	},
}

function mountPage({ signedIn = true }: { signedIn?: boolean } = {}) {
	const resource = reactive<MockResource>({ data: null, fetch: vi.fn() })
	let options: ResourceOptions | undefined
	createResourceMock.mockImplementation((given: ResourceOptions) => {
		options = given
		return resource
	})
	// Reactive, like the real $user: tests need to flip .data after mount, not
	// just at provide, since the route guard can resolve it after setup runs.
	const userResource = reactive<{ data: { name: string } | null }>({
		data: signedIn ? { name: 'learner@example.com' } : null,
	})
	const wrapper = mount(CourseCertification, {
		props: { courseName: COURSE },
		global: {
			provide: {
				$dayjs: () => ({ format: () => '01 Jan 2026' }),
				$user: userResource,
			},
			mocks: { __: (text: string) => text },
		},
	})
	return {
		wrapper,
		resource,
		userResource,
		options: () => options as ResourceOptions,
	}
}

const evaluations = (wrapper: ReturnType<typeof mountPage>['wrapper']) =>
	wrapper.findComponent({ name: 'UpcomingEvaluations' })

describe('CourseCertification', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('reads the course details from the whitelisted endpoint', () => {
		const { options } = mountPage()
		expect(options().url).toBe('lms.lms.api.get_certification_details')
		expect(options().makeParams()).toEqual({ course: COURSE })
	})

	it('never reads the course through frappe.client', () => {
		mountPage()
		expect(callMock).not.toHaveBeenCalled()
	})

	// Without this the suite passes against a page that fetches nothing and
	// renders blank forever, because every case below assigns data by hand.
	// auto stays false (frappe-ui only reads it once, at creation, and $user.data
	// may not have arrived yet) - the fetch is driven by watching $user.data instead.
	it('fetches on mount for a signed-in learner', () => {
		const { options, resource } = mountPage()
		expect(options().auto).toBe(false)
		expect(resource.fetch).toHaveBeenCalled()
	})

	// A watcher left running after firing once repeats certification.fetch()
	// (and its navigate/toast side effects) on the next unrelated user-resource
	// reload, which is why data-already-present-at-mount must never watch.
	it('does not keep watching once $user.data was already there at mount', async () => {
		const { resource, userResource } = mountPage()
		expect(resource.fetch).toHaveBeenCalledTimes(1)
		userResource.data = { name: 'someone-else@example.com' }
		await flushPromises()
		expect(resource.fetch).toHaveBeenCalledTimes(1)
	})

	it('does not fetch for a guest, whom the endpoint would reject', () => {
		const { resource } = mountPage({ signedIn: false })
		expect(resource.fetch).not.toHaveBeenCalled()
	})

	// The bug this regresses: auto is read once at setup, so $user.data
	// arriving after mount rather than before it used to lose the fetch.
	it('fetches once $user.data arrives after mount, not only if it was there at setup', async () => {
		const { resource, userResource } = mountPage({ signedIn: false })
		expect(resource.fetch).not.toHaveBeenCalled()
		userResource.data = { name: 'learner@example.com' }
		await flushPromises()
		expect(resource.fetch).toHaveBeenCalledTimes(1)
	})

	it('hands the evaluator it returns to the evaluation list', async () => {
		const { wrapper, resource } = mountPage()
		resource.data = ENROLLED
		await flushPromises()
		expect(evaluations(wrapper).props('courses')).toEqual([
			{ course: COURSE, title: 'Python Basics', evaluator: 'eval@example.com' },
		])
	})

	it('renders no evaluation list before the details arrive', () => {
		const { wrapper } = mountPage()
		expect(evaluations(wrapper).exists()).toBe(false)
	})

	// UpcomingEvaluations filters evaluator-less rows out of its own list, so the
	// row is still passed down; it is that component's call what to show.
	it('still lists a course whose evaluator is unset', async () => {
		const { wrapper, resource } = mountPage()
		resource.data = { ...ENROLLED, evaluator: null }
		await flushPromises()
		expect(evaluations(wrapper).props('courses')).toEqual([
			{ course: COURSE, title: 'Python Basics', evaluator: null },
		])
	})

	it('renders the certificate instead of the scheduler once one exists', async () => {
		const { wrapper, resource } = mountPage()
		resource.data = CERTIFIED
		await flushPromises()

		expect(wrapper.text()).toContain('Python Basics')
		expect(wrapper.text()).toContain('01 Jan 2026')
		expect(evaluations(wrapper).exists()).toBe(false)
	})

	it('sends a learner without a purchased certificate back to the course', () => {
		const { options } = mountPage()
		options().onSuccess({ membership: null })
		expect(pushMock).toHaveBeenCalledWith({
			name: 'CourseDetail',
			params: { courseName: COURSE },
		})
	})

	it('reports a failed load rather than rendering an empty page', () => {
		const { options } = mountPage()
		options().onError({ messages: ['No permission for LMS Course'] })
		expect(toastMock.error).toHaveBeenCalledWith('No permission for LMS Course')
	})
})
