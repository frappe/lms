import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { defineComponent, h } from 'vue'
import type { ListViewOptions, SubmissionsConfig } from '@/types'

vi.stubGlobal('__', (text: string) => text)

// Every filter set the page asked for (createListResource plus each update()),
// recorded because the bug worth catching is an EXTRA request, not a wrong one.
const requestedFilters: Record<string, string>[] = []

const listState = {
	data: [] as Record<string, unknown>[],
	update: vi.fn((options: { filters?: Record<string, string> }) => {
		if (options.filters) requestedFilters.push(options.filters)
	}),
	reload: vi.fn(),
	loading: false,
	hasNextPage: false,
	next: vi.fn(),
	pageLength: 24,
}
const countState = { data: 0, reload: vi.fn() }
// The title arrives through reload(), as a response does: the page clears
// scopeTitle.data before each refetch, so pre-seeded data would test nothing.
let scopeTitleResponse: { title?: string } | null = null
const titleState = {
	data: null as { title?: string } | null,
	reload: vi.fn(() => {
		titleState.data = scopeTitleResponse
	}),
}

// Delete attempts in order, not successes, so a partial run can be counted.
const deleteCalls: string[] = []
// Names the mock should reject, so a run can be made to fail in part or whole.
const rejectDeletes = new Set<string>()
// Holds every delete open, so a second click can be made to land mid-run.
const heldDeletes: (() => void)[] = []
let holdDeletes = false

// Hoisted so assertions see the same Set and spies the mock hands the page.
const { toastMock, selectionMock } = vi.hoisted(() => ({
	toastMock: { success: vi.fn(), error: vi.fn() },
	selectionMock: {
		selections: new Set<string>(),
		unselectAll: vi.fn(),
	},
}))

// frappe patches String.prototype.format onto the page at runtime; the
// partial-failure toast uses it.
String.prototype.format = function (this: string, ...args: unknown[]): string {
	return this.replace(/\{(\d+)\}/g, (_m, i) => String(args[Number(i)]))
}

vi.mock('frappe-ui', () => ({
	Button: defineComponent({
		props: ['label'],
		emits: ['click'],
		setup:
			(p, { emit, slots }) =>
			() =>
				h(
					'button',
					{ onClick: () => emit('click') },
					p.label ?? slots.default?.()
				),
	}),
	Badge: defineComponent({
		setup:
			(_, { slots }) =>
			() =>
				h('span', slots.default?.()),
	}),
	Avatar: defineComponent({ setup: () => () => h('span') }),
	ListFooter: defineComponent({ setup: () => () => h('div') }),
	usePageMeta: vi.fn(),
	toast: toastMock,
	call: vi.fn((_method: string, args: { name: string }) => {
		deleteCalls.push(args.name)
		if (rejectDeletes.has(args.name)) {
			return Promise.reject({ messages: ['Not permitted'] })
		}
		if (holdDeletes) return new Promise<void>((r) => heldDeletes.push(r))
		return Promise.resolve()
	}),
	createListResource: vi.fn((options: { filters?: Record<string, string> }) => {
		if (options.filters) requestedFilters.push(options.filters)
		return listState
	}),
	createResource: vi.fn((opts: { url: string }) =>
		opts.url === 'frappe.client.get_count' ? countState : titleState
	),
}))

// Keeps only what the assertions read: crumbs, filter slot, selection banner.
vi.mock('@/components/Layouts/pages/ListPage.vue', () => ({
	default: defineComponent({
		name: 'ListPageStub',
		props: [
			'breadcrumbs',
			'title',
			'rows',
			'columns',
			'listOptions',
			'pageLength',
		],
		emits: ['update:pageLength', 'loadMore'],
		setup:
			(p, { slots }) =>
			() =>
				h('div', [
					h(
						'nav',
						{ 'data-testid': 'crumbs' },
						p.breadcrumbs.map((c: { label: string }) =>
							h('span', { class: 'crumb' }, c.label)
						)
					),
					h('div', { 'data-testid': 'filters' }, slots.filters?.()),
					h(
						'div',
						{ 'data-testid': 'banner' },
						slots['selection-actions']?.({
							selections: selectionMock.selections,
							unselectAll: selectionMock.unselectAll,
						})
					),
				]),
	}),
}))

