import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'

String.prototype.format = function (this: string, ...args: unknown[]): string {
	return this.replace(/{(\d+)}/g, (match, index) =>
		args[index] !== undefined ? String(args[index]) : match
	)
}
vi.stubGlobal('__', (text: string) => text)
enableAutoUnmount(afterEach)

const { copilotCall, resource, toast, routeQuery } = vi.hoisted(() => ({
	copilotCall: vi.fn(),
	resource: { current: null as any },
	toast: { success: vi.fn(), error: vi.fn() },
	routeQuery: { value: {} as Record<string, string> },
}))

vi.mock('@/copilot/api', () => ({
	COPILOT_API: 'lms.copilot.api',
	copilotCall,
}))

vi.mock('frappe-ui', async () => {
	const { reactive } = await import('vue')
	return {
		Badge: {
			props: ['theme'],
			template: '<span data-testid="badge" :data-theme="theme"><slot /></span>',
		},
		Button: {
			props: ['label', 'loading', 'disabled', 'variant'],
			template: '<button :disabled="disabled || loading"><slot /></button>',
		},
		FormControl: {
			props: ['modelValue'],
			emits: ['update:modelValue'],
			template:
				'<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
		},
		LoadingIndicator: { template: '<span />' },
		createResource: (options: any) => {
			const state = reactive({
				data: null as any,
				error: null as any,
				loading: false,
				params: options.makeParams(),
				reload: vi.fn(async () => {
					state.data = await copilotCall('get_assignment', options.makeParams())
				}),
			})
			resource.current = state
			if (options.auto) state.reload()
			return state
		},
		toast,
		usePageMeta: vi.fn(),
	}
})

vi.mock('vue-router', () => ({
	useRoute: () => ({ params: {}, query: routeQuery.value }),
}))
vi.mock('@/stores/session', () => ({ sessionStore: () => ({ brand: {} }) }))
vi.mock('@/components/Layouts/PageHeader.vue', () => ({
	default: { props: ['breadcrumbs'], template: '<nav data-testid="crumbs" />' },
}))

import CopilotSubmit from '@/pages/Copilot/CopilotSubmit.vue'
import CopilotProjectLink from '@/components/Copilot/CopilotProjectLink.vue'

const submission = (overrides: Record<string, unknown> = {}) => ({
	project_submission: 'CPS-1',
	assignment: 'ASG-1',
	repo_url: 'https://github.com/me/todo',
	commit: 'abcdef1234567',
	status: 'Awaiting Review',
	submitted_on: '2026-09-20 10:00:00',
	tests: {
		passed: 1,
		total: 2,
		results: [
			{ name: 'adds a todo', passed: true, message: null },
			{ name: 'removes a todo', passed: false, message: 'expected 0, got 1' },
		],
	},
	timeline: [
		{ step: 'submitted', done: true, at: '2026-09-20 10:00:00' },
		{ step: 'tested', done: true, at: '2026-09-20 10:05:00' },
		{ step: 'review', done: false, current: true },
		{ step: 'feedback', done: false, at: null },
	],
	feedback: null,
	...overrides,
})

const assignment = (submissions: unknown[] = [submission()]) => ({
	assignment: 'ASG-1',
	title: 'Todo app',
	question: '<p>Build a todo app</p><script>alert(1)</script>',
	course: 'js-101',
	course_title: 'JavaScript 101',
	rubric: {
		rubric: 'R-1',
		title: 'Todo rubric',
		criteria: [
			{ criterion: 'Tests', description: 'All tests pass', max_level: 3 },
		],
	},
	submissions,
})

const mountPage = async () => {
	const wrapper = mount(CopilotSubmit, {
		props: { assignment: 'ASG-1' },
		global: { mocks: { __: (text: string) => text } },
	})
	await flushPromises()
	return wrapper
}

beforeEach(() => {
	copilotCall.mockReset()
	toast.success.mockReset()
	toast.error.mockReset()
	routeQuery.value = {}
})

