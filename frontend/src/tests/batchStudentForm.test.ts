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

// frappe-ui's internal module resolution doesn't work under vitest (see
// chapterForm.test.ts), so every export the form and FormShell pull in has to
// be stubbed by hand.
const {
	createResourceMock,
	getCachedListResourceMock,
	getCachedResourceMock,
	openSettingsMock,
	updateOnboardingStepMock,
	toastMock,
} = vi.hoisted(() => {
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
	return {
		createResourceMock: vi.fn(),
		getCachedListResourceMock: vi.fn(),
		getCachedResourceMock: vi.fn(),
		openSettingsMock: vi.fn(),
		updateOnboardingStepMock: vi.fn(),
		toastMock: { success: vi.fn(), error: vi.fn() },
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
	getCachedResource: getCachedResourceMock,
	toast: toastMock,
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

vi.mock('frappe-ui/frappe', () => ({
	useOnboarding: () => ({ updateOnboardingStep: updateOnboardingStepMock }),
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

// @ts-expect-error a JS SFC has no generated types (TS7016) — the same gap
// every test importing a non-`lang="ts"` component in this suite hits.
import BatchStudentForm from '@/pages/Forms/BatchStudentForm.vue'

const enrollment = reactive({ loading: false, submit: vi.fn() })
createResourceMock.mockImplementation(() => enrollment)

const insertOptions = (): Record<string, unknown> =>
	(
		createResourceMock.mock.calls.find(
			(call) => (call[0] as { url: string }).url === 'frappe.client.insert'
		) as [Record<string, unknown>]
	)[0]

// The parent page is a route component too, so it has to render a nested
// RouterView or the child never mounts.
const BatchPage = defineComponent({
	render: () => h('div', ['BATCH', h(RouterView)]),
})

// BatchDetail hands its children a way to refetch get_batch_details; a page
// that does not (a deep link renders one that does, so this stands for the
// stubs above rather than for real life) leaves the inject at its default.
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
			// vi.stubGlobal alone doesn't reach a compiled template's `_ctx.__`
			// access — it has to be on the instance too (see FormShell.test.ts).
			mocks: { __: (text: string) => text },
		},
	})
	await flushPromises()
	return wrapper
}

const fields = (wrapper: ReturnType<typeof mount>) =>
	wrapper.find('[data-testid="batch-student-fields"]')

const save = (wrapper: ReturnType<typeof mount>) =>
	wrapper.find('[data-testid="batch-student-save"]')

const pickStudent = (wrapper: ReturnType<typeof mount>) =>
	wrapper
		.find('[data-testid="link-User"] input')
		.setValue('student@example.com')

const succeedOnSubmit = () => {
	enrollment.submit.mockImplementation(
		(_params: unknown, options: { onSuccess: () => void }) => {
			options.onSuccess()
		}
	)
}

describe('BatchStudentForm as a route', () => {
	beforeEach(() => {
		enrollment.submit.mockReset()
		enrollment.loading = false
		createResourceMock.mockClear()
		getCachedListResourceMock.mockReset()
		getCachedListResourceMock.mockReturnValue(null)
		getCachedResourceMock.mockReset()
		getCachedResourceMock.mockReturnValue(null)
		openSettingsMock.mockReset()
		// openSettings reports whether the dialog is actually mounted; the form
		// only leaves for it when it is. Desktop is the default here.
		openSettingsMock.mockReturnValue(true)
		updateOnboardingStepMock.mockReset()
		toastMock.success.mockReset()
		toastMock.error.mockReset()
		delete (window as Window & { read_only_mode?: boolean }).read_only_mode
		Object.defineProperty(window, 'innerWidth', {
			value: 1024,
			writable: true,
			configurable: true,
		})
	})

	// The whole point of the conversion: no AdminBatchDashboard tab is mounted,
	// so there is no parent to hand this page a batch or a student list.
	it('mounts straight from the URL with no parent dashboard mounted', async () => {
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router)

		expect(wrapper.text()).toContain('BATCH')
		expect(fields(wrapper).exists()).toBe(true)
		expect(wrapper.html()).toContain('Enroll a Student')
	})

	it('refuses a visitor who is neither moderator nor evaluator', async () => {
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router, outsider)

		expect(fields(wrapper).exists()).toBe(false)
		expect(save(wrapper).exists()).toBe(false)
		expect(wrapper.html()).toContain('do not have permission')
	})

	// BatchDetail's isAdmin() was moderator OR evaluator, both from $user alone —
	// which is why this page needs no batch fetch to judge the visitor.
	it('lets a batch evaluator through', async () => {
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router, evaluator)

		expect(fields(wrapper).exists()).toBe(true)
	})

	it('refuses everyone on a read-only site', async () => {
		;(window as Window & { read_only_mode?: boolean }).read_only_mode = true
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router)

		expect(fields(wrapper).exists()).toBe(false)
		expect(wrapper.html()).toContain('read-only')
	})

	it('will not submit an empty student', async () => {
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router)

		await save(wrapper).trigger('click')
		expect(enrollment.submit).not.toHaveBeenCalled()
	})

	it('inserts through its own resource, against the routed batch', async () => {
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router)
		await pickStudent(wrapper)

		await save(wrapper).trigger('click')
		expect(enrollment.submit).toHaveBeenCalledTimes(1)
		expect((insertOptions().makeParams as () => unknown)()).toEqual({
			doc: {
				doctype: 'LMS Batch Enrollment',
				member: 'student@example.com',
				payment: null,
				batch: 'B1',
			},
		})
	})

	it('survives a save with no dashboard tab to refresh', async () => {
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router)
		await pickStudent(wrapper)
		succeedOnSubmit()

		await save(wrapper).trigger('click')
		await flushPromises()

		expect(getCachedListResourceMock).toHaveBeenCalledWith([
			'batchStudents',
			'B1',
		])
		expect(getCachedResourceMock).toHaveBeenCalledWith([
			'batch_student_count',
			'B1',
		])
		expect(router.currentRoute.value.name).toBe('BatchDetail')
	})

	// Seats Left on the Overview overlay is get_batch_details', and an enrollment
	// is exactly what moves it. That resource carries no cache key, so unlike the
	// two above it cannot be reached by one — the page provides the reload.
	it('asks the batch page to refetch its details', async () => {
		const reloadBatchDetails = vi.fn()
		const router = makeRouter(providingBatchPage(reloadBatchDetails))
		await openForm(router)
		const wrapper = await mountForm(router)
		await pickStudent(wrapper)
		succeedOnSubmit()

		await save(wrapper).trigger('click')
		await flushPromises()

		expect(reloadBatchDetails).toHaveBeenCalledTimes(1)
	})

	it('does not refetch the details when the enrollment fails', async () => {
		const reloadBatchDetails = vi.fn()
		const router = makeRouter(providingBatchPage(reloadBatchDetails))
		await openForm(router)
		const wrapper = await mountForm(router)
		await pickStudent(wrapper)
		enrollment.submit.mockImplementation(
			(_params: unknown, options: { onError: (err: unknown) => void }) => {
				options.onError({ messages: ['nope'] })
			}
		)

		await save(wrapper).trigger('click')
		await flushPromises()

		expect(reloadBatchDetails).not.toHaveBeenCalled()
	})

	// The count stands in for the modal's props.batch.reload(): get_batch_details
	// carries no cache key, so the Enrolled card had to become reachable by one.
	it('reloads both the student list and the Enrolled count when mounted', async () => {
		const list = { reload: vi.fn() }
		const count = { reload: vi.fn() }
		getCachedListResourceMock.mockReturnValue(list)
		getCachedResourceMock.mockReturnValue(count)
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router)
		await pickStudent(wrapper)
		succeedOnSubmit()

		await save(wrapper).trigger('click')
		await flushPromises()

		expect(list.reload).toHaveBeenCalledTimes(1)
		expect(count.reload).toHaveBeenCalledTimes(1)
	})

	it('ticks the onboarding step only for a system manager', async () => {
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router, {
			...moderator,
			is_system_manager: true,
		})
		await pickStudent(wrapper)
		succeedOnSubmit()

		await save(wrapper).trigger('click')
		await flushPromises()

		expect(updateOnboardingStepMock).toHaveBeenCalledWith('add_batch_student')
	})

	it('leaves the onboarding step alone for a plain moderator', async () => {
		const router = makeRouter()
		await openForm(router)
		const wrapper = await mountForm(router)
		await pickStudent(wrapper)
		succeedOnSubmit()

		await save(wrapper).trigger('click')
		await flushPromises()

		expect(updateOnboardingStepMock).not.toHaveBeenCalled()
	})

	it('returns to the tab it was opened from', async () => {
		const router = makeRouter()
		await router.push({
			name: 'BatchDetail',
			params: { batchName: 'B1' },
			hash: BATCH_TAB,
		})
		await openForm(router, { lmsFormEntry: true })
		const wrapper = await mountForm(router)
		await pickStudent(wrapper)
		succeedOnSubmit()

		await save(wrapper).trigger('click')
		await flushPromises()

		expect(router.currentRoute.value.name).toBe('BatchDetail')
		expect(router.currentRoute.value.hash).toBe(BATCH_TAB)

		// One entry deep, not two: the form entry was consumed by the replace.
		router.back()
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('BatchDetail')
	})

	// Link hands its onCreate exactly one argument; a handler that expected a
	// second `close` callback threw on every click.
	it.each([
		['User', 'Members'],
		['LMS Payment', 'Transactions'],
	])('opens Settings from "Create New" on %s', async (doctype, tab) => {
		const router = makeRouter()
		await router.push({
			name: 'BatchDetail',
			params: { batchName: 'B1' },
			hash: BATCH_TAB,
		})
		await openForm(router, { lmsFormEntry: true })
		const wrapper = await mountForm(router)

		await wrapper.find(`[data-testid="create-${doctype}"]`).trigger('click')
		await flushPromises()

		expect(openSettingsMock).toHaveBeenCalledWith(tab)
		expect(router.currentRoute.value.name).toBe('BatchDetail')
	})

	// Settings is mounted only in the desktop sidebar. Closing the form for a
	// dialog that never appears threw away whatever the user had typed and left
	// them with no way to add the member they came for.
	it('stays put when Settings has nowhere to open', async () => {
		openSettingsMock.mockReturnValue(false)
		const router = makeRouter()
		await router.push({
			name: 'BatchDetail',
			params: { batchName: 'B1' },
			hash: BATCH_TAB,
		})
		await openForm(router, { lmsFormEntry: true })
		const wrapper = await mountForm(router)

		await wrapper.find('[data-testid="create-User"]').trigger('click')
		await flushPromises()

		expect(openSettingsMock).toHaveBeenCalledWith('Members')
		expect(router.currentRoute.value.name).toBe('NewBatchStudent')
	})

	it('mobile: the back control pops the router back to the batch', async () => {
		const router = makeRouter()
		await router.push({
			name: 'BatchDetail',
			params: { batchName: 'B1' },
			hash: BATCH_TAB,
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
		expect(router.currentRoute.value.name).toBe('BatchDetail')
	})
})
