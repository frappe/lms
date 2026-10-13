// Guards the assignment card: skeleton, brief, and the per-type answer input.
// Came with this branch's assignment block restyle as an assessment card.
// Added on feat/assessment-visual-redesign to pin the card's states.
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive } from 'vue'

const state = vi.hoisted(() => ({
	assignment: null as Record<string, unknown> | null,
	loading: false,
}))

vi.mock('frappe-ui', () => {
	const passthrough = (tag: string) =>
		defineComponent({
			inheritAttrs: true,
			setup:
				(_p, { slots }) =>
				() =>
					h(tag, slots.default?.()),
		})
	return {
		Badge: passthrough('span'),
		Button: defineComponent({
			setup:
				(_p, { slots }) =>
				() =>
					h('button', [slots.icon?.(), slots.default?.()]),
		}),
		FileUploader: defineComponent({
			setup:
				(_p, { slots }) =>
				() =>
					h(
						'div',
						slots.default?.({
							uploading: false,
							progress: 0,
							openFileSelector: () => {},
						})
					),
		}),
		FormControl: defineComponent({
			props: ['placeholder'],
			setup: (props) => () =>
				h('input', { 'data-testid': 'url-input', ...props }),
		}),
		Skeleton: defineComponent({ render: () => h('div') }),
		Tooltip: passthrough('div'),
		KeyboardShortcut: passthrough('span'),
		call: vi.fn(),
		toast: { error: vi.fn(), success: vi.fn() },
		createResource: () =>
			reactive({
				data: state.assignment,
				loading: state.loading,
				reload: vi.fn(),
			}),
		createDocumentResource: () =>
			reactive({ doc: null, reload: vi.fn(), setValue: { submit: vi.fn() } }),
	}
})

vi.mock('@/router', () => ({
	default: {
		push: vi.fn(),
		currentRoute: { value: { name: 'Lesson', query: {} } },
	},
}))
vi.mock('@/components/RichTextEditor.vue', () => ({
	default: defineComponent({ render: () => h('div') }),
}))
vi.mock('@/utils', () => ({ validateFile: vi.fn() }))

import Assignment from '@/components/Assignment.vue'

const translate = (message: string) => {
	if (!/{\d+}/.test(message)) return message
	return {
		format: (...args: unknown[]) =>
			message.replace(/{(\d+)}/g, (_m, i) => String(args[Number(i)])),
	}
}

const mountAssignment = async () => {
	const wrapper = mount(Assignment, {
		props: { assignmentID: 'ASG-1', showTitle: false },
		global: {
			provide: { $user: { data: { name: 'learner@example.com' } } },
			mocks: { __: translate },
		},
	})
	await flushPromises()
	return wrapper
}

beforeEach(() => {
	state.assignment = null
	state.loading = false
})

describe('the assignment card', () => {
	it('shows a skeleton card while the assignment loads', async () => {
		state.loading = true
		const wrapper = await mountAssignment()

		expect(wrapper.find('[data-testid="assignment-skeleton"]').exists()).toBe(
			true
		)
		expect(wrapper.text()).toContain('Assignment')
	})

	it('renders the brief and a drop zone for a file assignment', async () => {
		state.assignment = {
			title: 'Temperature Converter',
			type: 'PDF',
			question: '<p>Convert Celsius.</p>',
		}
		const wrapper = await mountAssignment()

		expect(wrapper.find('[data-testid="assignment-skeleton"]').exists()).toBe(
			false
		)
		expect(wrapper.text()).toContain('Temperature Converter')
		expect(wrapper.text()).toContain('Brief')
		expect(wrapper.text()).toContain('Convert Celsius.')
		expect(wrapper.find('[data-testid="assignment-dropzone"]').exists()).toBe(
			true
		)
		expect(wrapper.find('[data-testid="url-input"]').exists()).toBe(false)
		const labels = wrapper.findAll('button').map((b) => b.text())
		expect(labels).toContain('Submit')
		expect(labels).not.toContain('Save')
	})

	it('draws the drop zone with the artboard 10px corners', async () => {
		state.assignment = {
			title: 'Temperature Converter',
			type: 'PDF',
			question: '<p>Convert Celsius.</p>',
		}
		const wrapper = await mountAssignment()

		const zone = wrapper.get('[data-testid="assignment-dropzone"]')
		expect(zone.classes()).toContain('rounded-5')
		expect(zone.classes()).toContain('border-outline-gray-2')
	})

	it('renders only the URL input for a URL assignment', async () => {
		state.assignment = {
			title: 'Portfolio',
			type: 'URL',
			question: '<p>Link your repo.</p>',
		}
		const wrapper = await mountAssignment()

		expect(wrapper.find('[data-testid="url-input"]').exists()).toBe(true)
		expect(wrapper.find('[data-testid="assignment-dropzone"]').exists()).toBe(
			false
		)
	})
})
