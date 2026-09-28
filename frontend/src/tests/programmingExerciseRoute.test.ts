import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h } from 'vue'

vi.stubGlobal('__', (text: string) => text)

// Navigation imports each matched page SFC, so stub them; the route table
// from @/routes stays real.
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

// Guards the exercise paths resolving to the right pages. The edit/ route came
// with #2662; this branch's route realignment made both forms pages and moved
// submissions to /programming-exercise-submission, so the table was re-pinned.
describe('the programming-exercise route table', () => {
	it('resolves /programming-exercises/edit/:id to the form', async () => {
		const router = await routerAt('/programming-exercises/edit/EX-0001')
		expect(router.currentRoute.value.name).toBe('ProgrammingExerciseForm')
		expect(router.currentRoute.value.params.exerciseID).toBe('EX-0001')
	})

	it('addresses both forms as pages of their own', async () => {
		const create = await routerAt('/programming-exercises/new')
		expect(create.currentRoute.value.matched.map((r) => r.name)).toEqual([
			'NewProgrammingExercise',
		])
		const edit = await routerAt('/programming-exercises/edit/EX-0001')
		expect(edit.currentRoute.value.matched.map((r) => r.name)).toEqual([
			'ProgrammingExerciseForm',
		])
	})

	it('resolves the static submissions list, not a form', async () => {
		const router = await routerAt('/programming-exercises/submissions')
		expect(router.currentRoute.value.name).toBe(
			'ProgrammingExerciseSubmissions'
		)
	})

	it('resolves the bare list page', async () => {
		const router = await routerAt('/programming-exercises')
		expect(router.currentRoute.value.name).toBe('ProgrammingExercises')
	})

	it('resolves a single submission outside the plural namespace', async () => {
		const router = await routerAt(
			'/programming-exercise-submission/EX-0001/SUB-1'
		)
		expect(router.currentRoute.value.name).toBe('ProgrammingExerciseSubmission')
		expect(router.currentRoute.value.params.exerciseID).toBe('EX-0001')
		expect(router.currentRoute.value.params.submissionID).toBe('SUB-1')
	})

	// Unlike /quiz-submission, :exerciseID stays: a first attempt has no
	// submission yet to read the exercise off.
	it('addresses a new submission for an exercise', async () => {
		const router = await routerAt(
			'/programming-exercise-submission/EX-0001/new'
		)
		expect(router.currentRoute.value.name).toBe('ProgrammingExerciseSubmission')
		expect(router.currentRoute.value.params.exerciseID).toBe('EX-0001')
		expect(router.currentRoute.value.params.submissionID).toBe('new')
	})
})

// Guards old submission links (emails, bookmarks) breaking after the move.
// Came with this branch's route realignment for the assessment redesign.
// Added on feat/assessment-visual-redesign to pin the redirect and its query.
describe('the retired programming-exercise paths', () => {
	it('redirects the old submission address, keeping its query', async () => {
		const router = await routerAt(
			'/programming-exercises/EX-0001/submission/SUB-1?fromLesson=1'
		)
		expect(router.currentRoute.value.name).toBe('ProgrammingExerciseSubmission')
		expect(router.currentRoute.value.params.exerciseID).toBe('EX-0001')
		expect(router.currentRoute.value.params.submissionID).toBe('SUB-1')
		expect(router.currentRoute.value.query.fromLesson).toBe('1')
	})
})

// Guards the edit/ segment: vue-router ranks a static sibling first in any
// order, so a docname `submissions` (titles name assessments since this branch)
// would be unreachable. Added on feat/assessment-visual-redesign to prove it.
describe('vue-router ranks a static sibling above a dynamic child', () => {
	const Stub = defineComponent({ render: () => h('div') })
	const build = (staticFirst: boolean) => {
		const parent = {
			path: '/things',
			name: 'List',
			component: Stub,
			children: [{ path: ':id', name: 'Form', component: Stub }],
		}
		const stat = { path: '/things/submissions', name: 'Subs', component: Stub }
		return createRouter({
			history: createMemoryHistory(),
			routes: staticFirst ? [stat, parent] : [parent, stat],
		})
	}

	it.each([true, false])(
		'holds with the static route registered first = %s',
		async (staticFirst) => {
			const router = build(staticFirst)
			await router.push('/things/submissions')
			expect(router.currentRoute.value.name).toBe('Subs')
			await router.push('/things/ABC')
			expect(router.currentRoute.value.name).toBe('Form')
			expect(router.currentRoute.value.params.id).toBe('ABC')
		}
	)
})
