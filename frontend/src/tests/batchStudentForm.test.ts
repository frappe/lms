import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import {
	createMemoryHistory,
	createRouter,
	RouterView,
	type HistoryState,
	type Router,
} from 'vue-router'
import { defineComponent, h, provide, reactive } from 'vue'

vi.stubGlobal('__', (text: string) => text)
enableAutoUnmount(afterEach)

const {
	createResourceMock,
	getCachedListResourceMock,
	getCachedResourceMock,
	updateOnboardingStepMock,
	toastMock,
} = vi.hoisted(() => ({
	createResourceMock: vi.fn(),
	getCachedListResourceMock: vi.fn(),
	getCachedResourceMock: vi.fn(),
	updateOnboardingStepMock: vi.fn(),
	toastMock: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('frappe-ui', () => ({
	createResource: createResourceMock,
	getCachedListResource: getCachedListResourceMock,
	getCachedResource: getCachedResourceMock,
	toast: toastMock,
}))

vi.mock(
	'@framework/ui/components/Onboarding/index',
	async (importOriginal) => ({
		...(await importOriginal<
			typeof import('@framework/ui/components/Onboarding/index')
		>()),
		useOnboarding: () => ({ updateOnboardingStep: updateOnboardingStepMock }),
	})
)

// The form stands in as a component that shows its props and can emit.
vi.mock('@/components/Enrollment/EnrollStudentsForm.vue', () => ({
	default: {
		name: 'EnrollStudentsForm',
		props: ['target', 'refusal', 'loading'],
		emits: ['close', 'enrolled'],
		template: `<div data-testid="enroll-form">{{ loading ? 'Loading...' : refusal }}</div>`,
	},
}))

import BatchStudentForm from '@/pages/Forms/BatchStudentForm.vue'

type BatchData = {
	name: string
	can_manage?: boolean
	paid_batch?: number
	price?: string
}

const batchResource = reactive<{
	data: BatchData | null
	loading: boolean
	reload: () => void
}>({ data: null, loading: false, reload: vi.fn() })
createResourceMock.mockImplementation(() => batchResource)

const BatchPage = defineComponent({
	render: () => h('div', ['BATCH', h(RouterView)]),
})

// BatchDetail hands its children a way to refetch get_batch_details; a page
// that does not leaves the inject at its default.
const providingBatchPage = (reload: () => void) =>
	defineComponent({
		setup() {
			provide('reloadBatchDetails', reload)
			return () => h('div', ['BATCH', h(RouterView)])
		},
	})

const makeRouter = (parent = BatchPage): Router =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: '/batches/:batchName',
				name: 'BatchDetail',
				component: parent,
				props: true,
				children: [
					{
						path: 'student/new',
						name: 'NewBatchStudent',
						component: BatchStudentForm,
						props: true,
					},
				],
			},
		],
	})

const moderator = { name: 'mod@example.com', is_moderator: true }
const evaluator = { name: 'eval@example.com', is_evaluator: true }
const outsider = { name: 'someone@example.com' }

// TabbedDetailPage hashes the tab KEY, and the Enroll button only exists on the
// dashboard tab.
const BATCH_TAB = '#dashboard'

const openForm = (router: Router, state?: HistoryState) =>
	router.push({
		name: 'NewBatchStudent',
		params: { batchName: 'B1' },
		hash: BATCH_TAB,
		state,
	})

const mountForm = async (
	router: Router,
	user: Record<string, unknown> | null = moderator
) => {
	const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
		global: {
			plugins: [router],
			provide: { $user: { data: user } },
			stubs: { teleport: true },
			mocks: { __: (text: string) => text },
		},
	})
	await flushPromises()
	return wrapper
}

const form = (wrapper: ReturnType<typeof mount>) =>
	wrapper.findComponent({ name: 'EnrollStudentsForm' })

const enrolled = (
	wrapper: ReturnType<typeof mount>,
	added: string[] = ['a@x.com']
) => {
	form(wrapper).vm.$emit('enrolled', { added, upgraded: [], errors: [] })
	return flushPromises()
}