vi.mock('@/components/Controls/Link.vue', () => ({
	default: defineComponent({
		props: ['doctype', 'modelValue', 'placeholder', 'readonly'],
		emits: ['update:modelValue'],
		setup:
			(p, { emit }) =>
			() =>
				h('input', {
					'data-testid': `link-${p.doctype}`,
					'data-readonly': String(Boolean(p.readonly)),
					value: p.modelValue,
					onInput: (e: Event) =>
						emit('update:modelValue', (e.target as HTMLInputElement).value),
				}),
	}),
}))

vi.mock('@/components/Controls/Select.vue', () => ({
	default: defineComponent({
		props: ['modelValue', 'options', 'placeholder'],
		emits: ['update:modelValue'],
		setup:
			(p, { emit }) =>
			() =>
				h('select', {
					'data-testid': 'select',
					value: p.modelValue,
					onChange: (e: Event) =>
						emit('update:modelValue', (e.target as HTMLSelectElement).value),
				}),
	}),
}))

// sessionStore imports frappe-ui itself and would bypass the mock above.
vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ brand: { favicon: '' } }),
}))

import SubmissionsPage from '@/components/Submissions/SubmissionsPage.vue'

const config: SubmissionsConfig = {
	doctype: 'LMS Assignment Submission',
	fields: ['name', 'assignment', 'member_name', 'status'],
	orderBy: 'creation desc',
	columns: [{ label: 'Member', key: 'member_name', width: 1 }],
	filters: [
		{ key: 'assignment', doctype: 'LMS Assignment', placeholder: 'Assignment' },
		{ key: 'member', doctype: 'User', placeholder: 'Member' },
		{
			key: 'status',
			placeholder: 'Status',
			options: [
				{ label: '', value: '' },
				{ label: 'Pass', value: 'Pass' },
			],
		},
	],
	getRowRoute: (row) => ({
		name: 'AssignmentSubmission',
		params: {
			assignmentID: String(row.assignment),
			submissionName: String(row.name),
		},
	}),
	parentCrumb: { label: 'Assignments', route: { name: 'Assignments' } },
	scopeCrumb: {
		filterKey: 'assignment',
		doctype: 'LMS Assignment',
		titleField: 'title',
		route: (value) => ({
			name: 'AssignmentForm',
			params: { assignmentID: value },
		}),
	},
	title: 'Submissions',
	pageTitle: 'Assignment Submissions',
	emptyName: 'Assignment Submissions',
	emptyIcon: 'lucide-pencil',
}

const Stub = defineComponent({ render: () => h('div') })

const makeRouter = (): Router =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/assignments', name: 'Assignments', component: Stub },
			{
				path: '/assignments/submissions',
				name: 'AssignmentSubmissions',
				component: Stub,
			},
			{
				path: '/assignments/:assignmentID',
				name: 'AssignmentForm',
				component: Stub,
			},
			{
				path: '/assignments/:assignmentID/submission/:submissionName',
				name: 'AssignmentSubmission',
				component: Stub,
			},
		],
	})

const mountPage = async (
	router: Router,
	props: Record<string, unknown> = {}
) => {
	const wrapper = mount(SubmissionsPage, {
		props: { config, ...props },
		global: {
			plugins: [router],
			// vi.stubGlobal doesn't reach a template's `_ctx.__`.
			mocks: { __: (text: string) => text },
			provide: {
				$user: { data: { name: 'a@b.c', is_moderator: 1 } },
				$dayjs: () => ({ format: () => '01 Jan 2026', fromNow: () => 'today' }),
			},
		},
	})
	await flushPromises()
	return wrapper
}

beforeEach(() => {
	vi.clearAllMocks()
	requestedFilters.length = 0
	deleteCalls.length = 0
	rejectDeletes.clear()
	heldDeletes.length = 0
	holdDeletes = false
	// Same Set refilled: the page deletes from it, assertions read the rest.
	selectionMock.selections.clear()
	selectionMock.selections.add('SUB-1')
	selectionMock.selections.add('SUB-2')
	listState.data = []
	titleState.data = null
	scopeTitleResponse = null
})

