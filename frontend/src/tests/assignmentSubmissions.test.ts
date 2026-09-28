import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { defineComponent, h } from 'vue'
import type { SubmissionsConfig } from '@/types'

// Non-identity translator: a double-translated string shows up as 't:t:...',
// which an identity stub would hide.
vi.stubGlobal('__', (text: string) => `t:${text}`)

const seen: Record<string, unknown>[] = []
const seenCanDelete: unknown[] = []

vi.mock('@/components/Submissions/SubmissionsPage.vue', () => ({
	default: defineComponent({
		props: ['config', 'lockedFilters', 'canDelete'],
		setup(p, { slots }) {
			seen.push(p.config as Record<string, unknown>)
			seenCanDelete.push(p.canDelete)
			return () =>
				h('div', [
					...['Pass', 'Fail', 'Not Graded'].map((status) =>
						slots.cell?.({
							column: { key: 'status' },
							row: { status },
							value: status,
						})
					),
					slots.cell?.({
						column: { key: 'member_name' },
						row: { member_name: 'Ada' },
						value: 'Ada',
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
}))

import AssignmentSubmissions from '@/pages/AssignmentSubmissions.vue'

// A real memory router, not `mocks: { $router }`: the page calls useRouter(),
// which reads the injected router plugin and never looks at $router.
const Stub = defineComponent({ render: () => h('div') })

const makeRouter = (): Router =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/', name: 'Courses', component: Stub },
			{
				path: '/assignments/submissions',
				name: 'AssignmentSubmissions',
				component: Stub,
			},
		],
	})

const mountPage = async (userData: {
	is_instructor?: boolean
	is_moderator?: boolean
}) => {
	const router = makeRouter()
	await router.push('/assignments/submissions')
	await router.isReady()
	const wrapper = mount(AssignmentSubmissions, {
		global: {
			plugins: [router],
			mocks: { __: (text: string) => `t:${text}` },
			provide: {
				$user: { data: { name: 'a@b.c', ...userData } },
				$dayjs: () => ({ fromNow: () => 'today' }),
			},
		},
	})
	await flushPromises()
	return { wrapper, router }
}

beforeEach(() => {
	seen.length = 0
	seenCanDelete.length = 0
})

// Guards the assignment submissions list's config, translation split and gates.
// Came with this branch's shared submissions page for every assessment type.
// Added on feat/assessment-visual-redesign when the old list page was replaced.
describe('the assignment submissions page', () => {
	it('scopes the shared page to assignment submissions', async () => {
		await mountPage({ is_moderator: true })
		const config = seen[0] as { doctype: string; filters: { key: string }[] }
		expect(config.doctype).toBe('LMS Assignment Submission')
		expect(config.filters.map((f) => f.key)).toEqual([
			'assignment',
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
				'assignment',
				'assignment_title',
				'member_name',
				'creation',
				'status',
			])
		)
		expect(config.orderBy).toBe('creation desc')
	})

	it('routes a row at the submission under its assignment', async () => {
		await mountPage({ is_moderator: true })
		const config = seen[0] as {
			getRowRoute: (r: Record<string, unknown>) => Record<string, unknown>
		}
		expect(config.getRowRoute({ name: 'SUB-1', assignment: 'ASG-1' })).toEqual({
			name: 'AssignmentSubmission',
			params: { assignmentID: 'ASG-1', submissionName: 'SUB-1' },
		})
	})

	it('resolves the scope crumb back to the owning assignment', async () => {
		await mountPage({ is_moderator: true })
		const config = seen[0] as {
			scopeCrumb: {
				filterKey: string
				doctype: string
				titleField: string
				route: (v: string) => Record<string, unknown>
			}
		}
		expect(config.scopeCrumb.filterKey).toBe('assignment')
		expect(config.scopeCrumb.doctype).toBe('LMS Assignment')
		expect(config.scopeCrumb.titleField).toBe('title')
		expect(config.scopeCrumb.route('ASG-1')).toEqual({
			name: 'AssignmentForm',
			params: { assignmentID: 'ASG-1' },
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
		expect(config.pageTitle).toBe('Assignment Submissions')
		expect(config.emptyName).toBe('Assignment Submissions')
		expect(config.filters.map((f) => [f.key, f.placeholder])).toEqual([
			['assignment', 'Filter by Assignment'],
			['member', 'Filter by Member'],
			['status', 'Filter by Status'],
		])
	})

	// These reach the DOM verbatim, so this page translates them itself: the
	// opposite rule from title, pageTitle and placeholders.
	it('translates the parent crumb and column labels itself', async () => {
		await mountPage({ is_moderator: true })
		const config = seen[0] as {
			parentCrumb: { label: string }
			columns: { key: string; label: string }[]
		}
		expect(config.parentCrumb.label).toBe('t:Assignments')
		expect(
			Object.fromEntries(config.columns.map((c) => [c.key, c.label]))
		).toEqual({
			member_name: 't:Member',
			assignment_title: 't:Assignment',
			creation: 't:Submitted',
			status: 't:Status',
		})
	})

	it('draws every status as its own themed badge, and other cells plain', async () => {
		const { wrapper } = await mountPage({ is_moderator: true })
		const badges = wrapper.findAll('[data-theme]')
		expect(badges).toHaveLength(3)
		expect(badges.map((b) => [b.attributes('data-theme'), b.text()])).toEqual([
			['green', 'Pass'],
			['red', 'Fail'],
			['blue', 'Not Graded'],
		])

		expect(wrapper.text()).toContain('Ada')
		expect(
			wrapper.findAll('[data-theme]').some((b) => b.text() === 'Ada')
		).toBe(false)
	})

	it('turns a raw creation timestamp into a relative one via transform', async () => {
		await mountPage({ is_moderator: true })
		const config = seen[0] as {
			transform: (rows: Record<string, unknown>[]) => Record<string, unknown>[]
		}
		const out = config.transform([
			{ name: 'SUB-1', creation: '2026-01-01 00:00:00' },
		])
		expect(out).toEqual([{ name: 'SUB-1', creation: 'today' }])
	})

	it('lets a moderator stay, and an instructor stay, on the page', async () => {
		const { router: modRouter } = await mountPage({ is_moderator: true })
		expect(modRouter.currentRoute.value.name).toBe('AssignmentSubmissions')

		const { router: instrRouter } = await mountPage({ is_instructor: true })
		expect(instrRouter.currentRoute.value.name).toBe('AssignmentSubmissions')
	})

	// SubmissionsPage has no role guard of its own; this page's is the only one.
	it('redirects a plain member away before the list ever shows', async () => {
		const { router } = await mountPage({})
		expect(router.currentRoute.value.name).toBe('Courses')
	})

	// DocPerm grants delete to Moderator and System Manager only, so an
	// instructor's delete would fail every row behind a sticky error toast.
	it('offers delete to a moderator and withholds it from an instructor', async () => {
		await mountPage({ is_moderator: true })
		expect(seenCanDelete).toEqual([true])

		seenCanDelete.length = 0
		await mountPage({ is_instructor: true })
		expect(seenCanDelete).toEqual([false])
	})
})
