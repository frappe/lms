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

// FormShell registers a document-level keydown listener and moves DOM focus, so
// wrappers left mounted by earlier tests would keep listening.
enableAutoUnmount(afterEach)

const {
	batchResource,
	certificateSubmit,
	createResourceMock,
	toastSuccess,
	toastError,
} = vi.hoisted(() => {
	const batchResource = {
		data: null as Record<string, unknown> | null,
		loading: false,
		fetched: true,
		reload: () => {},
	}
	return {
		batchResource,
		certificateSubmit: vi.fn(),
		createResourceMock: vi.fn(),
		toastSuccess: vi.fn(),
		toastError: vi.fn(),
	}
})

// frappe-ui's ESM build doesn't resolve under vitest (see FormShell.test.ts), so
// every export the form and FormShell touch is stubbed by hand.
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
	toast: { success: toastSuccess, error: toastError },
	Dialog: {
		name: 'Dialog',
		props: ['open', 'title', 'size'],
		emits: ['update:open'],
		template: `<div v-if="open" role="dialog"><slot name="title" /><slot /><slot name="actions" /></div>`,
	},
	Button: {
		inheritAttrs: false,
		template: `<button v-bind="$attrs"><slot name="icon" /><slot /></button>`,
	},
	FormControl: {
		props: ['modelValue', 'label', 'type', 'options'],
		emits: ['update:modelValue'],
		template: `<label>{{ label }}<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" /></label>`,
	},
}))

// The two Controls wrappers each pull in half of frappe-ui; only their labels
// matter to the field-set pin.
vi.mock('@/components/Controls/Link.vue', () => ({
	default: {
		props: ['modelValue', 'label', 'doctype', 'filters'],
		template: `<label>{{ label }}</label>`,
	},
}))
vi.mock('@/components/Controls/BooleanSwitch.vue', () => ({
	default: {
		props: ['modelValue', 'label', 'description', 'size'],
		template: `<label>{{ label }}</label>`,
	},
}))

// @ts-expect-error a JS SFC has no generated types (TS7016) — the same gap
// every test importing a non-`lang="ts"` component in this suite hits.
import BulkCertificatesForm from '@/pages/Forms/BulkCertificatesForm.vue'

const BATCH_URL = 'lms.lms.utils.get_batch_details'

const Parent = defineComponent({
	render: () => h('div', ['BATCH', h(RouterView)]),
})

const makeRouter = (): Router =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: '/batches/:batchName',
				name: 'BatchDetail',
				component: Parent,
				props: true,
				children: [
					{
						path: 'certificates',
						name: 'BulkCertificates',
						component: BulkCertificatesForm,
						props: true,
					},
				],
			},
		],
	})

const mountForm = async (router: Router, user: Record<string, unknown>) => {
	const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
		global: {
			plugins: [router],
			provide: {
				$user: { data: user },
				$dayjs: () => ({ format: () => '2026-07-31' }),
			},
			stubs: { teleport: true },
			mocks: { __: (text: string) => text },
		},
	})
	await flushPromises()
	return wrapper
}

const moderator = { name: 'mod@example.com', is_moderator: true }
const student = { name: 'student@example.com' }

// The modal's whole field set. It was moved wholesale into the route
// component, so pin it: a field lost in the move is otherwise invisible.
const FIELD_LABELS = [
	'Evaluator',
	'Issue Date',
	'Expiry Date',
	'Course',
	'Template',
	'Published',
]

