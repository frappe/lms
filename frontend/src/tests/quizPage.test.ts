// Guards a learner opening a shared quiz link and seeing the author's trail:
// "Quizzes / <quiz> / Test Quiz", leading to pages they cannot open. Added on
// quiz-share-link, when the page became the link authors share.
import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

vi.mock('frappe-ui', () => ({
	createResource: () => ({ data: { title: 'Chart of Accounts' } }),
	usePageMeta: vi.fn(),
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/stores/session', () => ({ sessionStore: () => ({ brand: {} }) }))
vi.mock('@/components/Quiz.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))
vi.mock('@/components/Layouts/pages/PageHeader.vue', () => ({
	default: defineComponent({
		props: { breadcrumbs: { type: Array, default: () => [] } },
		setup: (props) => () =>
			h(
				'nav',
				(props.breadcrumbs as { label: string }[])
					.map((crumb) => crumb.label)
					.join(' / ')
			),
	}),
}))

import QuizPage from '@/pages/QuizPage.vue'

const trailFor = async (user: Record<string, unknown>) => {
	const wrapper = mount(QuizPage, {
		props: { quizID: 'QZ-0001' },
		global: {
			provide: { $user: { data: user } },
			mocks: { __: (text: string) => text },
		},
	})
	await flushPromises()
	return wrapper.get('nav').text()
}

describe('QuizPage breadcrumbs', () => {
	it('shows a learner only the quiz title', async () => {
		expect(await trailFor({ name: 'learner@x.com', is_student: true })).toBe(
			'Chart of Accounts'
		)
	})

	it('keeps the authoring trail for an instructor', async () => {
		expect(
			await trailFor({
				name: 'mod@x.com',
				is_student: false,
				is_moderator: true,
			})
		).toBe('Quizzes / Chart of Accounts / Test Quiz')
	})
})
