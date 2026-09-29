import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { defineComponent, h } from 'vue'

// Non-identity translator: a double-translated string shows up as 't:t:...',
// which an identity stub would hide.
vi.stubGlobal('__', (text: string) => `t:${text}`)

const seen: Record<string, unknown>[] = []
const locked: Record<string, string>[] = []
const deletable: unknown[] = []

vi.mock('@/components/Submissions/SubmissionsPage.vue', () => ({
	default: defineComponent({
		props: ['config', 'lockedFilters', 'canDelete'],
		setup(p, { slots }) {
			seen.push(p.config as Record<string, unknown>)
			deletable.push(p.canDelete)
			locked.push(p.lockedFilters as Record<string, string>)
			return () =>
				h('div', [
					slots.cell?.({
						column: { key: 'member_name' },
						row: { member_name: 'Ada', member_image: '/ada.png' },
						value: 'Ada',
					}),
					...['Passed', 'Failed'].map((status) =>
						slots.cell?.({
							column: { key: 'status' },
							row: { status },
							value: status,
						})
					),
					slots.cell?.({
						column: { key: 'modified' },
						row: { modified: 'an hour ago' },
						value: 'an hour ago',
					}),
				])
		},
	}),
}))

vi.mock('frappe-ui', () => ({
	Badge: defineComponent({
		props: ['theme'],
		setup:
			(p, { slots }) =>
			() =>
				h('span', { 'data-theme': p.theme }, slots.default?.()),
	}),
	Avatar: defineComponent({
		props: ['image', 'label', 'size'],
		setup: (p) => () => h('span', { 'data-avatar-label': p.label }),
	}),
}))

import ProgrammingExerciseSubmissions from '@/pages/ProgrammingExercises/ProgrammingExerciseSubmissions.vue'

// A real memory router, not `mocks: { $router }`: the page calls useRouter(),
// which reads the injected router plugin and never looks at $router.
const Stub = defineComponent({ render: () => h('div') })

const makeRouter = (): Router =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: '/programming-exercises/submissions',
				name: 'ProgrammingExerciseSubmissions',
				component: Stub,
			},
		],
	})

const mountPage = async (userData: {
	name?: string
	is_instructor?: boolean
	is_moderator?: boolean
	is_evaluator?: boolean
}) => {
	const router = makeRouter()
	await router.push('/programming-exercises/submissions')
	await router.isReady()
	const wrapper = mount(ProgrammingExerciseSubmissions, {
		global: {
			plugins: [router],
			mocks: { __: (text: string) => `t:${text}` },
			provide: {
				$user: { data: { name: 'a@b.c', ...userData } },
				$dayjs: () => ({ fromNow: () => 'an hour ago' }),
			},
		},
	})
	await flushPromises()
	return { wrapper, router }
}

beforeEach(() => {
	seen.length = 0
	locked.length = 0
})