describe('CopilotSubmit', () => {
	it('shows the brief, rubric, timeline and test results of the latest submission', async () => {
		copilotCall.mockResolvedValue(assignment())
		const wrapper = await mountPage()
		expect(copilotCall).toHaveBeenCalledWith('get_assignment', {
			assignment: 'ASG-1',
		})
		expect(wrapper.find('h1').text()).toBe('Todo app')
		expect(wrapper.html()).not.toContain('<script>')
		expect(wrapper.text()).toContain('How it is graded')
		expect(wrapper.text()).toContain('All tests pass')

		const steps = wrapper.findAll('[data-testid="timeline"] li')
		expect(steps.map((step) => step.text())).toEqual([
			expect.stringContaining('Submitted'),
			expect.stringContaining('Automatic tests ran'),
			expect.stringContaining(
				'Waiting for your teacher to review the feedback'
			),
			expect.stringContaining('Feedback received'),
		])
		const tests = wrapper.find('[data-testid="tests"]')
		expect(tests.text()).toContain('Test results (1/2)')
		expect(tests.text()).toContain('expected 0, got 1')
		expect(wrapper.text()).toContain(
			'While you wait, look at the tests that did not pass.'
		)
		expect((wrapper.find('input').element as HTMLInputElement).value).toBe(
			'https://github.com/me/todo'
		)
	})

	it('shows the teacher-approved feedback with scores', async () => {
		copilotCall.mockResolvedValue(
			assignment([
				submission({
					status: 'Feedback Sent',
					feedback: {
						message: 'Nice work.',
						result: 'Pass',
						scores: [{ criterion: 'Tests', final_level: 3, max_level: 3 }],
					},
				}),
			])
		)
		const wrapper = await mountPage()
		const feedback = wrapper.find('[data-testid="feedback"]')
		expect(feedback.text()).toContain('Nice work.')
		expect(feedback.text()).toContain('Tests: 3/3')
		expect(
			feedback.find('[data-testid="badge"]').attributes('data-theme')
		).toBe('green')
		expect(wrapper.text()).not.toContain('While you wait')
	})

	it('tells a learner who has not submitted yet and submits the repo', async () => {
		routeQuery.value = { lesson: 'LESSON-7' }
		copilotCall.mockResolvedValueOnce(assignment([]))
		const wrapper = await mountPage()
		expect(wrapper.text()).toContain('You have not submitted this project yet.')

		copilotCall.mockResolvedValueOnce(submission({ status: 'Submitted' }))
		copilotCall.mockResolvedValueOnce(
			assignment([submission({ status: 'Submitted' })])
		)
		await wrapper.find('input').setValue('  https://github.com/me/todo ')
		await wrapper.find('form').trigger('submit')
		await flushPromises()

		expect(copilotCall).toHaveBeenCalledWith('submit_project', {
			assignment: 'ASG-1',
			repo_url: 'https://github.com/me/todo',
			lesson: 'LESSON-7',
		})
		expect(toast.success).toHaveBeenCalled()
		expect(wrapper.text()).toContain('Submit again')
	})

	it('reports a rejected submission', async () => {
		copilotCall.mockResolvedValueOnce(assignment([]))
		const wrapper = await mountPage()
		copilotCall.mockRejectedValueOnce({
			messages: ['The repository must be public on GitHub.'],
		})
		await wrapper.find('input').setValue('https://gitlab.com/x/y')
		await wrapper.find('form').trigger('submit')
		await flushPromises()
		expect(toast.error).toHaveBeenCalledWith(
			'The repository must be public on GitHub.'
		)
	})

	it('explains an errored submission', async () => {
		copilotCall.mockResolvedValue(
			assignment([submission({ status: 'Error', tests: null })])
		)
		const wrapper = await mountPage()
		expect(wrapper.find('[role="alert"]').text()).toContain(
			'We could not process this submission.'
		)
	})
})

describe('CopilotProjectLink', () => {
	const mountLink = async () => {
		const wrapper = mount(CopilotProjectLink, {
			props: { assignment: 'ASG-1' },
			global: { mocks: { __: (text: string) => text } },
		})
		await flushPromises()
		return wrapper
	}

	it('links to the submit page when the assignment has a Copilot rubric', async () => {
		copilotCall.mockResolvedValue(assignment([]))
		const wrapper = await mountLink()
		const link = wrapper.find('a')
		expect(link.attributes('href')).toBe('/lms/copilot/submit/ASG-1')
		expect(link.attributes('target')).toBe('_top')
		expect(link.text()).toContain('Submit project')
	})

	it('offers the status page once a project was submitted', async () => {
		copilotCall.mockResolvedValue({ ...assignment(), rubric: null })
		const wrapper = await mountLink()
		expect(wrapper.find('a').text()).toContain('View project status')
	})

	it('renders nothing for a plain URL assignment or when the call fails', async () => {
		copilotCall.mockResolvedValue({ ...assignment([]), rubric: null })
		expect((await mountLink()).find('a').exists()).toBe(false)
		copilotCall.mockRejectedValue(new Error('403'))
		expect((await mountLink()).find('a').exists()).toBe(false)
	})
})
