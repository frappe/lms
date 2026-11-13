/**
 * A second click on Post while the first is still saving used to post the
 * reply, or the new topic, twice.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const { call } = vi.hoisted(() => ({ call: vi.fn() }))

vi.mock('frappe-ui', () => ({
	call,
	createResource: () => ({ data: [], reload: vi.fn() }),
	Button: {
		props: ['loading'],
		emits: ['click'],
		template:
			'<button :disabled="loading" @click="$emit(\'click\')"><slot /></button>',
	},
	Dropdown: { template: '<div />' },
	Dialog: { props: ['actions'], template: '<div><slot /></div>' },
	FormControl: { template: '<input />' },
	toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('frappe-ui/experimental', () => ({
	InputLabel: { template: '<label />' },
}))
vi.mock('@/components/UserAvatar.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/RichTextEditor.vue', () => ({
	default: { emits: ['change'], template: '<div data-testid="editor" />' },
}))
vi.mock('@/utils', () => ({
	timeAgo: () => 'now',
	singularize: (s: string) => s,
}))
vi.mock('@framework/ui/telemetry/index', () => ({
	useTelemetry: () => ({ capture: vi.fn() }),
}))

vi.stubGlobal('__', (s: string) => s)

const global = {
	provide: {
		$socket: { on: vi.fn(), off: vi.fn() },
		$user: { data: { name: 'student', is_student: true } },
		$allUsers: { reload: vi.fn() },
	},
	mocks: { __: (s: string) => s },
}

beforeEach(() => {
	call.mockReset()
})

describe('posting a discussion reply', () => {
	it('posts once however often Post is clicked while it saves', async () => {
		let resolve: (value: unknown) => void = () => {}
		call.mockReturnValue(new Promise((r) => (resolve = r)))
		const wrapper = mount(
			(await import('@/components/DiscussionReplies.vue')).default,
			{
				props: {
					topic: { name: 'T1', title: 'A question' },
					doctype: 'LMS Batch',
					docname: 'batch-1',
				},
				global,
			}
		)
		await flushPromises()
		const RichTextEditor = (await import('@/components/RichTextEditor.vue'))
			.default
		wrapper.findComponent(RichTextEditor as any).vm.$emit('change', '<p>Hi</p>')
		const post = wrapper.findAll('button').at(-1)!

		await post.trigger('click')
		await post.trigger('click')
		expect(call).toHaveBeenCalledTimes(1)

		resolve({ name: 'R1' })
		await flushPromises()
		expect(post.attributes('disabled')).toBeUndefined()
	})
})

describe('posting a new topic', () => {
	it("hands the Dialog a promise, so Post stays loading until it's saved", async () => {
		call.mockResolvedValue({ name: 'T1' })
		const wrapper = mount(
			(await import('@/components/Modals/DiscussionModal.vue')).default,
			{
				props: {
					title: 'Questions',
					doctype: 'LMS Batch',
					docname: 'batch-1',
					modelValue: true,
					reloadTopics: { reload: vi.fn() },
				},
				global,
			}
		)
		const { topic } = (wrapper.vm as unknown as { $: { setupState: any } }).$
			.setupState
		topic.title = 'A title'
		topic.reply = '<p>Hi</p>'
		const { Dialog } = await import('frappe-ui')
		const [post] = wrapper.findComponent(Dialog as any).props('actions')
		const close = vi.fn()

		const pending = post.onClick({ close })
		expect(pending).toBeInstanceOf(Promise)
		await pending
		expect(call).toHaveBeenCalledTimes(2)
		expect(close).toHaveBeenCalled()
	})
})
