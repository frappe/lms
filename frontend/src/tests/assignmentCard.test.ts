// Guards the assignment card: skeleton, brief, and the per-type answer input.
// Came with this branch's assignment block restyle as an assessment card.
// Added on feat/assessment-visual-redesign to pin the card's states.
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive } from 'vue'

const state = vi.hoisted(() => ({
	assignment: null as Record<string, unknown> | null,
	loading: false,
	submission: null as { doc: Record<string, unknown> | null } | null,
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
		Alert: defineComponent({
			props: ['title'],
			setup: (props) => () => h('div', props.title),
		}),
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
			props: ['placeholder', 'modelValue', 'disabled'],
			setup: (props) => () =>
				h('input', {
					'data-testid': 'url-input',
					placeholder: props.placeholder,
					value: props.modelValue,
					disabled: props.disabled,
				}),
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
		createDocumentResource: () => {
			const resource = reactive({
				doc: null as Record<string, unknown> | null,
				reload: vi.fn(),
				setValue: { submit: vi.fn() },
			})
			state.submission = resource
			return resource
		},
	}
})

vi.mock('@/router', () => ({
	default: {
		push: vi.fn(),
		currentRoute: { value: { name: 'Lesson', query: {} } },
	},
}))
vi.mock('@/components/RichTextEditor.vue', () => ({
	default: defineComponent({
		props: ['content', 'editable'],
		setup: (props) => () =>
			h('div', {
				'data-testid': 'text-answer',
				'data-editable': String(props.editable),
				innerHTML: props.content,
			}),
	}),
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

const learner = { name: 'learner@example.com' }
const evaluator = { name: 'evaluator@example.com', is_evaluator: true }

const mountAssignment = async (
	user: Record<string, unknown> = learner,
	submission?: Record<string, unknown>
) => {
	const wrapper = mount(Assignment, {
		props: {
			assignmentID: 'ASG-1',
			showTitle: false,
			submissionName: submission ? 'SUB-1' : 'new',
		},
		global: {
			provide: { $user: { data: user } },
			mocks: { __: translate },
		},
	})
	if (submission && state.submission) state.submission.doc = submission
	await flushPromises()
	return wrapper
}

const ended = {
	enable_scheduling: 1,
	schedule_end: '2020-01-01T00:00:00Z',
}

const learnerSubmission = (fields: Record<string, unknown>) => ({
	name: 'SUB-1',
	owner: learner.name,
	status: 'Not Graded',
	...fields,
})

beforeEach(() => {
	state.assignment = null
	state.loading = false
	state.submission = null
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

	it("shows an evaluator the learner's attachment, without upload or remove", async () => {
		state.assignment = { title: 'Report', type: 'PDF', question: '<p>Q</p>' }
		const wrapper = await mountAssignment(
			evaluator,
			learnerSubmission({ assignment_attachment: '/private/files/report.pdf' })
		)

		const file = wrapper.get('[data-testid="assignment-attachment"]')
		expect(file.text()).toContain('report.pdf')
		expect(file.find('button').exists()).toBe(false)
		expect(wrapper.find('[data-testid="assignment-dropzone"]').exists()).toBe(
			false
		)
	})

	it('shows an evaluator no empty drop zone when nothing was attached', async () => {
		state.assignment = { title: 'Report', type: 'PDF', question: '<p>Q</p>' }
		const wrapper = await mountAssignment(evaluator, learnerSubmission({}))

		expect(wrapper.find('[data-testid="assignment-attachment"]').exists()).toBe(
			false
		)
		expect(wrapper.find('[data-testid="assignment-dropzone"]').exists()).toBe(
			false
		)
	})

	it('still shows the URL answer read-only after the schedule ended', async () => {
		state.assignment = {
			title: 'Portfolio',
			type: 'URL',
			question: '<p>Q</p>',
			...ended,
		}
		const wrapper = await mountAssignment(
			evaluator,
			learnerSubmission({ answer: 'https://example.com/repo' })
		)

		const input = wrapper.get('[data-testid="url-input"]')
		expect((input.element as HTMLInputElement).value).toBe(
			'https://example.com/repo'
		)
		expect(input.attributes('disabled')).toBeDefined()
	})

	it('still shows the text answer read-only after the schedule ended', async () => {
		state.assignment = {
			title: 'Essay',
			type: 'Text',
			question: '<p>Q</p>',
			...ended,
		}
		const wrapper = await mountAssignment(
			evaluator,
			learnerSubmission({ answer: '<p>My essay</p>' })
		)

		const answer = wrapper.get('[data-testid="text-answer"]')
		expect(answer.text()).toBe('My essay')
		expect(answer.attributes('data-editable')).toBe('false')
	})

	it('shows only the schedule message to a learner with no submission', async () => {
		state.assignment = {
			title: 'Portfolio',
			type: 'URL',
			question: '<p>Q</p>',
			...ended,
		}
		const wrapper = await mountAssignment()

		expect(wrapper.text()).toContain(
			'The schedule for this assignment has ended.'
		)
		expect(wrapper.find('[data-testid="url-input"]').exists()).toBe(false)
	})
})
