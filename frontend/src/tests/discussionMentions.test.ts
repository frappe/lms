/**
 * The @ menu in a discussion lists the people of that lesson or batch, asked
 * for by context, and stores the username as the mention id. The list shows
 * the username next to the name so two people of one name can be told apart.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const { allUsers } = vi.hoisted(() => ({
	allUsers: { reload: vi.fn() },
}))

vi.mock('frappe-ui', () => ({
	call: vi.fn(),
	createResource: () => ({ data: [], reload: vi.fn() }),
	Button: { template: '<button><slot /></button>' },
	Dropdown: { template: '<div />' },
	toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('@/components/UserAvatar.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/RichTextEditor.vue', () => ({
	default: { props: ['mentions', 'content'], template: '<div data-testid="editor" />' },
}))
vi.mock('@/utils', () => ({ timeAgo: () => 'now' }))
vi.mock('@framework/ui/telemetry/index', () => ({
	useTelemetry: () => ({ capture: vi.fn() }),
}))

vi.stubGlobal('__', (s: string) => s)
// @ts-expect-error augmenting String for the test runtime
String.prototype.format = function (...args: unknown[]) {
	return this.replace(/\{(\d+)\}/g, (_: string, i: number) => String(args[i]))
}

const mountReplies = async () =>
	mount((await import('@/components/DiscussionReplies.vue')).default, {
		props: {
			topic: { name: 'T1', title: 'A question' },
			doctype: 'LMS Batch',
			docname: 'batch-1',
		},
		global: {
			provide: {
				$socket: { on: vi.fn(), off: vi.fn() },
				$user: { data: { name: 'mod', is_student: false } },
				$allUsers: allUsers,
			},
			mocks: { __: (s: string) => s },
		},
	})

describe('discussion mentions', () => {
	beforeEach(() => {
		allUsers.reload.mockReset()
	})

	it('asks for the people of the lesson or batch', async () => {
		await mountReplies()
		expect(allUsers.reload.mock.calls[0][0]).toEqual({
			doctype: 'LMS Batch',
			docname: 'batch-1',
		})
	})

	it('stores the username and shows it next to the name', async () => {
		const wrapper = await mountReplies()
		const { onSuccess } = allUsers.reload.mock.calls[0][1]
		onSuccess({
			jane_doe: { username: 'jane_doe', full_name: 'Jane Doe', user_image: null },
			jane_d: { username: 'jane_d', full_name: 'Jane Doe', user_image: null },
		})
		await flushPromises()
		const RichTextEditor = (await import('@/components/RichTextEditor.vue')).default
		const mentions = wrapper.findComponent(RichTextEditor as any).props('mentions')
		expect(mentions).toEqual([
			{ value: 'jane_doe', label: 'Jane Doe' },
			{ value: 'jane_d', label: 'Jane Doe' },
		])
		expect(JSON.stringify(mentions)).not.toContain('@example.com')
	})

	it('does not ask for a list as a student', async () => {
		mount((await import('@/components/DiscussionReplies.vue')).default, {
			props: { topic: { name: 'T1' }, doctype: 'Course Lesson', docname: 'L1' },
			global: {
				provide: {
					$socket: { on: vi.fn(), off: vi.fn() },
					$user: { data: { name: 'stu', is_student: true } },
					$allUsers: allUsers,
				},
				mocks: { __: (s: string) => s },
			},
		})
		expect(allUsers.reload).not.toHaveBeenCalled()
	})
})