// Guards the shared submissions page's filters and their URL round-trip.
// Came with this branch's one submissions page for every assessment type.
// Added on feat/assessment-visual-redesign to replace the per-type lists.
describe('SubmissionsPage filters', () => {
	it('draws a Link for a doctype filter and a Select for an options filter', async () => {
		const router = makeRouter()
		await router.push('/assignments/submissions')
		const wrapper = await mountPage(router)

		expect(wrapper.find('[data-testid="link-LMS Assignment"]').exists()).toBe(
			true
		)
		expect(wrapper.find('[data-testid="link-User"]').exists()).toBe(true)
		expect(wrapper.find('[data-testid="select"]').exists()).toBe(true)
	})

	// Guards a Select named by its choice ("Pass") instead of its dimension.
	// Came with #2598 (a11y labels on AssignmentSubmissionList.vue).
	// Added on feat/assessment-visual-redesign to carry it onto the shared page.
	it('gives both control kinds an accessible name that survives a choice', async () => {
		const router = makeRouter()
		await router.push('/assignments/submissions')
		const wrapper = await mountPage(router)

		expect(
			wrapper.find('[data-testid="link-User"]').attributes('aria-label')
		).toBe('Member')
		expect(
			wrapper.find('[data-testid="select"]').attributes('aria-label')
		).toBe('Status')
	})

	it('seeds its filters from the URL query before it asks for anything', async () => {
		const router = makeRouter()
		await router.push('/assignments/submissions?assignment=ASG-1')
		await mountPage(router)

		expect(listState.update).toHaveBeenCalledWith(
			expect.objectContaining({ filters: { assignment: 'ASG-1' } })
		)

		// Late seeding issues an unfiltered `{}` request whose response can land
		// last and show every submission under a filter chip, so every request
		// must carry the filter.
		expect(requestedFilters.length).toBeGreaterThan(0)
		requestedFilters.forEach((applied) =>
			expect(applied).toEqual({ assignment: 'ASG-1' })
		)
	})

	it('writes a chosen filter back to the query', async () => {
		const router = makeRouter()
		await router.push('/assignments/submissions')
		const wrapper = await mountPage(router)

		await wrapper.find('[data-testid="link-LMS Assignment"]').setValue('ASG-9')
		await flushPromises()

		expect(router.currentRoute.value.query.assignment).toBe('ASG-9')
	})

	it('drops a cleared filter from the query rather than leaving it empty', async () => {
		const router = makeRouter()
		await router.push('/assignments/submissions?assignment=ASG-1')
		const wrapper = await mountPage(router)

		await wrapper.find('[data-testid="link-LMS Assignment"]').setValue('')
		await flushPromises()

		expect(router.currentRoute.value.query.assignment).toBeUndefined()
	})

	// Driven through the stub's own model rather than the wrapper vm:
	// vue-test-utils proxies bindings a component never exposed, so reaching
	// `wrapper.vm.pageLength` passes whether or not the model is really wired.
	it('resets paging to the first row when the page length changes', async () => {
		const router = makeRouter()
		await router.push('/assignments/submissions')
		const wrapper = await mountPage(router)

		await wrapper
			.findComponent({ name: 'ListPageStub' })
			.vm.$emit('update:pageLength', 60)
		await flushPromises()

		expect(listState.update).toHaveBeenCalledWith(
			expect.objectContaining({ pageLength: 60, start: 0 })
		)
	})
})

