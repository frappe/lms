// Guards the inline lesson assignment: no route push, grading or fixed height.
// Came with this branch's change rendering the lesson's assignment inline.
// Added on feat/assessment-visual-redesign; the old 500px iframe did all three.
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive } from 'vue'

const { call, setValue, routerPush, currentRoute, documentCache } = vi.hoisted(
	() => ({
		documentCache: new Map<string, unknown>(),
		call: vi.fn(),
		setValue: vi.fn(),
		routerPush: vi.fn(),
		currentRoute: { value: { name: 'AssignmentSubmission', query: {} } },
	})
)

vi.mock('frappe-ui', () => {
	const passthrough = (tag: string) =>
		defineComponent({
			setup:
				(_p, { slots }) =>
				() =>
					h(tag, slots.default?.()),
		})
	return {
		Alert: passthrough('div'),
		Badge: passthrough('span'),
		Button: defineComponent({
			emits: ['click'],
			setup:
				(_p, { slots, emit }) =>
				() =>
					h('button', { onClick: () => emit('click') }, [
						slots.icon?.(),
						slots.default?.(),
					]),
		}),
		FileUploader: passthrough('div'),
		FormControl: defineComponent({
			props: ['modelValue', 'label'],
			emits: ['update:modelValue'],
			setup:
				(props, { emit }) =>
				() =>
					h('input', {
						'data-testid': 'control',
						'data-label': props.label,
						value: props.modelValue,
						onInput: (e: Event) =>
							emit('update:modelValue', (e.target as HTMLInputElement).value),
					}),
		}),
		Skeleton: passthrough('div'),
		Tooltip: passthrough('div'),
		KeyboardShortcut: passthrough('span'),
		call: (...args: unknown[]) => call(...args),
		toast: { error: vi.fn(), success: vi.fn() },
		createResource: () =>
			reactive({
				data: { title: 'Portfolio', type: 'URL', question: '<p>Link.</p>' },
				loading: false,
				reload: vi.fn(),
			}),
		// Cached by name, as frappe-ui's documentResource.js does.
		createDocumentResource: (options: { name: string }) => {
			if (documentCache.has(options.name))
				return documentCache.get(options.name)
			const resource = reactive({
				name: options.name,
				doc: null as Record<string, unknown> | null,
				reload: () => {},
				setValue: { submit: setValue },
			})
			resource.reload = () => {
				resource.doc = {
					name: resource.name,
					owner: 'learner@example.com',
					status: 'Not Graded',
					answer: 'https://example.com/one',
				}
			}
			documentCache.set(options.name, resource)
			return resource
		},
	}
})

vi.mock('frappe-ui/experimental', () => ({
	InputLabel: defineComponent({ render: () => h('label') }),
}))
vi.mock('@/router', () => ({
	default: { push: routerPush, currentRoute },
}))
vi.mock('@/components/RichTextEditor.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))
vi.mock('@/utils', () => ({ validateFile: vi.fn() }))

import Assignment from '@/components/Assignment.vue'

const moderator = {
	data: { name: 'learner@example.com', is_moderator: true },
}

const mountAssignment = async (
	props: Record<string, unknown>,
	user: unknown = { data: { name: 'learner@example.com' } }
) => {
	const wrapper = mount(Assignment, {
		props: { assignmentID: 'ASG-1', showTitle: false, ...props },
		global: {
			provide: { $user: user },
			mocks: { __: (message: string) => message },
		},
	})
	await flushPromises()
	return wrapper
}

const save = async (wrapper: Awaited<ReturnType<typeof mountAssignment>>) => {
	const button = wrapper
		.findAll('button')
		.find((b) => ['Submit', 'Save'].includes(b.text()))
	await button!.trigger('click')
	await flushPromises()
}

beforeEach(() => {
	documentCache.clear()
	call.mockReset()
	call.mockResolvedValue({ name: 'SUB-1' })
	setValue.mockReset()
	routerPush.mockReset()
})

describe('the assignment mounted inline in a lesson', () => {
	it('updates the submission on the second save instead of inserting another', async () => {
		const wrapper = await mountAssignment({ embedded: true })
		await wrapper.get('[data-testid="control"]').setValue('https://a.dev')

		await save(wrapper)
		await save(wrapper)

		const inserts = call.mock.calls.filter(
			([method]) => method === 'frappe.client.insert'
		)
		expect(inserts).toHaveLength(1)
		expect(setValue).toHaveBeenCalledTimes(1)
	})

	// Guards unsaved cards sharing frappe-ui's cached 'new' resource, so saving
	// one filled the others. Broke with this branch's inline assignment rendering.
	// Added on feat/assessment-visual-redesign when a lesson could hold several.
	it("keeps a second unsubmitted card's answer out of the first card's save", async () => {
		const first = await mountAssignment({ embedded: true })
		const second = await mountAssignment({ embedded: true })
		await first.get('[data-testid="control"]').setValue('https://a.dev')

		await save(first)

		const secondAnswer = second.get('[data-testid="control"]').element
		expect((secondAnswer as HTMLInputElement).value).toBe('')
	})

	it('never moves the lesson to another route', async () => {
		const wrapper = await mountAssignment({ embedded: true })
		await wrapper.get('[data-testid="control"]').setValue('https://a.dev')

		await save(wrapper)

		expect(routerPush).not.toHaveBeenCalled()
	})

	it('still opens the new submission on the standalone page', async () => {
		const wrapper = await mountAssignment({ embedded: false })
		await wrapper.get('[data-testid="control"]').setValue('https://a.dev')

		await save(wrapper)

		expect(routerPush).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'AssignmentSubmission',
				params: { assignmentID: 'ASG-1', submissionName: 'SUB-1' },
			})
		)
	})

	it('shows no grading form to an instructor inside a lesson', async () => {
		const wrapper = await mountAssignment(
			{ embedded: true, submissionName: 'SUB-1' },
			moderator
		)

		expect(wrapper.text()).not.toContain('Grading')
	})

	it('keeps grading on the standalone submission page', async () => {
		const wrapper = await mountAssignment(
			{ embedded: false, submissionName: 'SUB-1' },
			moderator
		)

		expect(wrapper.text()).toContain('Grading')
	})

	it('takes its natural height inside a lesson', async () => {
		const wrapper = await mountAssignment({ embedded: true })

		expect(wrapper.classes()).not.toContain('h-full')
		expect(wrapper.classes()).not.toContain('overflow-y-auto')
	})
})
