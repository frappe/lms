/**
 * Programs.vue list state.
 *
 * Same two hazards Courses.vue was fixed for. frappe-ui's `createResource` keeps
 * no request sequence, so a slow response from a tab the user has already left
 * repaints the list with the wrong programs; and `list.loading` belongs to the
 * resource rather than to a request, so the aborted fetch's tail clears the flag
 * for the reload that replaced it and the empty state flashes.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { nextTick, reactive } from 'vue'
import { mount } from '@vue/test-utils'

type Rows = { name: string }[]

interface FakeRequest {
	filters: Record<string, unknown>
	aborted: boolean
	respond: (rows: Rows) => void
	finish: () => void
}

/**
 * Mirrors frappe-ui's list resource closely enough to expose ordering bugs:
 * responses are settled by hand, `abort()` cancels the fetch in flight, an
 * un-aborted response always wins, and `finish()` runs the request tail that
 * clears the shared `loading` flag — including an aborted request's tail.
 */
function makeProgramsResource() {
	const requests: FakeRequest[] = []
	let inFlight: FakeRequest | null = null

	const resource = reactive({
		data: null as Rows | null,
		hasNextPage: false,
		pageLength: 24,
		filters: {} as Record<string, unknown>,
		list: {
			loading: false,
			abort: () => {
				if (inFlight) inFlight.aborted = true
			},
		},
		update({ filters }: { filters?: Record<string, unknown> }) {
			if (filters) resource.filters = JSON.parse(JSON.stringify(filters))
		},
		reload() {
			let settle: () => void
			const settled = new Promise<void>((resolve) => (settle = resolve))
			const request: FakeRequest = {
				filters: JSON.parse(JSON.stringify(resource.filters)),
				aborted: false,
				respond(rows: Rows) {
					if (!request.aborted) resource.data = rows
				},
				finish() {
					resource.list.loading = false
					settle()
				},
			}
			inFlight = request
			requests.push(request)
			resource.list.loading = true
			return settled
		},
		next: vi.fn(),
	})

	return { resource, requests }
}

const { programsResource, requests, countAborts } = vi.hoisted(() => ({
	programsResource: { current: null as any },
	requests: { current: [] as any[] },
	countAborts: { value: 0 },
}))

vi.mock('frappe-ui', () => ({
	usePageMeta: vi.fn(),
	createListResource: () => programsResource.current,
	createResource: () =>
		reactive({
			data: 0,
			abort: () => {
				countAborts.value += 1
			},
			submit: vi.fn(),
		}),
	Breadcrumbs: { template: '<nav />' },
	Button: { template: '<button><slot /></button>' },
	FormControl: {
		inheritAttrs: false,
		props: ['modelValue', 'type', 'label', 'placeholder'],
		emits: ['update:modelValue'],
		template: `<input v-bind="$attrs" :type="type" :value="modelValue" />`,
	},
	TabButtons: {
		props: ['options', 'modelValue'],
		emits: ['update:modelValue'],
		template: `<div>
			<button
				v-for="option in options"
				:key="option.value"
				:data-testid="'tab-' + option.value"
				:data-state="option.value === modelValue ? 'checked' : 'unchecked'"
				@click="$emit('update:modelValue', option.value)"
			>{{ option.label }}</button>
		</div>`,
	},
}))

vi.mock('@/stores/session', () => ({ sessionStore: () => ({ brand: {} }) }))

const stub = (template: string) => ({ default: { template } })
vi.mock('@/pages/Programs/ProgramForm.vue', () => stub('<div />'))
vi.mock('@/pages/Programs/StudentPrograms.vue', () => stub('<div />'))
vi.mock('@/components/Layouts/LayoutHeader.vue', () => stub('<header />'))

// Stands in for the whole page shell, so this file stays about list state. The
// loading prop is surfaced so the flash-of-empty-state fix can be asserted.
vi.mock('@/components/Layouts/ListPage.vue', () => ({
	default: {
		props: ['rows', 'breadcrumbs', 'title', 'loading'],
		template: `<div :data-loading="String(loading)">
			<slot name="actions" />
			<slot name="tabs" />
			<slot name="filters" />
			<slot v-for="row in rows" :key="row.name" name="card" :row="row" />
		</div>`,
	},
}))

vi.stubGlobal('__', (s: string) => s)

const MODERATOR = { name: 'admin@test.com', is_moderator: true }
const PUBLISHED_PROGRAMS = [{ name: 'program-a' }, { name: 'program-b' }]

async function mountPrograms() {
	const { default: Programs } = await import('@/pages/Programs/Programs.vue')
	const wrapper = mount(Programs, {
		global: {
			provide: { $user: { data: { ...MODERATOR } } },
			mocks: { __: (s: string) => s },
		},
	})
	await nextTick()
	return wrapper
}

const cards = (wrapper: any) => wrapper.findAll('button[type="button"]').length
const loading = (wrapper: any) =>
	wrapper.find('[data-loading]').attributes('data-loading')

beforeEach(() => {
	window.history.replaceState({}, '', '/lms/programs')
	const fake = makeProgramsResource()
	programsResource.current = fake.resource
	requests.current = fake.requests
	countAborts.value = 0
	vi.resetModules()
})

describe('Programs list', () => {
	it('drops a slow response from the tab the user has already left', async () => {
		const wrapper = await mountPrograms()

		expect(requests.current).toHaveLength(1)
		expect(requests.current[0].filters).toMatchObject({ published: 1 })

		await wrapper.find('[data-testid="tab-unpublished"]').trigger('click')
		await nextTick()
		expect(requests.current).toHaveLength(2)
		expect(requests.current[1].filters).toMatchObject({ published: 0 })

		// Unpublished answers first: there are none.
		requests.current[1].respond([])
		await nextTick()
		expect(cards(wrapper)).toBe(0)

		// The Published fetch finally lands. It must not repaint the list.
		requests.current[0].respond(PUBLISHED_PROGRAMS)
		await nextTick()
		expect(cards(wrapper)).toBe(0)
	})

	it('stays loading when the aborted fetch tail clears the shared flag', async () => {
		const wrapper = await mountPrograms()

		await wrapper.find('[data-testid="tab-unpublished"]').trigger('click')
		await nextTick()
		expect(requests.current).toHaveLength(2)

		// The replacement fetch is in flight; the aborted one only now unwinds
		// and drops `list.loading` on its way out.
		requests.current[0].finish()
		await nextTick()
		expect(requests.current[0].aborted).toBe(true)
		expect(programsResource.current.list.loading).toBe(false)
		expect(loading(wrapper)).toBe('true')

		// Only the replacement settling ends the loading state.
		requests.current[1].respond([])
		requests.current[1].finish()
		await nextTick()
		await nextTick()
		expect(loading(wrapper)).toBe('false')
	})

	it('cancels the in-flight count before asking for a new one', async () => {
		const wrapper = await mountPrograms()
		expect(countAborts.value).toBe(1)

		await wrapper.find('[data-testid="tab-unpublished"]').trigger('click')
		await nextTick()
		expect(countAborts.value).toBe(2)
	})
})