// Guards a locked scope (who you are) leaking into, or surviving in, the URL.
// Came with this branch's one submissions page for every assessment type.
// Added on feat/assessment-visual-redesign when a URL-borne lock broke scope.
describe('SubmissionsPage lockedFilters', () => {
	it('applies a locked value and marks its control readonly', async () => {
		const router = makeRouter()
		await router.push('/assignments/submissions')
		const wrapper = await mountPage(router, {
			lockedFilters: { member: 'student@example.com' },
		})

		expect(listState.update).toHaveBeenCalledWith(
			expect.objectContaining({
				filters: expect.objectContaining({ member: 'student@example.com' }),
			})
		)
		expect(
			wrapper.find('[data-testid="link-User"]').attributes('data-readonly')
		).toBe('true')
		// Readonly and empty would leave the applied scope unreadable by anyone.
		expect(
			(wrapper.find('[data-testid="link-User"]').element as HTMLInputElement)
				.value
		).toBe('student@example.com')
	})

	// A locked value in the URL makes a link that looks scoped to one person but
	// re-derives for whoever opens it. A fresh mount writes nothing, so an
	// unlocked filter is changed to force a write.
	it('keeps a locked value out of the URL when an unlocked one is written', async () => {
		const router = makeRouter()
		await router.push('/assignments/submissions')
		const wrapper = await mountPage(router, {
			lockedFilters: { member: 'student@example.com' },
		})

		await wrapper.find('[data-testid="link-LMS Assignment"]').setValue('ASG-9')
		await flushPromises()

		expect(router.currentRoute.value.query.assignment).toBe('ASG-9')
		expect(router.currentRoute.value.query.member).toBeUndefined()
	})

	// A locked key already in the URL would describe a scope not on screen,
	// since the list filters by the locked value. Unrelated keys stay.
	it('strips a locked key that arrived in the URL, leaving unlocked ones', async () => {
		const router = makeRouter()
		await router.push(
			'/assignments/submissions?member=someone@else.com&exercise=EX-1'
		)
		await mountPage(router, {
			lockedFilters: { member: 'student@example.com' },
		})

		expect(requestedFilters.length).toBeGreaterThan(0)
		requestedFilters.forEach((applied) =>
			expect(applied).toEqual({ member: 'student@example.com' })
		)

		expect(router.currentRoute.value.query.member).toBeUndefined()
		expect(router.currentRoute.value.query.exercise).toBe('EX-1')
	})

	// Under push() the first Back would land on the URL the page just rejected.
	it('corrects the address without adding a history entry', async () => {
		const router = makeRouter()
		await router.push('/assignments')
		await router.push('/assignments/submissions?member=someone@else.com')
		await mountPage(router, {
			lockedFilters: { member: 'student@example.com' },
		})

		expect(router.currentRoute.value.query.member).toBeUndefined()

		router.go(-1)
		await flushPromises()

		expect(router.currentRoute.value.path).toBe('/assignments')
	})
})

// Guards the parent crumb and the scoped assessment's title in the middle.
// Came with this branch's one submissions page for every assessment type.
// Added on feat/assessment-visual-redesign to pin the crumb trail.
describe('SubmissionsPage breadcrumbs', () => {
	it('shows the parent and the page with no filter applied', async () => {
		const router = makeRouter()
		await router.push('/assignments/submissions')
		const wrapper = await mountPage(router)

		const labels = wrapper.findAll('.crumb').map((c) => c.text())
		expect(labels).toEqual(['Assignments', 'Submissions'])
		expect(titleState.reload).not.toHaveBeenCalled()
	})

	it('names the scoped assessment in the middle when a filter is applied', async () => {
		const router = makeRouter()
		await router.push('/assignments/submissions?assignment=ASG-1')
		scopeTitleResponse = { title: 'Essay One' }
		const wrapper = await mountPage(router)
		await flushPromises()

		const labels = wrapper.findAll('.crumb').map((c) => c.text())
		expect(labels).toEqual(['Assignments', 'Essay One', 'Submissions'])
		// Without this, deleting the scope watcher leaves the test green.
		expect(titleState.reload).toHaveBeenCalled()
	})

	it('falls back to the docname before the title resolves', async () => {
		const router = makeRouter()
		await router.push('/assignments/submissions?assignment=ASG-1')
		const wrapper = await mountPage(router)

		const labels = wrapper.findAll('.crumb').map((c) => c.text())
		expect(labels).toEqual(['Assignments', 'ASG-1', 'Submissions'])
	})
})

const clickDelete = async (wrapper: VueWrapper) => {
	await wrapper.find('[data-testid="banner"] button').trigger('click')
	await flushPromises()
}

