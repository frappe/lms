import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h } from 'vue'

vi.stubGlobal('__', (text: string) => text)

// vue-router resolves a matched record's async `component()` during navigation
// itself, so the real SFCs would be imported here — and frappe-ui's ESM build
// does not resolve under plain Node module resolution. Stubbing the two page
// components keeps the navigation real while the route TABLE under test stays
// the genuine one from `@/routes`. Same reasoning as newBatchRoute.test.ts.
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

vi.mock('@/pages/Assignments.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))
vi.mock('@/pages/Forms/AssignmentForm.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))
vi.mock('@/pages/AssignmentSubmissionList.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))

import { routes } from '@/routes'

const makeRouter = () =>
	createRouter({ history: createMemoryHistory(), routes })

describe('the assignment form route', () => {
	it('addresses the create form at /assignments/new', async () => {
		const router = makeRouter()
		await router.push('/assignments/new')
		expect(router.currentRoute.value.name).toBe('AssignmentForm')
		expect(router.currentRoute.value.params.assignmentID).toBe('new')
	})

	it('addresses an existing assignment by its docname', async () => {
		const router = makeRouter()
		await router.push('/assignments/ASG-0001')
		expect(router.currentRoute.value.name).toBe('AssignmentForm')
		expect(router.currentRoute.value.params.assignmentID).toBe('ASG-0001')
	})

	it('keeps the form nested under the list so the list stays mounted', async () => {
		const router = makeRouter()
		await router.push('/assignments/new')
		const names = router.currentRoute.value.matched.map((r) => r.name)
		expect(names).toEqual(['Assignments', 'AssignmentForm'])
	})

	it('leaves the bare list route with no form open', async () => {
		const router = makeRouter()
		await router.push('/assignments')
		expect(router.currentRoute.value.name).toBe('Assignments')
		expect(router.currentRoute.value.matched).toHaveLength(1)
	})

	it('does not shadow the separate assignment-submissions list', async () => {
		const router = makeRouter()
		await router.push('/assignment-submissions')
		expect(router.currentRoute.value.name).toBe('AssignmentSubmissionList')
	})
})
