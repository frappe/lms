// Guards assessment blocks in the lesson editor rendering as a static summary card.
// Came with this branch's lesson editor block preview (was a grey notice).
// Added on feat/assessment-visual-redesign so the editor loads no learner component.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { App } from 'vue'

type Call = { method: string; args: Record<string, unknown> }

const { calls, received, recorder, responses, hold } = vi.hoisted(() => {
	const received: Record<string, Record<string, unknown>> = {}
	// Records the props it was mounted with, as attrs, and renders a marker.
	const recorder = (name: string) => ({
		inheritAttrs: false,
		setup(_props: unknown, { attrs }: { attrs: Record<string, unknown> }) {
			received[name] = { ...attrs }
			return {}
		},
		template: `<div data-testid="${name}" />`,
	})
	return {
		calls: [] as Call[],
		received,
		recorder,
		responses: {} as Record<string, unknown>,
		hold: { pending: false },
	}
})

vi.mock('frappe-ui', async (importOriginal) => ({
	...(await importOriginal<typeof import('frappe-ui')>()),
	call: (method: string, args: Record<string, unknown>) => {
		calls.push({ method, args })
		if (hold.pending) return new Promise(() => {})
		const doc = responses[String(args?.doctype)]
		return doc === 'missing'
			? Promise.reject(new Error('DoesNotExistError'))
			: Promise.resolve(doc ?? null)
	},
}))
vi.mock('@/stores/user', () => ({
	usersStore: () => ({
		userResource: { data: { name: 'author@example.com' } },
	}),
}))
vi.mock('@/stores/settings', () => ({ useSettings: () => ({}) }))
vi.mock('@/router', () => ({ default: { push: vi.fn() } }))
vi.mock('@/components/AssessmentPlugin.vue', () => ({ default: {} }))
vi.mock('@/components/Modals/ProgrammingExerciseModal.vue', () => ({
	default: {},
}))

vi.mock('@/components/QuizBlock.vue', () => ({ default: recorder('quiz') }))
vi.mock('@/components/Assignment.vue', () => ({
	default: recorder('assignment'),
}))
vi.mock(
	'@/pages/ProgrammingExercises/ProgrammingExerciseSubmission.vue',
	() => ({ default: recorder('exercise') })
)

import { mountBlock } from '@/utils/blockMount'
import { Quiz } from '@/utils/quiz'
import { Assignment } from '@/utils/assignment'
import { Program } from '@/utils/program'

type Tool = { render: () => HTMLDivElement; destroy: () => void }
let tools: Tool[] = []

const renderInEditor = async (tool: Tool) => {
	tools.push(tool)
	const wrapper = tool.render()
	document.body.append(wrapper)
	await new Promise((resolve) => setTimeout(resolve, 0))
	return wrapper
}

const quizTool = () =>
	new Quiz({ data: { quiz: 'weekly-quiz' }, readOnly: false })
const assignmentTool = () =>
	new Assignment({ data: { assignment: 'ASG-1' }, readOnly: false })
const exerciseTool = () =>
	new Program({ data: { exercise: 'EX-1' }, api: {}, readOnly: false })

beforeEach(() => {
	Object.assign(window, { translatedMessages: {} })
	calls.length = 0
	hold.pending = false
	for (const key of Object.keys(received)) delete received[key]
	Object.assign(responses, {
		'LMS Quiz': {
			name: 'weekly-quiz',
			title: 'Weekly quiz',
			duration: '15',
			passing_percentage: 70,
			max_attempts: 3,
			questions: [
				{ question: 'Q-1', type: 'Choices' },
				{ question: 'Q-2', type: 'Choices' },
			],
		},
		'LMS Assignment': {
			title: 'Weekly essay',
			question: '<p>Write about your week.</p>',
			type: 'PDF',
		},
		'LMS Programming Exercise': {
			title: 'FizzBuzz',
			problem_statement: '<p>Print the numbers.</p>',
			language: 'Python',
		},
	})
})

afterEach(() => {
	for (const tool of tools) tool.destroy()
	tools = []
	document.body.replaceChildren()
})

const expectPreview = (wrapper: HTMLDivElement) => {
	expect(wrapper.hasAttribute('inert')).toBe(true)
	expect(wrapper.hasAttribute('data-assessment-block')).toBe(true)
	expect(wrapper.textContent).toContain('Preview only')
	expect(Object.keys(received)).toEqual([])
}