// Guards the exercise submissions list's config, translation split and scoping.
// Came with this branch's shared submissions page for every assessment type.
// Added on feat/assessment-visual-redesign when the old list page was replaced.
describe('the programming-exercise submissions page', () => {
	it('scopes the shared page to exercise submissions', async () => {
		await mountPage({ is_moderator: true })
		const config = seen[0] as { doctype: string; filters: { key: string }[] }
		expect(config.doctype).toBe('LMS Programming Exercise Submission')
		expect(config.filters.map((f) => f.key)).toEqual([
			'exercise',
			'member',
			'status',
		])
	})

	it('requests the fields ListPage needs, including the row key', async () => {
		await mountPage({ is_moderator: true })
		const config = seen[0] as { fields: string[]; orderBy: string }
		// ListPage's rowKey and bulk delete key on 'name'; without it selection
		// breaks silently.
		expect(config.fields).toEqual(
			expect.arrayContaining([
				'name',
				'exercise',
				'exercise_title',
				'member_name',
				'member_image',
				'status',
				'modified',
			])
		)
		expect(config.orderBy).toBe('modified desc')
	})

	it('routes a row at the submission under its exercise', async () => {
		await mountPage({ is_moderator: true })
		const config = seen[0] as {
			getRowRoute: (r: Record<string, unknown>) => Record<string, unknown>
		}
		expect(config.getRowRoute({ name: 'SUB-1', exercise: 'EX-1' })).toEqual({
			name: 'ProgrammingExerciseSubmission',
			params: { exerciseID: 'EX-1', submissionID: 'SUB-1' },
		})
	})

	it('resolves the scope crumb back to the owning exercise', async () => {
		await mountPage({ is_moderator: true })
		const config = seen[0] as {
			scopeCrumb: {
				filterKey: string
				doctype: string
				titleField: string
				route: (v: string) => Record<string, unknown>
			}
		}
		expect(config.scopeCrumb.filterKey).toBe('exercise')
		expect(config.scopeCrumb.doctype).toBe('LMS Programming Exercise')
		expect(config.scopeCrumb.titleField).toBe('title')
		expect(config.scopeCrumb.route('EX-1')).toEqual({
			name: 'ProgrammingExerciseForm',
			params: { exerciseID: 'EX-1' },
		})
	})

	// SubmissionsPage wraps these in `__()` itself, so this page must pass raw
	// text or a real translator would double-translate.
	it('hands the shared page raw text for title, pageTitle and placeholders', async () => {
		await mountPage({ is_moderator: true })
		const config = seen[0] as {
			title: string
			pageTitle: string
			emptyName: string
			filters: { key: string; placeholder: string }[]
		}
		expect(config.title).toBe('Submissions')
		expect(config.pageTitle).toBe('Programming Exercise Submissions')
		expect(config.emptyName).toBe('Programming Exercise Submissions')
		expect(config.filters.map((f) => [f.key, f.placeholder])).toEqual([
			['exercise', 'Filter by Exercise'],
			['member', 'Filter by Member'],
			['status', 'Filter by Status'],
		])
	})

	// These reach the DOM verbatim, so this page translates them itself: the
	// opposite rule from title, pageTitle and placeholders.
	it('translates the parent crumb, column labels and status options itself', async () => {
		await mountPage({ is_moderator: true })
		const config = seen[0] as {
			parentCrumb: { label: string }
			columns: { key: string; label: string }[]
			filters: { key: string; options?: { label: string; value: string }[] }[]
		}
		expect(config.parentCrumb.label).toBe('t:Programming Exercises')
		expect(
			Object.fromEntries(config.columns.map((c) => [c.key, c.label]))
		).toEqual({
			member_name: 't:Member',
			exercise_title: 't:Exercise',
			status: 't:Status',
			modified: 't:Modified',
		})
		const statusFilter = config.filters.find((f) => f.key === 'status')
		expect(statusFilter?.options).toEqual([
			{ label: '', value: '' },
			{ label: 't:Passed', value: 'Passed' },
			{ label: 't:Failed', value: 'Failed' },
		])
	})

	it('draws the member cell with an avatar and status as a themed badge', async () => {
		const { wrapper } = await mountPage({ is_moderator: true })

		expect(wrapper.find('[data-avatar-label="Ada"]').exists()).toBe(true)
		expect(wrapper.text()).toContain('Ada')

		const badges = wrapper.findAll('[data-theme]')
		expect(badges).toHaveLength(2)
		expect(badges.map((b) => [b.attributes('data-theme'), b.text()])).toEqual([
			['green', 'Passed'],
			['red', 'Failed'],
		])

		expect(wrapper.text()).toContain('an hour ago')
		expect(
			wrapper.findAll('[data-theme]').some((b) => b.text() === 'an hour ago')
		).toBe(false)
	})

	it('turns a raw modified timestamp into a relative one via transform', async () => {
		await mountPage({ is_moderator: true })
		const config = seen[0] as {
			transform: (rows: Record<string, unknown>[]) => Record<string, unknown>[]
		}
		const out = config.transform([
			{ name: 'SUB-1', modified: '2026-01-01 00:00:00' },
		])
		expect(out).toEqual([{ name: 'SUB-1', modified: 'an hour ago' }])
	})

	// A student sees this page as their own submission history.
	it('pins a student to their own submissions', async () => {
		await mountPage({ name: 'student@example.com' })
		expect(locked[0]).toEqual({ member: 'student@example.com' })
	})

	// Guards students getting a Delete button their DocPerm always refuses.
	// Broke with this branch's move onto the shared submissions page.
	// Added on feat/assessment-visual-redesign with the canDelete gate.
	it('offers a student no Delete', async () => {
		await mountPage({ name: 'student@example.com' })
		expect(deletable.at(-1)).toBe(false)
	})

	it('leaves an instructor free to filter by member', async () => {
		await mountPage({ name: 'teacher@example.com', is_instructor: true })
		expect(locked[0]).toEqual({})
	})

	it('leaves a moderator free to filter by member', async () => {
		await mountPage({ name: 'mod@example.com', is_moderator: true })
		expect(locked[0]).toEqual({})
	})

	it('leaves an evaluator free to filter by member', async () => {
		await mountPage({ name: 'eval@example.com', is_evaluator: true })
		expect(locked[0]).toEqual({})
	})

	// Unlike AssignmentSubmissions, a plain member belongs here: it is their
	// own submission history, not a page to redirect them from.
	it('lets a plain member stay on the page instead of redirecting them away', async () => {
		const { router } = await mountPage({ name: 'student@example.com' })
		expect(router.currentRoute.value.name).toBe(
			'ProgrammingExerciseSubmissions'
		)
	})
})
