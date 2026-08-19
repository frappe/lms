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
import { defineComponent, h, nextTick, reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

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
 * clears the shared `loading` flag, including an aborted request's tail.
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
vi.mock('@/pages/Programs/StudentPrograms.vue', () => stub('<div />'))
vi.mock('@/components/Layouts/PageHeader.vue', () => stub('<header />'))

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

// The page hosts the program form as a child route, so it reads $route and
// pushes through useRouter(). A real (memory) router is installed rather than a
// hand-written $route mock, so the push assertion below is against the genuine
// route table shape. The outlet itself is stubbed: this file is about list
// state, and the form has its own tests.
const blank = defineComponent({ render: () => h('div') })

function makeRouter(): Router {
	return createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: '/programs',
				name: 'Programs',
				component: blank,
				children: [
					{ path: ':programName/edit', name: 'ProgramForm', component: blank },
				],
			},
		],
	})
}

async function mountPrograms(router: Router = makeRouter()) {
	const { default: Programs } = await import('@/pages/Programs/Programs.vue')
	await router.push('/programs')
	await router.isReady()
	const wrapper = mount(Programs, {
		global: {
			plugins: [router],
			provide: { $user: { data: { ...MODERATOR } } },
			mocks: { __: (s: string) => s },
			stubs: { RouterView: true },
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

	it('keeps history.state when it rewrites the query string', async () => {
		window.history.replaceState(
			{ lmsFormEntry: true },
			'',
			'/lms/programs?title='
		)
		await mountPrograms()

		// The rewrite really happened, so the assertion below is about a live
		// replaceState call and not about one that never ran.
		expect(window.location.search).toBe('')
		// A form opened as a child route of this page keeps its "we pushed this
		// entry" marker in history.state, and only window.history.state survives a
		// reload. Replacing it with `{}` turned the form's close from a pop into a
		// replace, and left vue-router unable to re-seed its own position.
		expect(window.history.state).toMatchObject({ lmsFormEntry: true })
	})

	it('opens the form as a stamped route entry, not as a local flag', async () => {
		const router = makeRouter()
		const wrapper = await mountPrograms(router)

		const create = wrapper
			.findAll('button')
			.find((button) => button.text() === 'Create')
		expect(create).toBeDefined()
		await create!.trigger('click')
		await flushPromises()

		expect(router.currentRoute.value.name).toBe('ProgramForm')
		expect(router.currentRoute.value.params.programName).toBe('new')
		// Stamped, so the form knows Back should close it rather than leave the app.
		expect(router.options.history.state).toMatchObject({ lmsFormEntry: true })
	})

	it('opens an existing program at its own edit address', async () => {
		const router = makeRouter()
		const wrapper = await mountPrograms(router)
		requests.current[0].respond(PUBLISHED_PROGRAMS)
		await nextTick()

		await wrapper.find('button[type="button"]').trigger('click')
		await flushPromises()

		expect(router.currentRoute.value.name).toBe('ProgramForm')
		expect(router.currentRoute.value.params.programName).toBe('program-a')
	})

	it('cancels the in-flight count before asking for a new one', async () => {
		const wrapper = await mountPrograms()
		expect(countAborts.value).toBe(1)

		await wrapper.find('[data-testid="tab-unpublished"]').trigger('click')
		await nextTick()
		expect(countAborts.value).toBe(2)
	})
})
