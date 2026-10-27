// Guards assessment blocks in the lesson editor rendering as an inert preview.
// Came with this branch's lesson editor block preview (was a grey notice).
// Added on feat/assessment-visual-redesign so nothing is submitted from it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { App } from 'vue'

const { calls, received, recorder } = vi.hoisted(() => {
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
		calls: [] as string[],
		received,
		recorder,
	}
})

vi.mock('frappe-ui', () => ({
	call: (method: string) => {
		calls.push(method)
		return Promise.resolve({ title: 'Weekly essay', name: null })
	},
	toast: {},
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

beforeEach(() => {
	Object.assign(window, { translatedMessages: {} })
	calls.length = 0
	for (const key of Object.keys(received)) delete received[key]
})

afterEach(() => {
	for (const tool of tools) tool.destroy()
	tools = []
	document.body.replaceChildren()
})

const expectPreview = (wrapper: HTMLDivElement) => {
	expect(wrapper.hasAttribute('inert')).toBe(true)
	expect(wrapper.hasAttribute('data-assessment-block')).toBe(true)
	const overlay = wrapper.querySelector('[data-testid="block-preview-overlay"]')
	expect(overlay?.className).toBe('absolute inset-0 bg-surface-base opacity-50')
	expect(wrapper.classList.contains('relative')).toBe(true)
}

describe('assessment blocks in the lesson editor', () => {
	it('previews the quiz itself', async () => {
		const wrapper = await renderInEditor(
			new Quiz({ data: { quiz: 'weekly-quiz' }, readOnly: false })
		)

		expectPreview(wrapper)
		expect(received.quiz).toMatchObject({ quiz: 'weekly-quiz', preview: true })
	})

	it('previews the assignment itself, with no submission lookup', async () => {
		const wrapper = await renderInEditor(
			new Assignment({ data: { assignment: 'ASG-1' }, readOnly: false })
		)

		expectPreview(wrapper)
		expect(received.assignment).toMatchObject({
			assignmentID: 'ASG-1',
			submissionName: 'new',
			preview: true,
			embedded: true,
		})
		expect(calls).not.toContain('lms.lms.api.get_own_assignment_submission')
	})

	it('previews the programming exercise itself, with no submission lookup', async () => {
		const wrapper = await renderInEditor(
			new Program({
				data: { exercise: 'EX-1' },
				api: {},
				readOnly: false,
			})
		)

		expectPreview(wrapper)
		expect(received.exercise).toMatchObject({
			exerciseID: 'EX-1',
			submissionID: 'new',
			preview: true,
			embedded: true,
		})
		expect(calls).toEqual([])
	})
})

// Guards the preview overlay staying hidden from assistive tech.
// Came with this branch's lesson editor block preview.
// Added on feat/assessment-visual-redesign next to the per-block previews.
describe('mountBlock in preview', () => {
	let app: App | null = null

	afterEach(() => {
		app?.unmount()
		app = null
	})

	it('keeps the block content under an overlay the reader cannot reach', () => {
		const host = document.createElement('div')
		document.body.append(host)
		app = mountBlock(host, recorder('probe'), {}, { preview: true })

		expect(host.querySelector('[data-testid="probe"]')).not.toBeNull()
		const overlay = host.querySelector('[data-testid="block-preview-overlay"]')
		expect(overlay?.getAttribute('aria-hidden')).toBe('true')
	})
})
