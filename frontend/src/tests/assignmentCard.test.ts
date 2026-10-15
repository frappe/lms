import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive } from 'vue'

const state = vi.hoisted(() => ({
	assignment: null as Record<string, unknown> | null,
	submission: null as { doc: Record<string, unknown> | null } | null,
}))

vi.mock('frappe-ui', () => {
	const passthrough = (tag: string) =>
		defineComponent({
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
						{ 'data-testid': 'file-uploader' },
						slots.default?.({
							uploading: false,
							progress: 0,
							openFileSelector: () => {},
						})
					),
		}),
		FormControl: defineComponent({
			props: ['modelValue', 'disabled'],
			setup: (props) => () =>
				h('input', {
					'data-testid': 'url-input',
					value: props.modelValue,
					disabled: props.disabled,
				}),
		}),
		Tooltip: passthrough('div'),
		call: vi.fn(),
		toast: { error: vi.fn(), success: vi.fn() },
		createResource: () =>
			reactive({
				data: state.assignment,
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

vi.mock('vue-router', () => ({
	useRouter: () => ({
		push: vi.fn(),
		currentRoute: { value: { name: 'Lesson', query: {} } },
	}),
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
	state.submission = null
})

describe('the assignment card', () => {
	it("shows an evaluator the learner's attachment, without upload or remove", async () => {
		state.assignment = { title: 'Report', type: 'PDF', question: '<p>Q</p>' }
		const wrapper = await mountAssignment(
			evaluator,
			learnerSubmission({ assignment_attachment: '/private/files/report.pdf' })
		)

		const file = wrapper.get('a[href="/private/files/report.pdf"]')
		expect(file.text()).toContain('report.pdf')
		expect(wrapper.find('[aria-label="Remove submission"]').exists()).toBe(
			false
		)
		expect(wrapper.find('[data-testid="file-uploader"]').exists()).toBe(false)
		expect(wrapper.text()).not.toContain('Upload Assignment')
	})

	it('shows an evaluator no empty upload box when nothing was attached', async () => {
		state.assignment = { title: 'Report', type: 'PDF', question: '<p>Q</p>' }
		const wrapper = await mountAssignment(evaluator, learnerSubmission({}))

		expect(wrapper.find('a[href]').exists()).toBe(false)
		expect(wrapper.find('[data-testid="file-uploader"]').exists()).toBe(false)
		expect(wrapper.text()).not.toContain('Upload Assignment')
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
