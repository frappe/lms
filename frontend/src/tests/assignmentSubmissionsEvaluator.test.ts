import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h } from 'vue'

// A TA (Batch Evaluator) grades assignments through the submissions list, as
// on the quiz and exercise ones; the server scopes the rows to the batches and
// courses they evaluate. Kept apart from upstream's assignmentSubmissions.test.ts
// (FORK_GUIDELINES.md, section 1).

vi.stubGlobal('__', (text: string) => text)

const seenCanDelete: unknown[] = []

vi.mock('@/utils/dayjs', () => ({
	serverTime: () => ({ fromNow: () => 'today' }),
}))

vi.mock('@/components/Submissions/SubmissionsPage.vue', () => ({
	default: defineComponent({
		props: ['config', 'canDelete'],
		setup(p) {
			seenCanDelete.push(p.canDelete)
			return () => h('div')
		},
	}),
}))

vi.mock('frappe-ui', () => ({
	Badge: defineComponent({ render: () => h('span') }),
	Button: defineComponent({ render: () => h('button') }),
	Dropdown: defineComponent({ render: () => h('div') }),
}))

import AssignmentSubmissions from '@/pages/AssignmentSubmissions.vue'

const Stub = defineComponent({ render: () => h('div') })

const mountAs = async (userData: Record<string, boolean>) => {
	const router = createRouter({
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
	await router.push('/assignments/submissions')
	await router.isReady()
	mount(AssignmentSubmissions, {
		global: {
			plugins: [router],
			provide: { $user: { data: { name: 'ta@b.c', ...userData } } },
		},
	})
	await flushPromises()
	return router
}

beforeEach(() => {
	seenCanDelete.length = 0
})

describe('the assignment submissions page for an evaluator', () => {
	it('lets an evaluator stay on the page', async () => {
		const router = await mountAs({ is_evaluator: true })
		expect(router.currentRoute.value.name).toBe('AssignmentSubmissions')
	})

	// DocPerm gives Batch Evaluator no delete on LMS Assignment Submission.
	it('withholds delete from an evaluator', async () => {
		await mountAs({ is_evaluator: true })
		expect(seenCanDelete).toEqual([false])
	})
})
