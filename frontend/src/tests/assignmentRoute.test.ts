import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h } from 'vue'

vi.stubGlobal('__', (text: string) => text)

// Navigation imports each matched page SFC, so stub them; the route table
// from @/routes stays real.
vi.mock('@/pages/Assignments.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))
vi.mock('@/pages/Forms/AssignmentForm.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))
vi.mock('@/pages/AssignmentSubmissions.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))
vi.mock('@/pages/AssignmentSubmission.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))

import { routes } from '@/routes'

const routerAt = async (path: string) => {
	const router = createRouter({ history: createMemoryHistory(), routes })
	await router.push(path)
	return router
}

// Guards the assignment routes: forms under edit/, submissions in the namespace.
// The form route came in #2662; this branch's route moves reshaped the table.
// Added on feat/assessment-visual-redesign to match the quiz redesign's paths.
describe('the assignment route table', () => {
	it('addresses the create form at /assignments/new', async () => {
		const router = await routerAt('/assignments/new')
		expect(router.currentRoute.value.name).toBe('NewAssignment')
	})

	it('addresses an existing assignment under edit/', async () => {
		const router = await routerAt('/assignments/edit/ASG-0001')
		expect(router.currentRoute.value.name).toBe('AssignmentForm')
		expect(router.currentRoute.value.params.assignmentID).toBe('ASG-0001')
	})

	it('keeps both forms nested under the list so the list stays mounted', async () => {
		const create = await routerAt('/assignments/new')
		expect(create.currentRoute.value.matched.map((r) => r.name)).toEqual([
			'Assignments',
			'NewAssignment',
		])
		const edit = await routerAt('/assignments/edit/ASG-0001')
		expect(edit.currentRoute.value.matched.map((r) => r.name)).toEqual([
			'Assignments',
			'AssignmentForm',
		])
	})

	it('leaves the bare list route with no form open', async () => {
		const router = await routerAt('/assignments')
		expect(router.currentRoute.value.name).toBe('Assignments')
		expect(router.currentRoute.value.matched).toHaveLength(1)
	})

	it('resolves the submissions list, not a form', async () => {
		const router = await routerAt('/assignments/submissions')
		expect(router.currentRoute.value.name).toBe('AssignmentSubmissions')
	})

	// A docname is a slug of the title, so both of these are names an author
	// can produce. Without the edit/ segment their forms would be unreachable,
	// because vue-router scores a fixed word above a placeholder.
	it('gives the form an address no docname can shadow', async () => {
		for (const docname of ['submissions', 'new']) {
			const router = await routerAt(`/assignments/edit/${docname}`)
			expect(router.currentRoute.value.name).toBe('AssignmentForm')
			expect(router.currentRoute.value.params.assignmentID).toBe(docname)
		}
	})

	it('resolves a single submission outside the plural namespace', async () => {
		const router = await routerAt('/assignment-submission/ASG-0001/SUB-1')
		expect(router.currentRoute.value.name).toBe('AssignmentSubmission')
		expect(router.currentRoute.value.params.assignmentID).toBe('ASG-0001')
		expect(router.currentRoute.value.params.submissionName).toBe('SUB-1')
	})

	// :assignmentID cannot be dropped the way /quiz-submission/:submission
	// drops its quiz: on a first attempt there is no submission yet to read the
	// assignment off, and this is the address that attempt is written from.
	it('addresses a new submission for an assignment', async () => {
		const router = await routerAt('/assignment-submission/ASG-0001/new')
		expect(router.currentRoute.value.name).toBe('AssignmentSubmission')
		expect(router.currentRoute.value.params.assignmentID).toBe('ASG-0001')
		expect(router.currentRoute.value.params.submissionName).toBe('new')
	})
})

// Guards old assignment bookmarks and links still landing on the right page.
// Came with this branch's move of assignment routes under /assignments.
// Added on feat/assessment-visual-redesign so retired paths redirect.
describe('the retired assignment paths', () => {
	it('redirects the old form address onto edit/', async () => {
		const router = await routerAt('/assignments/ASG-0001?tab=details')
		expect(router.currentRoute.value.name).toBe('AssignmentForm')
		expect(router.currentRoute.value.params.assignmentID).toBe('ASG-0001')
		expect(router.currentRoute.value.query.tab).toBe('details')
	})

	it('redirects the old submissions list and renames its filter key', async () => {
		const router = await routerAt('/assignment-submissions?assignmentID=ASG-1')
		expect(router.currentRoute.value.name).toBe('AssignmentSubmissions')
		expect(router.currentRoute.value.query.assignment).toBe('ASG-1')
		expect(router.currentRoute.value.query.assignmentID).toBeUndefined()
	})

	it('passes an old submissions-list query through untouched otherwise', async () => {
		const router = await routerAt('/assignment-submissions?status=Pass')
		expect(router.currentRoute.value.query.status).toBe('Pass')
	})
})
