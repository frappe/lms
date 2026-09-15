import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h } from 'vue'

vi.stubGlobal('__', (text: string) => text)

// vue-router resolves a matched record's async `component()` as part of
// navigation itself (to extract in-component guards). The real pages pull in
// frappe-ui, whose ESM build does not resolve under plain Node module
// resolution, so stub the components while keeping the navigation — and the
// route TABLE under test — genuine.
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

vi.mock('@/pages/ProgrammingExercises/ProgrammingExercises.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))
vi.mock('@/pages/Forms/ProgrammingExerciseForm.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))
vi.mock(
	'@/pages/ProgrammingExercises/ProgrammingExerciseSubmissions.vue',
	() => ({
		default: defineComponent({ render: () => h('div') }),
	})
)
vi.mock(
	'@/pages/ProgrammingExercises/ProgrammingExerciseSubmission.vue',
	() => ({
		default: defineComponent({ render: () => h('div') }),
	})
)

// The REAL route table, not a copy. A test that reimplements the routes only
// proves how vue-router ranks paths; it would stay green while the route table
// said something else entirely.
import { routes } from '@/routes'

const routerAt = async (path: string) => {
	const router = createRouter({ history: createMemoryHistory(), routes })
	await router.push(path)
	return router
}

describe('the programming-exercise form route', () => {
	it('resolves /programming-exercises/edit/:id to the form', async () => {
		const router = await routerAt('/programming-exercises/edit/EX-0001')
		expect(router.currentRoute.value.name).toBe('ProgrammingExerciseForm')
		expect(router.currentRoute.value.params.exerciseID).toBe('EX-0001')
	})

	it('keeps the form nested under the list so the list stays mounted', async () => {
		const router = await routerAt('/programming-exercises/edit/EX-0001')
		const names = router.currentRoute.value.matched.map((r) => r.name)
		expect(names).toEqual(['ProgrammingExercises', 'ProgrammingExerciseForm'])
	})

	// The `edit/` segment exists precisely so the form cannot swallow the two
	// sibling routes that share the /programming-exercises prefix.
	it('still resolves the static submissions list', async () => {
		const router = await routerAt('/programming-exercises/submissions')
		expect(router.currentRoute.value.name).toBe(
			'ProgrammingExerciseSubmissions'
		)
	})

	it('still resolves a single submission under an exercise', async () => {
		const router = await routerAt(
			'/programming-exercises/EX-0001/submission/SUB-1'
		)
		expect(router.currentRoute.value.name).toBe('ProgrammingExerciseSubmission')
		expect(router.currentRoute.value.params.exerciseID).toBe('EX-0001')
		expect(router.currentRoute.value.params.submissionID).toBe('SUB-1')
	})

	it('still resolves the bare list page', async () => {
		const router = await routerAt('/programming-exercises')
		expect(router.currentRoute.value.name).toBe('ProgrammingExercises')
	})
})
