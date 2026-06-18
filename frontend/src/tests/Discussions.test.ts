/**
 * Discussions.vue — master-detail layout (issue #2045 item 14).
 *
 * Key regression guard: selecting a topic must NOT hide the topic list (the old
 * behavior toggled `showTopics` and replaced the list with the thread). In the
 * master-detail layout the list stays rendered, the selected topic's thread
 * renders alongside it, and the selected row is marked.
 */
import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import Discussions from '@/components/Discussions.vue'

const TOPICS = [
	{
		name: 'T1',
		title: 'First question',
		owner: 'a@b.c',
		creation: '2026-01-01',
		user: { full_name: 'A', user_image: '' },
		reply_count: 2,
	},
	{
		name: 'T2',
		title: 'Second question',
		owner: 'd@e.f',
		creation: '2026-01-02',
		user: { full_name: 'D', user_image: '' },
		reply_count: 0,
	},
]

// frappe-ui's internal module resolution doesn't work under vitest; stub the
// pieces Discussions uses.
vi.mock('frappe-ui', () => ({
	Button: { template: '<button><slot /></button>' },
	createResource: () => ({ data: TOPICS, reload: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('@/components/DiscussionReplies.vue', () => ({
	default: {
		props: ['topic', 'showTopics', 'singleThread'],
		template: `<div data-testid="thread">{{ topic?.title }}</div>`,
	},
}))
vi.mock('@/components/Modals/DiscussionModal.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/UserAvatar.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/utils', () => ({ singularize: (s: string) => s, timeAgo: () => 'now' }))
vi.mock('@/utils/scrollContainer', () => ({
	getScrollContainer: () => ({ scrollTop: 0, scrollHeight: 0 }),
}))

// `__` and String.format are frappe globals used in <script>/template.
vi.stubGlobal('__', (s: string) => s)
// @ts-expect-error augmenting String for the test runtime
String.prototype.format = function (...args: unknown[]) {
	return this.replace(/\{(\d+)\}/g, (_: string, i: number) => String(args[i]))
}

const mountDiscussions = () =>
	mount(Discussions, {
		props: { title: 'Questions', doctype: 'Course Lesson', docname: 'L1' },
		global: {
			provide: {
				$socket: { on: vi.fn(), off: vi.fn() },
				$user: { data: { name: 'a@b.c' } },
			},
			mocks: { __: (s: string) => s },
		},
	})

describe('Discussions master-detail', () => {
	it('renders all topic rows', async () => {
		const wrapper = mountDiscussions()
		await flushPromises()
		expect(wrapper.findAll('[data-testid="topic-row"]')).toHaveLength(2)
	})

	it('keeps the list visible and shows the thread when a topic is selected', async () => {
		const wrapper = mountDiscussions()
		await flushPromises()
		await wrapper.findAll('[data-testid="topic-row"]')[0].trigger('click')
		// list still present (the regression guard) ...
		expect(wrapper.findAll('[data-testid="topic-row"]')).toHaveLength(2)
		// ... and the thread for the selected topic is shown
		expect(wrapper.get('[data-testid="thread"]').text()).toBe('First question')
	})

	it('marks the selected row', async () => {
		const wrapper = mountDiscussions()
		await flushPromises()
		const rows = wrapper.findAll('[data-testid="topic-row"]')
		await rows[0].trigger('click')
		expect(rows[0].classes()).toContain('bg-surface-gray-2')
		expect(rows[1].classes()).not.toContain('bg-surface-gray-2')
	})
})
