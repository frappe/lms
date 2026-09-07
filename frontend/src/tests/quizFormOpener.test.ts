import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import {
	createMemoryHistory,
	createRouter,
	RouterView,
	type Router,
} from 'vue-router'
import { defineComponent, h, reactive } from 'vue'

vi.stubGlobal('__', (text: string) => text)

// The other half of R2. `quizQuestionForm.test.ts` pins what the FORM does with
// the route param; this pins what QuizForm.vue PUTS in it. Passing row.question
// (the LMS Question docname) instead of row.name (the LMS Quiz Question row)
// loses `marks` irrecoverably, and nothing else in the suite would notice.
const H = vi.hoisted(() => {
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
	return { quizDoc: { doc: null } as any, createDocumentResource: vi.fn() }
})

vi.mock('frappe-ui', async () => {
	const { reactive } = await import('vue')
	// Defined inside the factory: vi.mock is hoisted above every top-level
	// binding, so a module-scope helper would be in its TDZ here.
	const passthrough = (name: string) => ({
		name,
		inheritAttrs: false,
		template: `<div v-bind="$attrs"><slot /></div>`,
	})
	return {
		createResource: (options: any) =>
			reactive({ options, data: null, loading: false, submit: vi.fn() }),
		createDocumentResource: (options: any) => {
			H.createDocumentResource(options)
			return H.quizDoc
		},
		usePageMeta: () => {},
		toast: { success: vi.fn(), error: vi.fn() },
		Badge: passthrough('Badge'),
		LoadingIndicator: passthrough('LoadingIndicator'),
		Tooltip: passthrough('Tooltip'),
		ListFooter: passthrough('ListFooter'),
		Button: {
			inheritAttrs: false,
			template: `<button v-bind="$attrs"><slot name="prefix" /><slot /></button>`,
		},
		FormControl: {
			props: ['modelValue', 'label', 'type'],
			template: `<label>{{ label }}<slot name="label" /></label>`,
		},
	}
})

// develop (#2637) reworked this page onto the shared PageHeader shell and swapped
// the frappe-ui ListView stack for ResponsiveListView. That MOVED the row-click
// seam: it is no longer `<ListRow @click>` but `options.onRowClick`, so the stub
// drives the click through the options bag to exercise the real path.
vi.mock('@/components/ResponsiveListView.vue', () => ({
	default: {
		props: ['rows', 'columns', 'options', 'rowKey', 'titleKey'],
		// Each row carries BOTH ids; only `name` identifies the quiz-question row.
		template: `<div><button
			v-for="row in rows"
			:key="row.name"
			class="list-row"
			@click="options.onRowClick(row)"
		/></div>`,
	},
}))
vi.mock('@/components/Layouts/PageHeader.vue', () => ({
	default: {
		props: ['breadcrumbs', 'loading'],
		template: `<header><slot name="actions" /></header>`,
	},
}))
vi.mock('@/components/HeaderButton.vue', () => ({
	default: {
		props: ['label', 'icon'],
		template: `<button>{{ label }}</button>`,
	},
}))
vi.mock('@/components/Controls/BooleanSwitch.vue', () => ({
	default: { props: ['modelValue', 'label'], template: `<label />` },
}))
vi.mock('@/components/Layouts/EmptyStateLayout.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))
vi.mock('@/components/Layouts/ListPage.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))
vi.mock('@/composables/useKeyboardShortcuts', () => ({
	useKeyboardShortcuts: () => {},
	saveShortcut: () => ({}),
}))
vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ brand: { favicon: '' } }),
}))
// @/utils pulls in plyr and a wide dependency tree the opener has nothing to do
// with.
vi.mock('@/utils', () => ({ sanitizeHTML: (v: string) => v }))
vi.mock('@/utils/sanitizeRichHTML', () => ({
	sanitizeRichHTML: (v: string) => v,
}))

// Plain-JS SFC: no declaration for vue-tsc (TS7016). See quizQuestionForm.test.ts.
// @ts-expect-error - untyped .vue module
import QuizForm from '@/pages/Forms/QuizForm.vue'