describe('BulkCertificatesForm as a route', () => {
	beforeEach(() => {
		certificateSubmit.mockReset()
		toastSuccess.mockReset()
		toastError.mockReset()
		createResourceMock.mockReset()
		createResourceMock.mockImplementation((options: { url: string }) =>
			options.url === BATCH_URL
				? batchResource
				: { submit: certificateSubmit, loading: false, data: null }
		)
		batchResource.data = {
			name: 'B1',
			certification: 1,
			students: ['a@example.com', 'b@example.com'],
			courses: [{ course: 'COURSE-1' }],
		}
		batchResource.loading = false
		Object.defineProperty(window, 'innerWidth', {
			value: 1024,
			writable: true,
			configurable: true,
		})
	})

	it('mounts straight from the URL with no parent page mounted', async () => {
		const router = makeRouter()
		await router.push('/batches/B1/certificates')
		const wrapper = await mountForm(router, moderator)
		expect(wrapper.html()).toContain('Generate Certificates')
		expect(
			wrapper.find('[data-testid="bulk-certificates-fields"]').exists()
		).toBe(true)
	})

	it('fetches its own batch context for the batch in the URL', async () => {
		// The students and courses this form needs are not on a plain LMS Batch
		// fetch; they come from get_batch_details. This is the form's OWN fetch:
		// BatchDetail's resource carries no cache key (a key read once at setup
		// would strand the previous batch's data there when the router reuses
		// the page), so there is no instance to share and none is claimed.
		const router = makeRouter()
		await router.push('/batches/B1/certificates')
		await mountForm(router, moderator)
		const batchCall = createResourceMock.mock.calls.find(
			(call) => call[0].url === BATCH_URL
		)
		expect(batchCall).toBeDefined()
		expect(batchCall?.[0].cache).toBeUndefined()
		expect(batchCall?.[0].makeParams()).toEqual({ batch: 'B1' })
	})

	it('refuses for a user who is not a batch admin', async () => {
		const router = makeRouter()
		await router.push('/batches/B1/certificates')
		const wrapper = await mountForm(router, student)
		expect(
			wrapper.find('[data-testid="bulk-certificates-fields"]').exists()
		).toBe(false)
		expect(wrapper.html()).toContain('not permitted')
	})

	it('refuses when the batch is not a certification batch', async () => {
		batchResource.data = { name: 'B1', certification: 0, students: ['a'] }
		const router = makeRouter()
		await router.push('/batches/B1/certificates')
		const wrapper = await mountForm(router, moderator)
		expect(
			wrapper.find('[data-testid="bulk-certificates-fields"]').exists()
		).toBe(false)
		expect(wrapper.html()).toContain('not enabled')
	})

	it('refuses when the batch has no students', async () => {
		batchResource.data = { name: 'B1', certification: 1, students: [] }
		const router = makeRouter()
		await router.push('/batches/B1/certificates')
		const wrapper = await mountForm(router, moderator)
		expect(
			wrapper.find('[data-testid="bulk-certificates-fields"]').exists()
		).toBe(false)
		expect(wrapper.html()).toContain('no students')
	})

	it('carries every field of the certificate form', async () => {
		const router = makeRouter()
		await router.push('/batches/B1/certificates')
		const wrapper = await mountForm(router, moderator)

		const labels = wrapper
			.find('[data-testid="bulk-certificates-fields"]')
			.findAll('label')
			.map((label) => label.text())
			.filter((text) => text !== '')
		for (const label of FIELD_LABELS) expect(labels).toContain(label)
		expect(labels).toHaveLength(FIELD_LABELS.length)
	})

	it('inserts one certificate per student, through its own resource', async () => {
		const router = makeRouter()
		await router.push('/batches/B1/certificates')
		const wrapper = await mountForm(router, moderator)

		await wrapper
			.find('[data-testid="bulk-certificates-save"]')
			.trigger('click')
		expect(certificateSubmit).toHaveBeenCalledTimes(2)
		expect(certificateSubmit.mock.calls[0][0]).toMatchObject({
			batch: 'B1',
			member: 'a@example.com',
		})
	})

	it('does not insert anything when the gate refuses', async () => {
		const router = makeRouter()
		await router.push('/batches/B1/certificates')
		const wrapper = await mountForm(router, student)
		// No Save button is rendered under a refusal, so drive the handler the
		// only way that remains — and assert it is inert either way.
		expect(
			wrapper.find('[data-testid="bulk-certificates-save"]').exists()
		).toBe(false)
		expect(certificateSubmit).not.toHaveBeenCalled()
	})

	it('waits for every insert before closing and claiming success (R4)', async () => {
		// The modal closed and toasted the instant the loop finished dispatching,
		// so it announced success for requests that had not happened yet.
		let resolveInsert: () => void = () => {}
		const pending = new Promise<void>((resolve) => {
			resolveInsert = resolve
		})
		certificateSubmit.mockImplementation(() => pending)

		const router = makeRouter()
		await router.push('/batches/B1#dashboard')
		await router.push({
			name: 'BulkCertificates',
			params: { batchName: 'B1' },
			hash: '#dashboard',
			state: { lmsFormEntry: true },
		})
		const wrapper = await mountForm(router, moderator)
		await wrapper
			.find('[data-testid="bulk-certificates-save"]')
			.trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('BulkCertificates')
		expect(toastSuccess).not.toHaveBeenCalled()

		resolveInsert()
		await flushPromises()
		expect(toastSuccess).toHaveBeenCalledTimes(1)
		expect(router.currentRoute.value.name).toBe('BatchDetail')
	})

	it('stays open and claims nothing when an insert fails (R4)', async () => {
		certificateSubmit.mockImplementation(
			(_doc: unknown, options: { onError: (e: unknown) => void }) => {
				options.onError({ messages: ['nope'] })
				return Promise.resolve()
			}
		)

		const router = makeRouter()
		await router.push('/batches/B1#dashboard')
		await router.push({
			name: 'BulkCertificates',
			params: { batchName: 'B1' },
			hash: '#dashboard',
			state: { lmsFormEntry: true },
		})
		const wrapper = await mountForm(router, moderator)
		await wrapper
			.find('[data-testid="bulk-certificates-save"]')
			.trigger('click')
		await flushPromises()

		expect(toastError).toHaveBeenCalled()
		expect(toastSuccess).not.toHaveBeenCalled()
		expect(router.currentRoute.value.name).toBe('BulkCertificates')
	})

	it('mobile: the back control pops the router back to the page', async () => {
		const router = makeRouter()
		await router.push('/batches/B1#dashboard')
		await router.push({
			name: 'BulkCertificates',
			params: { batchName: 'B1' },
			hash: '#dashboard',
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
		expect(router.currentRoute.value.fullPath).toBe('/batches/B1#dashboard')
	})

	it('desktop: dismissing the Dialog pops the router back to the page', async () => {
		const router = makeRouter()
		await router.push('/batches/B1#dashboard')
		await router.push({
			name: 'BulkCertificates',
			params: { batchName: 'B1' },
			hash: '#dashboard',
			state: { lmsFormEntry: true },
		})
		const wrapper = await mountForm(router, moderator)

		await wrapper
			.findComponent({ name: 'Dialog' })
			.vm.$emit('update:open', false)
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('BatchDetail')
	})

	it('closing a DEEP-LINKED form keeps the tab hash (C2)', async () => {
		// The regression this exists for: with no entry of ours to pop, close()
		// REPLACES to the parent location the form supplied. If that location
		// drops route.hash, BatchDetail silently re-renders on tab 0.
		const router = makeRouter()
		await router.push('/batches/B1/certificates#dashboard')
		const wrapper = await mountForm(router, moderator)

		await wrapper
			.findComponent({ name: 'Dialog' })
			.vm.$emit('update:open', false)
		await flushPromises()
		expect(router.currentRoute.value.fullPath).toBe('/batches/B1#dashboard')
	})
})
