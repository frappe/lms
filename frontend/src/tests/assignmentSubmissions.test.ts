import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { defineComponent, h } from 'vue'
import type { SubmissionsConfig } from '@/types'

// Non-identity translator: a double-translated string shows up as 't:t:...',
// which an identity stub would hide.
vi.stubGlobal('__', (text: string) => `t:${text}`)

const seenCanDelete: unknown[] = []

vi.mock('@/utils/dayjs', () => ({
	serverTime: () => ({ fromNow: () => 'today' }),
}))

vi.mock('@/components/Submissions/SubmissionsPage.vue', () => ({
	default: defineComponent({
		props: ['config', 'lockedFilters', 'canDelete'],
		setup(p, { slots }) {
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
			},
		},
	})
	await flushPromises()
	return { wrapper, router }
}

beforeEach(() => {
	seenCanDelete.length = 0
})

// Guards the assignment submissions list's config, translation split and gates.
// Came with this branch's shared submissions page for every assessment type.
// Added on feat/assessment-visual-redesign when the old list page was replaced.
describe('the assignment submissions page', () => {
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