const Stub = defineComponent({ render: () => h('div') })
// Rendered only if QuizForm actually carries a <router-view />; no parent page
// in the app had one before this change.
const QuestionOutlet = defineComponent({
	render: () => h('div', { 'data-testid': 'question-outlet' }),
})

const makeRouter = (): Router =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/courses', name: 'Courses', component: Stub },
			{ path: '/quizzes', name: 'Quizzes', component: Stub },
			{ path: '/quiz/:quizID', name: 'QuizPage', component: Stub },
			{
				path: '/quiz-submissions/:quizID',
				name: 'QuizSubmissionList',
				component: Stub,
			},
			{
				path: '/quizzes/:quizID',
				name: 'QuizForm',
				component: QuizForm,
				props: true,
				children: [
					{
						path: 'question/:questionName',
						name: 'QuizQuestion',
						component: QuestionOutlet,
						props: true,
					},
				],
			},
		],
	})

const mountQuiz = async (router: Router) => {
	const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
		global: {
			plugins: [router],
			provide: { $user: { data: { is_moderator: true } } },
			stubs: { teleport: true },
			mocks: { __: (text: string) => text, $dialog: vi.fn() },
		},
	})
	await flushPromises()
	return wrapper
}

describe('QuizForm opening the question route', () => {
	beforeEach(() => {
		H.createDocumentResource.mockClear()
		H.quizDoc = reactive({
			doc: {
				name: 'QUIZ-1',
				title: 'A quiz',
				questions: [
					// name = LMS Quiz Question row; question = LMS Question docname.
					{ name: 'ROW-1', question: 'QSTN-0007', marks: 3 },
				],
			},
			isDirty: false,
			loading: false,
			reload: vi.fn(),
			setValue: { submit: vi.fn() },
			delete: { submit: vi.fn() },
		})
	})

	it('constructs the LMS Quiz resource the question form piggybacks on', async () => {
		const router = makeRouter()
		await router.push({ name: 'QuizForm', params: { quizID: 'QUIZ-1' } })
		await mountQuiz(router)

		// The other half of the shared-instance pair asserted in
		// quizQuestionForm.test.ts. createDocumentResource caches on
		// [doctype, name], so the form only reaches THIS resource — and a newly
		// added question only appears in the list — while both sides pass the
		// identical pair. Pinning only the form's side would let a drift here go
		// silent, which is exactly what develop's rework of this file could have
		// done.
		expect(H.createDocumentResource).toHaveBeenCalledWith(
			expect.objectContaining({ doctype: 'LMS Quiz', name: 'QUIZ-1' })
		)
	})

	it('opens a new question at the "new" sentinel under its quiz', async () => {
		const router = makeRouter()
		await router.push({ name: 'QuizForm', params: { quizID: 'QUIZ-1' } })
		const wrapper = await mountQuiz(router)

		const newButton = wrapper
			.findAll('button')
			.find((button) => button.text().includes('New Question'))
		await newButton!.trigger('click')
		await flushPromises()

		expect(router.currentRoute.value.name).toBe('QuizQuestion')
		expect(router.currentRoute.value.params).toEqual({
			quizID: 'QUIZ-1',
			questionName: 'new',
		})
		expect(wrapper.find('[data-testid="question-outlet"]').exists()).toBe(true)
	})

	it('opens an existing question by ROW name, not by LMS Question docname', async () => {
		const router = makeRouter()
		await router.push({ name: 'QuizForm', params: { quizID: 'QUIZ-1' } })
		const wrapper = await mountQuiz(router)

		await wrapper.find('.list-row').trigger('click')
		await flushPromises()

		// R2: QSTN-0007 here would silently orphan `marks`.
		expect(router.currentRoute.value.params.questionName).toBe('ROW-1')
	})

	it('stamps the history entry so the form can pop it rather than replace', async () => {
		const router = makeRouter()
		await router.push({ name: 'QuizForm', params: { quizID: 'QUIZ-1' } })
		const wrapper = await mountQuiz(router)

		await wrapper.find('.list-row').trigger('click')
		await flushPromises()

		// openFormRoute, not a bare router.push. Without the marker the form's
		// close() replaces to the parent and leaves a duplicate history entry.
		expect(
			(router.options.history.state as Record<string, unknown>).lmsFormEntry
		).toBe(true)
	})
})