// Guards bulk delete: one refetch, partial failures reported and kept ticked.
// Came with this branch's one submissions page for every assessment type.
// Added on feat/assessment-visual-redesign to cover the shared delete run.
describe('SubmissionsPage bulk delete', () => {
	it('deletes every selected row and refetches once', async () => {
		const router = makeRouter()
		await router.push('/assignments/submissions')
		const wrapper = await mountPage(router)

		await clickDelete(wrapper)

		expect(deleteCalls).toEqual(['SUB-1', 'SUB-2'])
		// The mount fetch plus one refetch for the whole run, not one per row.
		expect(listState.reload).toHaveBeenCalledTimes(2)
		expect(selectionMock.unselectAll).toHaveBeenCalled()
		expect(toastMock.success).toHaveBeenCalled()
	})

	// A half-worked run has to say so and leave the failed rows ticked for a
	// retry.
	it('prunes the rows that went, keeps the failed one ticked, and says so', async () => {
		const router = makeRouter()
		await router.push('/assignments/submissions')
		rejectDeletes.add('SUB-2')
		const wrapper = await mountPage(router)

		await clickDelete(wrapper)

		expect(deleteCalls).toEqual(['SUB-1', 'SUB-2'])
		expect([...selectionMock.selections]).toEqual(['SUB-2'])
		// Clearing the selection here would throw away the retry.
		expect(selectionMock.unselectAll).not.toHaveBeenCalled()
		expect(toastMock.success).not.toHaveBeenCalled()
		expect(toastMock.error).toHaveBeenCalledWith(
			'1 of 2 submissions could not be deleted: Not permitted',
			{ duration: Infinity }
		)
		expect(listState.reload).toHaveBeenCalledTimes(2)
	})

	it('refetches nothing and keeps every row ticked when the whole run fails', async () => {
		const router = makeRouter()
		await router.push('/assignments/submissions')
		rejectDeletes.add('SUB-1')
		rejectDeletes.add('SUB-2')
		const wrapper = await mountPage(router)

		await clickDelete(wrapper)

		expect([...selectionMock.selections]).toEqual(['SUB-1', 'SUB-2'])
		expect(selectionMock.unselectAll).not.toHaveBeenCalled()
		// The mount fetch only: nothing went, so nothing to refetch.
		expect(listState.reload).toHaveBeenCalledTimes(1)
		expect(toastMock.error).toHaveBeenCalledWith(
			'2 of 2 submissions could not be deleted: Not permitted',
			{ duration: Infinity }
		)
	})

	// A second tap would resubmit names already gone, and the run would then
	// report failure for deletes that worked.
	it('ignores a second click while a run is still in flight', async () => {
		const router = makeRouter()
		await router.push('/assignments/submissions')
		holdDeletes = true
		const wrapper = await mountPage(router)

		await clickDelete(wrapper)
		expect(deleteCalls).toEqual(['SUB-1', 'SUB-2'])

		await clickDelete(wrapper)
		expect(deleteCalls).toEqual(['SUB-1', 'SUB-2'])

		heldDeletes.forEach((release) => release())
		await flushPromises()

		expect(selectionMock.unselectAll).toHaveBeenCalledTimes(1)
	})
})

// Guards checkboxes on rows a viewer may not delete (doctypes differ in roles).
// Came with this branch's one submissions page for every assessment type.
// Added on feat/assessment-visual-redesign: trigger and slot must go together.
describe('SubmissionsPage canDelete', () => {
	const listOptionsOf = (wrapper: VueWrapper) =>
		wrapper
			.findComponent({ name: 'ListPageStub' })
			.props('listOptions') as ListViewOptions

	it('withdraws the trigger and the checkboxes together when false', async () => {
		const router = makeRouter()
		await router.push('/assignments/submissions')
		const wrapper = await mountPage(router, { canDelete: false })

		expect(wrapper.find('[data-testid="banner"] button').exists()).toBe(false)
		// ListPage gates selection on the slot being passed, so it must be gone.
		expect(
			Object.keys(wrapper.findComponent({ name: 'ListPageStub' }).vm.$slots)
		).not.toContain('selection-actions')
		expect(listOptionsOf(wrapper).selectable).toBe(false)
	})

	it('offers both when told it may delete', async () => {
		const router = makeRouter()
		await router.push('/assignments/submissions')
		const wrapper = await mountPage(router, { canDelete: true })

		expect(wrapper.find('[data-testid="banner"] button').exists()).toBe(true)
		expect(listOptionsOf(wrapper).selectable).toBe(true)
	})

	// Programming exercises pass nothing and keep the affordance.
	it('defaults to offering both when the prop is omitted', async () => {
		const router = makeRouter()
		await router.push('/assignments/submissions')
		const wrapper = await mountPage(router)

		expect(wrapper.find('[data-testid="banner"] button').exists()).toBe(true)
		expect(listOptionsOf(wrapper).selectable).toBe(true)
	})
})