describe('BatchStudentForm as a route', () => {
	beforeEach(() => {
		batchResource.data = { name: 'B1' }
		batchResource.loading = false
		createResourceMock.mockClear()
		getCachedListResourceMock.mockReset()
		getCachedListResourceMock.mockReturnValue(null)
		getCachedResourceMock.mockReset()
		getCachedResourceMock.mockReturnValue(null)
		updateOnboardingStepMock.mockReset()
		toastMock.success.mockReset()
		delete (window as Window & { read_only_mode?: boolean }).read_only_mode
	})

	it('refuses a visitor who is neither moderator nor evaluator', async () => {
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router, outsider)

		expect(form(wrapper).props('refusal')).toContain('do not have permission')
	})

	// BatchDetail's isAdmin() was moderator OR evaluator, both from $user alone.
	it('lets a batch evaluator through', async () => {
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router, evaluator)

		expect(form(wrapper).props('refusal')).toBe('')
	})

	it('lets someone tagged on this batch through', async () => {
		batchResource.data = { name: 'B1', can_manage: true }
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router, outsider)

		expect(form(wrapper).props('refusal')).toBe('')
	})

	it('refuses everyone on a read-only site', async () => {
		;(window as Window & { read_only_mode?: boolean }).read_only_mode = true
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router)

		expect(form(wrapper).props('refusal')).toContain('read-only')
	})

	it('hands the form a batch target with its paid kind and price', async () => {
		batchResource.data = {
			name: 'B1',
			can_manage: true,
			paid_batch: 1,
			price: '₹500',
		}
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router)

		expect(form(wrapper).props('target')).toEqual({
			doctype: 'LMS Batch',
			name: 'B1',
			paidKind: 'batch',
			priceLabel: '₹500',
		})
	})

	it('hands the form a batch target with no paid kind for an untagged evaluator', async () => {
		batchResource.data = {
			name: 'B1',
			can_manage: false,
			paid_batch: 1,
			price: '₹500',
		}
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router, evaluator)

		expect(form(wrapper).props('target')).toMatchObject({ paidKind: null })
	})

	it('survives enrolling with no dashboard tab to refresh', async () => {
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router)
		await enrolled(wrapper)

		expect(getCachedListResourceMock).toHaveBeenCalledWith([
			'batchStudents',
			'B1',
		])
		expect(getCachedResourceMock).toHaveBeenCalledWith([
			'batch_student_count',
			'B1',
		])
		expect(router.currentRoute.value.name).toBe('NewBatchStudent')
	})

	// Seats Left on the Overview overlay is get_batch_details', and an enrollment
	// is exactly what moves it. That resource carries no cache key, so unlike the
	// two above it cannot be reached by one — the page provides the reload.
	it('asks the batch page to refetch its details', async () => {
		const reloadBatchDetails = vi.fn()
		const router = makeRouter(providingBatchPage(reloadBatchDetails))
		await openForm(router)
		const wrapper = await mountForm(router)
		await enrolled(wrapper)

		expect(reloadBatchDetails).toHaveBeenCalledTimes(1)
	})

	it('reloads the dashboard on enrolled and stays open', async () => {
		const list = { reload: vi.fn() }
		const count = { reload: vi.fn() }
		getCachedListResourceMock.mockReturnValue(list)
		getCachedResourceMock.mockReturnValue(count)
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router)
		await enrolled(wrapper)

		expect(list.reload).toHaveBeenCalledTimes(1)
		expect(count.reload).toHaveBeenCalledTimes(1)
		expect(router.currentRoute.value.name).toBe('NewBatchStudent')
	})

	it('ticks the onboarding step for a moderator', async () => {
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router)
		await enrolled(wrapper)

		expect(updateOnboardingStepMock).toHaveBeenCalledWith('add_batch_student')
		expect(toastMock.success).toHaveBeenCalledWith('Students enrolled')
	})

	it('ticks the onboarding step only when someone was added', async () => {
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router)
		await enrolled(wrapper, [])

		expect(updateOnboardingStepMock).not.toHaveBeenCalled()
		expect(toastMock.success).not.toHaveBeenCalled()
	})

	it('leaves the onboarding step alone for a user who does not see onboarding', async () => {
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router, evaluator)
		await enrolled(wrapper)

		expect(updateOnboardingStepMock).not.toHaveBeenCalled()
	})

	it('returns to the opening tab when the form closes', async () => {
		const router = makeRouter()
		await router.push({
			name: 'BatchDetail',
			params: { batchName: 'B1' },
			hash: BATCH_TAB,
		})
		await openForm(router, { lmsFormEntry: true })
		const wrapper = await mountForm(router)

		form(wrapper).vm.$emit('close')
		await flushPromises()

		expect(router.currentRoute.value.name).toBe('BatchDetail')
		expect(router.currentRoute.value.hash).toBe(BATCH_TAB)

		// One entry deep, not two: the form entry was consumed by the close.
		router.back()
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('BatchDetail')
	})
})
