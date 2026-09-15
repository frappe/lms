import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h } from 'vue'

vi.stubGlobal('__', (text: string) => text)

// vue-router resolves a matched record's async `component()` during navigation
// itself, so the real SFCs would be imported here — and frappe-ui's ESM build
// does not resolve under plain Node module resolution. Stubbing the three page
// components keeps the navigation real; the route TABLE under test is still the
// genuine one from `@/routes`.
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

vi.mock('@/pages/Programs/Programs.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))
vi.mock('@/pages/Forms/ProgramForm.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))
vi.mock('@/pages/Programs/ProgramDetail.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))
vi.mock('@/pages/Programs/ProgramEnrollment.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))

// The REAL route table. A test that reimplements the routes would only prove
// vue-router ranks a longer path higher; it would stay green while the app's
// own table said something else.
import { routes } from '@/routes'

const push = async (path: string) => {
	const router = createRouter({ history: createMemoryHistory(), routes })
	await router.push(path)
	return router.currentRoute.value
}

describe('the program form route', () => {
	// The whole reason the path carries `/edit`. A bare `:programName` child of
	// Programs would be byte-identical to the top-level ProgramDetail route and
	// score identically; vue-router keeps both and serves whichever was
	// registered first — the child — silently breaking every student-facing
	// program link. This test is the regression guard for that.
	it('leaves a bare program path with the student-facing detail page', async () => {
		const route = await push('/programs/data-science')
		expect(route.name).toBe('ProgramDetail')
		expect(route.params.programName).toBe('data-science')
	})

	it('resolves the /edit path to the form', async () => {
		const route = await push('/programs/data-science/edit')
		expect(route.name).toBe('ProgramForm')
		expect(route.params.programName).toBe('data-science')
	})

	it('carries the create sentinel in the same param', async () => {
		const route = await push('/programs/new/edit')
		expect(route.name).toBe('ProgramForm')
		expect(route.params.programName).toBe('new')
	})

	it('keeps the form nested under the list so the list stays mounted', async () => {
		const route = await push('/programs/data-science/edit')
		expect(route.matched.map((record) => record.name)).toEqual([
			'Programs',
			'ProgramForm',
		])
	})

	it('resolves the /enroll path to the enrollment page', async () => {
		const route = await push('/programs/data-science/enroll')
		expect(route.name).toBe('ProgramEnrollment')
		expect(route.params.programName).toBe('data-science')
	})

	it('keeps the enrollment page nested so the list keeps its tab', async () => {
		// StudentPrograms holds `currentTab` in a local ref, not the route. Being
		// a child is what keeps that component mounted, so cancelling returns to
		// the Published tab the student opened this from rather than resetting to
		// Enrolled.
		const route = await push('/programs/data-science/enroll')
		expect(route.matched.map((record) => record.name)).toEqual([
			'Programs',
			'ProgramEnrollment',
		])
	})

	it('registers exactly one route for a bare program path', async () => {
		// The shadowing in R1 is not a match-order accident that a single push
		// could miss: it is two records claiming one path. Assert the app has only
		// one, so re-adding a bare child fails here even if push() happened to
		// pick the right one.
		const router = createRouter({ history: createMemoryHistory(), routes })
		const claimants = router
			.getRoutes()
			.filter((record) => record.path === '/programs/:programName')
		expect(claimants.map((record) => record.name)).toEqual(['ProgramDetail'])
	})
})
