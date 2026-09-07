import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h } from 'vue'

vi.stubGlobal('__', (text: string) => text)

// vue-router resolves a matched record's async `component()` during navigation
// (to extract in-component guards), so the real SFCs would be pulled in here.
// They drag in frappe-ui, whose ESM build doesn't resolve under plain Node
// module resolution — the same failure documented in newBatchRoute.test.ts.
// Stubbing the components keeps the navigation real; the route TABLE under test
// is still the genuine one from `@/routes`.
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

vi.mock('@/pages/Forms/QuizForm.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))
vi.mock('@/pages/Forms/QuizQuestionForm.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))
vi.mock('@/pages/QuizPage.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))

// The REAL route table, not a copy — a reimplemented table would stay green
// while routes.js said something else entirely.
import { routes } from '@/routes'

const makeRouter = () =>
	createRouter({ history: createMemoryHistory(), routes })

describe('the quiz-question route', () => {
	it('addresses a new question under its quiz', async () => {
		const router = makeRouter()
		await router.push('/quizzes/QUIZ-1/question/new')
		expect(router.currentRoute.value.name).toBe('QuizQuestion')
		expect(router.currentRoute.value.params.quizID).toBe('QUIZ-1')
		expect(router.currentRoute.value.params.questionName).toBe('new')
	})

	it('addresses an existing question by its LMS Quiz Question ROW name', async () => {
		const router = makeRouter()
		// A row name, not an LMS Question docname. `marks` lives on the row, so
		// this is the only identifier from which BOTH ids are recoverable (R2).
		await router.push('/quizzes/QUIZ-1/question/8a2c1f9e77')
		expect(router.currentRoute.value.name).toBe('QuizQuestion')
		expect(router.currentRoute.value.params.questionName).toBe('8a2c1f9e77')
	})

	it('keeps the form nested under the quiz so the quiz stays mounted', async () => {
		const router = makeRouter()
		await router.push('/quizzes/QUIZ-1/question/new')
		const names = router.currentRoute.value.matched.map((r) => r.name)
		expect(names).toEqual(['QuizForm', 'QuizQuestion'])
	})

	it('leaves the bare quiz URL on the quiz page with no child', async () => {
		const router = makeRouter()
		await router.push('/quizzes/QUIZ-1')
		expect(router.currentRoute.value.name).toBe('QuizForm')
		expect(router.currentRoute.value.matched).toHaveLength(1)
	})

	it('does not shadow the learner-facing quiz route', async () => {
		const router = makeRouter()
		await router.push('/quiz/QUIZ-1')
		expect(router.currentRoute.value.name).toBe('QuizPage')
	})
})
