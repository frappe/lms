/**
 * Assignments.vue's header count.
 *
 * The count is a second resource (`frappe.client.get_count`), separate from the
 * list resource, and nothing refetches it when a row is added — so after
 * creating an assignment the page kept claiming the old total until a filter
 * changed. Pre-existing; the design doc parked it and it is fixed here because
 * the form conversion is what gives the parent a create signal to hang it on.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { defineComponent, h, reactive } from 'vue'

vi.stubGlobal('__', (s: string) => s)

// frappe's translation layer patches String.prototype.format onto the page at
// runtime; the header title uses it. Same shim as responsiveListView.test.ts.
String.prototype.format = function (this: string, ...args: unknown[]): string {
	return this.replace(/{(\d+)}/g, (match, index) =>
		args[Number(index)] === undefined ? match : String(args[Number(index)])
	)
}

const { listResource, countResource } = vi.hoisted(() => ({
	listResource: { current: null as any },
	countResource: { current: null as any },
}))

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
	usePageMeta: vi.fn(),
	createListResource: () => listResource.current,
	createResource: () => countResource.current,
	toast: { success: vi.fn(), error: vi.fn() },
	Button: {
		inheritAttrs: false,
		template: `<button v-bind="$attrs"><slot name="prefix" /><slot /></button>`,
	},
	FormControl: {
		inheritAttrs: false,
		props: ['modelValue', 'type', 'placeholder'],
		emits: ['update:modelValue'],
		template: `<input v-bind="$attrs" :value="modelValue" />`,
	},
}))

vi.mock('@/stores/session', () => ({ sessionStore: () => ({ brand: {} }) }))
vi.mock('@/components/Controls/Select.vue', () => ({
	default: {
		props: ['modelValue', 'options', 'placeholder'],
		template: '<select />',
	},
}))

// Stands in for the page shell so this file stays about the count.
vi.mock('@/components/Layouts/ListPage.vue', () => ({
	default: {
		props: ['rows', 'breadcrumbs', 'title', 'loading', 'totalCount'],
		template: `<div :data-title="title">
			<slot name="actions" />
			<slot name="filters" />
		</div>`,
	},
}))

import Assignments from '@/pages/Assignments.vue'

// The real form is a child route of this page and signals a create by emitting
// `created`. Emitting on click rather than on mount keeps the assertion clear
// of the page's own mount-time fetches.
const FormStub = defineComponent({
	emits: ['created'],
	setup(_props, { emit }) {
		return () =>
			h(
				'button',
				{ 'data-testid': 'emit-created', onClick: () => emit('created') },
				'created'
			)
	},
})

const makeRouter = () =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: '/assignments',
				name: 'Assignments',
				component: Assignments,
				children: [
					{
						path: ':assignmentID',
						name: 'AssignmentForm',
						component: FormStub,
					},
				],
			},
			{ path: '/courses', name: 'Courses', component: FormStub },
		],
	})

const mountPage = async () => {
	const router = makeRouter()
	await router.push('/assignments/new')
	const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
		global: {
			plugins: [router],
			provide: {
				$user: { data: { name: 'mod@test.com', is_moderator: true } },
				$dayjs: () => ({ format: () => '01 Jan 2026' }),
			},
			mocks: { __: (s: string) => s },
		},
	})
	await flushPromises()
	return wrapper
}

beforeEach(() => {
	listResource.current = reactive({
		data: [],
		hasNextPage: false,
		pageLength: 24,
		list: { loading: false },
		update: vi.fn(),
		reload: vi.fn(),
		next: vi.fn(),
		delete: { submit: vi.fn() },
	})
	countResource.current = reactive({
		data: 3,
		update: vi.fn(),
		reload: vi.fn(),
	})
})

describe('the assignments header count', () => {
	it('refetches the count when the form reports a create', async () => {
		const wrapper = await mountPage()

		// The page fetches both on mount; only what the create triggers matters.
		listResource.current.reload.mockClear()
		countResource.current.reload.mockClear()

		await wrapper.find('[data-testid="emit-created"]').trigger('click')
		await flushPromises()

		expect(listResource.current.reload).toHaveBeenCalledTimes(1)
		expect(countResource.current.reload).toHaveBeenCalledTimes(1)
	})

	it('renders the count it is given', async () => {
		const wrapper = await mountPage()
		expect(wrapper.find('[data-title]').attributes('data-title')).toBe(
			'3 Assignments'
		)
	})
})
