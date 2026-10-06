import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h } from 'vue'

vi.stubGlobal('__', (text: string) => text)

// frappe patches String.prototype.format onto the page at runtime; both
// header titles use it.
String.prototype.format = function (this: string, ...args: unknown[]): string {
	return this.replace(/{(\d+)}/g, (match, index) =>
		args[Number(index)] === undefined ? match : String(args[Number(index)])
	)
}

// Only the #actions slot is under test, so ListPage renders just that.
vi.mock('@/components/Layouts/pages/ListPage.vue', () => ({
	default: defineComponent({
		setup:
			(_, { slots }) =>
			() =>
				h('div', slots.actions?.()),
	}),
}))

vi.mock('@/components/HeaderButton.vue', () => ({
	default: defineComponent({
		props: ['label', 'icon', 'variant', 'route'],
		setup: (p) => () =>
			h('button', {
				'data-testid': 'header-button',
				'data-label': p.label,
				'data-variant': p.variant ?? 'outline',
				'data-route': JSON.stringify(p.route),
			}),
	}),
}))

const inertList = {
	data: [],
	list: { loading: false },
	hasNextPage: false,
	next: vi.fn(),
	reload: vi.fn(),
	update: vi.fn(),
	pageLength: 24,
	delete: { submit: vi.fn() },
}

vi.mock('frappe-ui', () => ({
	Button: defineComponent({
		setup:
			(_, { slots }) =>
			() =>
				h('button', slots.default?.()),
	}),
	FormControl: defineComponent({ setup: () => () => h('input') }),
	createListResource: vi.fn(() => inertList),
	createResource: vi.fn(() => ({ data: 0, reload: vi.fn(), update: vi.fn() })),
	call: vi.fn(),
	toast: { success: vi.fn(), error: vi.fn() },
	usePageMeta: vi.fn(),
}))

vi.mock('@/components/Controls/Select.vue', () => ({
	default: defineComponent({ setup: () => () => h('select') }),
}))

vi.mock('@/stores/session', () => ({ sessionStore: () => ({ brand: {} }) }))

const Stub = defineComponent({ render: () => h('div') })

const makeRouter = () =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/', name: 'Courses', component: Stub },
			{ path: '/assignments', name: 'Assignments', component: Stub },
			{
				path: '/assignments/submissions',
				name: 'AssignmentSubmissions',
				component: Stub,
			},
			{
				path: '/programming-exercises',
				name: 'ProgrammingExercises',
				component: Stub,
			},
			{
				path: '/programming-exercises/submissions',
				name: 'ProgrammingExerciseSubmissions',
				component: Stub,
			},
		],
	})

const mountPage = async (component: unknown) => {
	const router = makeRouter()
	await router.push('/')
	await router.isReady()
	return mount(component as never, {
		global: {
			plugins: [router],
			provide: {
				$user: { data: { name: 'a@b.c', is_moderator: 1 } },
				$dayjs: () => ({ format: () => '', fromNow: () => '' }),
			},
			// vi.stubGlobal doesn't reach a template's `_ctx.__`.
			mocks: { __: (text: string) => text },
		},
	})
}

const submissionsLinkTarget = (wrapper: ReturnType<typeof mount>) => {
	const route = wrapper
		.find('[data-label="Submissions"]')
		.attributes('data-route')
	return route ? JSON.parse(route) : null
}

// Static imports: a runtime import() of a variable skips vite's `@/` alias.
import Assignments from '@/pages/Assignments.vue'
import ProgrammingExercises from '@/pages/ProgrammingExercises/ProgrammingExercises.vue'

const cases = [
	{ name: 'Assignments', page: Assignments, route: 'AssignmentSubmissions' },
	{
		name: 'ProgrammingExercises',
		page: ProgrammingExercises,
		route: 'ProgrammingExerciseSubmissions',
	},
]

// Guards a missing or hidden Submissions button on the assessment lists.
// Broke in #1593 (hidden behind v-if="exercises.data?.length"); this branch's
// shared Submissions button fixed it. Added on feat/assessment-visual-redesign.
cases.forEach(({ name, page, route }) => {
	describe(`${name} header actions`, () => {
		it('offers one outline Submissions button with no rows loaded', async () => {
			const wrapper = await mountPage(page)

			const buttons = wrapper.findAll('[data-label="Submissions"]')
			expect(buttons).toHaveLength(1)
			expect(buttons[0].attributes('data-variant')).toBe('outline')
			expect(submissionsLinkTarget(wrapper)).toEqual({ name: route })
		})
	})
})