describe('assessment blocks in the lesson editor', () => {
	it('summarises the quiz from one read of the quiz itself', async () => {
		const wrapper = await renderInEditor(quizTool())

		expectPreview(wrapper)
		expect(calls).toEqual([
			{
				method: 'frappe.client.get',
				args: { doctype: 'LMS Quiz', name: 'weekly-quiz' },
			},
		])
		const text = wrapper.textContent ?? ''
		expect(text).toContain('Weekly quiz')
		expect(text).toContain(
			'Multiple choice\u2002·\u20022 questions\u2002·\u2002pass at 70%'
		)
		expect(text).toContain('15 min')
		expect(text).toContain('3 attempts allowed')
		expect(text).not.toContain('left')
		expect(wrapper.querySelector('table, [role="table"]')).toBeNull()
		const start = Array.from(wrapper.querySelectorAll('button')).find(
			(button) => button.textContent?.includes('Start Quiz')
		)
		expect(start?.disabled).toBe(true)
	})

	it('counts only the questions a shuffled, limited quiz serves', async () => {
		Object.assign(responses['LMS Quiz'] as object, {
			shuffle_questions: 1,
			limit_questions_to: 1,
		})
		const wrapper = await renderInEditor(quizTool())

		expect(wrapper.textContent).toContain('1 question')
	})

	it('summarises the assignment without a submission lookup', async () => {
		const wrapper = await renderInEditor(assignmentTool())

		expectPreview(wrapper)
		expect(calls).toEqual([
			{
				method: 'frappe.client.get_value',
				args: {
					doctype: 'LMS Assignment',
					filters: { name: 'ASG-1' },
					fieldname: ['title', 'question', 'type'],
				},
			},
		])
		expect(wrapper.textContent).toContain('Write about your week.')
		expect(wrapper.textContent).toContain('You can only upload PDF files')
		expect(
			wrapper.querySelector<HTMLButtonElement>(
				'[data-testid="assignment-dropzone"] button'
			)?.disabled
		).toBe(true)
	})

	it('summarises the exercise without its test cases or the code runner', async () => {
		const wrapper = await renderInEditor(exerciseTool())

		expectPreview(wrapper)
		expect(calls).toEqual([
			{
				method: 'frappe.client.get_value',
				args: {
					doctype: 'LMS Programming Exercise',
					filters: { name: 'EX-1' },
					fieldname: ['title', 'problem_statement', 'language'],
				},
			},
		])
		expect(wrapper.textContent).toContain('Print the numbers.')
		expect(
			wrapper.querySelector('[data-testid="block-preview-language"]')
				?.textContent
		).toContain('Python')
		expect(document.querySelector('script[src*="livecode"]')).toBeNull()
	})

	it('shows a skeleton while the read is in flight', async () => {
		hold.pending = true
		for (const tool of [quizTool(), assignmentTool(), exerciseTool()]) {
			const wrapper = await renderInEditor(tool)
			expect(
				wrapper.querySelector('[data-testid="block-preview-skeleton"]')
			).not.toBeNull()
			expect(wrapper.textContent).toContain('Preview only')
		}
	})

	it('says so when the record is gone', async () => {
		responses['LMS Quiz'] = 'missing'
		responses['LMS Assignment'] = null
		for (const tool of [quizTool(), assignmentTool()]) {
			const wrapper = await renderInEditor(tool)
			expect(
				wrapper.querySelector('[data-testid="block-preview-missing"]')
			).not.toBeNull()
		}
	})
})

// Guards the editor preview rendering the block undimmed but unreachable.
// Came with this branch's lesson editor block preview.
// Added on feat/assessment-visual-redesign after the dimming overlay was dropped.
describe('mountBlock in preview', () => {
	let app: App | null = null

	afterEach(() => {
		app?.unmount()
		app = null
	})

	it('renders the block undimmed inside an inert wrapper', () => {
		const host = document.createElement('div')
		document.body.append(host)
		app = mountBlock(host, recorder('probe'), {}, { preview: true })

		expect(host.querySelector(':scope > [data-testid="probe"]')).not.toBeNull()
		expect(host.hasAttribute('inert')).toBe(true)
	})
})
