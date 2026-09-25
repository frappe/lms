import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { defineComponent, h } from 'vue'

const translate = (text: string) =>
	/{\d+}/.test(text)
		? {
				format: (...args: unknown[]) =>
					text.replace(/{(\d+)}/g, (match, index) =>
						args[index] !== undefined ? String(args[index]) : match
					),
			}
		: text
vi.stubGlobal('__', translate)

enableAutoUnmount(afterEach)

const { copilotCall, toast, uploadCourseSource } = vi.hoisted(() => ({
	copilotCall: vi.fn(),
	uploadCourseSource: vi.fn(),
	toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/copilot/api', () => ({
	copilotCall,
	uploadCourseSource,
}))

vi.mock('frappe-ui', () => ({
	call: vi.fn(),
	toast,
	usePageMeta: vi.fn(),
	LoadingIndicator: { template: '<span />' },
	Badge: {
		props: ['label', 'theme', 'variant', 'size'],
		template: '<span class="badge">{{ label }}</span>',
	},
	Button: {
		inheritAttrs: false,
		props: ['label', 'loading', 'variant', 'theme', 'type'],
		template: `<button :type="type || 'button'" v-bind="$attrs"><slot name="prefix" />{{ label }}<slot /></button>`,
	},
	FormControl: {
		inheritAttrs: false,
		props: ['modelValue', 'label', 'type', 'disabled', 'rows', 'required'],
		emits: ['update:modelValue'],
		template: `<label>{{ label }}<textarea v-if="type === 'textarea'" v-bind="$attrs" :disabled="disabled" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" /><input v-else v-bind="$attrs" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" /></label>`,
	},
	Dialog: {
		props: ['open', 'title', 'size'],
		emits: ['update:open'],
		methods: {
			close() {
				this.$emit('update:open', false)
			},
		},
		template: `<div v-if="open" role="dialog"><h2>{{ title }}</h2><slot :close="close" /><slot name="actions" :close="close" /></div>`,
	},
}))

vi.mock('@/components/Layouts/PageHeader.vue', () => ({
	default: {
		props: ['breadcrumbs'],
		template: `<header><span v-for="crumb in breadcrumbs" class="crumb">{{ crumb.label }}</span><slot name="actions" /></header>`,
	},
}))
vi.mock('@/components/Layouts/PageBody.vue', () => ({
	default: { template: '<main><slot /></main>' },
}))
vi.mock('@/components/HeaderButton.vue', () => ({
	default: {
		inheritAttrs: false,
		props: ['label', 'icon', 'variant'],
		template: `<button v-bind="$attrs">{{ label }}</button>`,
	},
}))

import { resetCopilotSession } from '@/components/Copilot/teacher/useTeacherData'
import CopilotQueue from '@/pages/Copilot/CopilotQueue.vue'
import CopilotProposal from '@/pages/Copilot/CopilotProposal.vue'
import CopilotFeedbackReview from '@/pages/Copilot/CopilotFeedbackReview.vue'
import CopilotImports from '@/pages/Copilot/CopilotImports.vue'
import CopilotImportDetail from '@/pages/Copilot/CopilotImportDetail.vue'
import CopilotInsight from '@/pages/Copilot/CopilotInsight.vue'

const Stub = defineComponent({ render: () => h('div', 'stub') })

const makeRouter = () =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/copilot', name: 'CopilotQueue', component: CopilotQueue },
			{
				path: '/copilot/review/:draft',
				name: 'CopilotFeedbackReview',
				component: CopilotFeedbackReview,
				props: true,
			},
			{
				path: '/copilot/proposal/:proposal',
				name: 'CopilotProposal',
				component: CopilotProposal,
				props: true,
			},
			{
				path: '/copilot/import',
				name: 'CopilotImports',
				component: CopilotImports,
			},
			{
				path: '/copilot/import/:importName',
				name: 'CopilotImportDetail',
				component: CopilotImportDetail,
				props: true,
			},
			{
				path: '/copilot/insight/:course',
				name: 'CopilotInsight',
				component: CopilotInsight,
				props: true,
			},
			{ path: '/courses/:courseName', name: 'CourseDetail', component: Stub },
		],
	})

type Handlers = Record<string, (args: any) => unknown>

function serve(handlers: Handlers, session: Record<string, unknown> = {}) {
	copilotCall.mockImplementation((method: string, args: any) => {
		if (method === 'get_session_context') {
			return Promise.resolve({
				is_teacher: true,
				server_now: '2026-09-25 12:00:00',
				full_name: 'Teacher',
				...session,
			})
		}
		const handler = handlers[method]
		if (!handler) return Promise.reject(new Error(`unexpected ${method}`))
		return Promise.resolve(handler(args))
	})
}

async function open(path: string) {
	const router = makeRouter()
	await router.push(path)
	await router.isReady()
	const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
		global: { plugins: [router], mocks: { __: translate } },
		attachTo: document.body,
	})
	await flushPromises()
	return { wrapper, router }
}

const called = (method: string) =>
	copilotCall.mock.calls.filter(([name]) => name === method)

beforeEach(() => {
	copilotCall.mockReset()
	toast.success.mockReset()
	toast.error.mockReset()
	resetCopilotSession()
	vi.stubGlobal(
		'fetch',
		vi.fn(() =>
			Promise.resolve({
				ok: true,
				text: () => Promise.resolve('line 1\nline 2'),
			})
		)
	)
})

const queue = {
	rows: [
		{
			kind: 'feedback',
			name: 'DRAFT-1',
			title: 'Todo app',
			detail: { tests: '4/5', flagged: 0 },
			who: 'Lan',
			course: 'python',
			course_title: 'Python',
			confidence: 'High',
			created: '2026-09-25 11:30:00',
		},
		{
			kind: 'Escalation',
			name: 'PROP-1',
			title: 'Question about loops',
			detail: { summary: 'Why does my loop stop?' },
			who: 'Minh',
			course: 'python',
			course_title: 'Python',
			confidence: null,
			created: '2026-09-25 10:00:00',
		},
	],
	counts: { feedback: 1, Escalation: 1 },
	total: 2,
	quick_approve: ['DRAFT-1'],
}

describe('Copilot review queue', () => {
	it('lists every pending item with a link to its review screen', async () => {
		serve({ get_review_queue: () => queue })
		const { wrapper } = await open('/copilot')

		const rows = wrapper.findAll('[data-testid="copilot-queue-row"]')
		expect(rows).toHaveLength(2)
		expect(rows[0].text()).toContain('Tests 4/5 passed')
		expect(rows[0].text()).toContain('30 min')
		expect(rows[0].find('a').attributes('href')).toBe('/copilot/review/DRAFT-1')
		expect(rows[1].find('a').attributes('href')).toBe(
			'/copilot/proposal/PROP-1'
		)
		expect(wrapper.text()).toContain('Why does my loop stop?')
	})

	it('filters by kind through the URL without refetching', async () => {
		serve({ get_review_queue: () => queue })
		const { wrapper, router } = await open('/copilot?kind=Escalation')

		expect(wrapper.findAll('[data-testid="copilot-queue-row"]')).toHaveLength(1)
		const all = wrapper.findAll('[data-testid="copilot-kind-filter"]')[0]
		await all.trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.query.kind).toBeUndefined()
		expect(wrapper.findAll('[data-testid="copilot-queue-row"]')).toHaveLength(2)
		expect(called('get_review_queue')).toHaveLength(1)
	})

	it('quick-approves the high-confidence drafts after confirmation', async () => {
		serve({
			get_review_queue: () => queue,
			bulk_approve_feedback: () => ({ approved: ['DRAFT-1'], skipped: [] }),
		})
		const { wrapper } = await open('/copilot')

		await wrapper.find('[data-testid="copilot-quick-approve"]').trigger('click')
		expect(wrapper.find('[role="dialog"]').text()).toContain('Lan — Todo app')
		await wrapper.find('[data-testid="copilot-note-confirm"]').trigger('click')
		await flushPromises()

		expect(called('bulk_approve_feedback')[0][1]).toEqual({
			drafts: ['DRAFT-1'],
		})
		expect(toast.success).toHaveBeenCalledWith('1 sent, 0 skipped')
		expect(called('get_review_queue')).toHaveLength(2)
	})

	it('shows only a notice to someone who is not a teacher', async () => {
		serve({ get_review_queue: () => queue }, { is_teacher: false })
		const { wrapper } = await open('/copilot')

		expect(wrapper.text()).toContain('Only teachers can open this page.')
		expect(called('get_review_queue')).toHaveLength(0)
	})

	it('shows the server error when the queue cannot load', async () => {
		copilotCall.mockImplementation((method: string) =>
			method === 'get_session_context'
				? Promise.resolve({ is_teacher: true })
				: Promise.reject({ messages: ['<p>No access</p>'] })
		)
		const { wrapper } = await open('/copilot')
		expect(wrapper.text()).toContain('This page could not be loaded')
		expect(wrapper.text()).toContain('No access')
	})
})

const courseDraft = (status = 'Pending') => ({
	name: 'PROP-9',
	type: 'Course Draft',
	status,
	title: 'Create course “Python” from 2 file(s)',
	summary: '2 chapter(s), 3 lesson(s)',
	params: { course_import: 'IMP-1' },
	final_params: null,
	preview: {
		kind: 'course',
		title: 'Python',
		introduction: 'Learn Python',
		files: ['slides.pdf'],
		chapters: [
			{
				number: 1,
				title: 'Basics',
				lessons: [
					{
						key: 'l1',
						number: '1.1',
						title: 'Variables',
						markdown: '# Variables',
						sources: ['S1 p.2'],
						missing_material: false,
					},
					{
						key: 'l2',
						number: '1.2',
						title: 'Loops',
						markdown: '',
						sources: [],
						missing_material: true,
					},
				],
			},
		],
		assignments: [],
		missing: 1,
	},
	requested_by: 'teacher@x.com',
	requested_by_name: 'Teacher',
	requested_via: 'Teacher',
	created: '2026-09-25 10:00:00',
	result: status === 'Applied' ? { course: 'python-101' } : null,
})

describe('Copilot proposal', () => {
	it('will not approve a course draft until the teacher decides on lessons without material', async () => {
		serve({
			get_proposal: () => courseDraft(),
			approve_proposal: () => ({
				proposal: 'PROP-9',
				status: 'Applied',
				result: {},
			}),
		})
		const { wrapper } = await open('/copilot/proposal/PROP-9')

		expect(wrapper.text()).toContain('Missing material')
		await wrapper.find('[data-testid="copilot-approve"]').trigger('click')
		await flushPromises()
		expect(called('approve_proposal')).toHaveLength(0)
		expect(toast.error).toHaveBeenCalled()

		await wrapper.find('[data-testid="copilot-missing"]').setValue('drop')
		await wrapper.find('[data-testid="copilot-approve"]').trigger('click')
		await flushPromises()
		expect(called('approve_proposal')[0][1]).toEqual({
			name: 'PROP-9',
			params: { missing_lessons: 'drop' },
		})
		expect(toast.success).toHaveBeenCalledWith('Applied and verified.')
	})

	it('links an applied course draft to the new LMS course', async () => {
		serve({ get_proposal: () => courseDraft('Applied') })
		const { wrapper } = await open('/copilot/proposal/PROP-9')

		const link = wrapper
			.findAll('a')
			.find((a) => a.text().includes('Open the new course (unpublished)'))
		expect(link?.attributes('href')).toBe('/courses/python-101')
		expect(wrapper.find('[data-testid="copilot-approve"]').exists()).toBe(false)
	})

	it('sends the edited lesson text with a lesson change', async () => {
		serve({
			get_proposal: () => ({
				name: 'PROP-2',
				type: 'Lesson Change',
				status: 'Pending',
				title: 'Clarify loops',
				params: { lesson: 'L1', mode: 'append', markdown: 'Old text' },
				preview: {
					kind: 'diff',
					lines: [
						{ op: 'same', text: 'Intro' },
						{ op: 'add', text: 'Old text' },
					],
				},
			}),
			approve_proposal: () => ({ status: 'Failed', error: 'Lesson changed' }),
		})
		const { wrapper } = await open('/copilot/proposal/PROP-2')

		expect(wrapper.find('[data-testid="copilot-diff"]').text()).toContain(
			'+ Old text'
		)
		expect(wrapper.find('[data-testid="copilot-lesson-editor"]').exists()).toBe(
			false
		)
		await wrapper.find('[data-testid="copilot-edit"]').trigger('click')
		await wrapper
			.find('[data-testid="copilot-lesson-editor"]')
			.setValue('New text')
		await wrapper.find('[data-testid="copilot-approve"]').trigger('click')
		await flushPromises()

		expect(called('approve_proposal')[0][1].params).toEqual({
			lesson: 'L1',
			mode: 'append',
			markdown: 'New text',
		})
		expect(toast.error).toHaveBeenCalledWith('Lesson changed')
	})

	it('needs a reply before answering an escalated question', async () => {
		serve({
			get_proposal: () => ({
				name: 'PROP-3',
				type: 'Escalation',
				status: 'Pending',
				title: 'Question',
				params: { question: 'Why?' },
				preview: { kind: 'question', question: 'Why does it fail?' },
			}),
			approve_proposal: () => ({ status: 'Applied' }),
		})
		const { wrapper } = await open('/copilot/proposal/PROP-3')

		const send = wrapper.find('[data-testid="copilot-approve"]')
		expect(send.text()).toBe('Send reply')
		await send.trigger('click')
		await flushPromises()
		expect(called('approve_proposal')).toHaveLength(0)

		await wrapper
			.find('[data-testid="copilot-reply"]')
			.setValue('Check the index')
		await send.trigger('click')
		await flushPromises()
		expect(called('approve_proposal')[0][1].params).toEqual({
			reply: 'Check the index',
		})
	})

	it('rejects with an optional reason', async () => {
		serve({
			get_proposal: () => courseDraft(),
			reject_proposal: () => ({ status: 'Rejected' }),
		})
		const { wrapper } = await open('/copilot/proposal/PROP-9')

		const reject = wrapper.findAll('button').find((b) => b.text() === 'Reject')
		await reject!.trigger('click')
		await wrapper.find('[data-testid="copilot-note-input"]').setValue('Not now')
		await wrapper.find('[data-testid="copilot-note-confirm"]').trigger('click')
		await flushPromises()
		expect(called('reject_proposal')[0][1]).toEqual({
			name: 'PROP-9',
			note: 'Not now',
		})
	})
})

const review = {
	draft: 'DRAFT-1',
	status: 'Pending Review',
	message: 'Good work',
	final_message: null,
	result_status: null,
	assignment: 'ASG-1',
	assignment_title: 'Todo app',
	course: 'python',
	course_title: 'Python',
	learner_name: 'Lan',
	rubric: { title: 'Todo rubric', criteria: [] },
	scores: [
		{
			criterion: 'Tests',
			max_level: 3,
			level: 3,
			final_level: 3,
			confidence: 'High',
			reason: 'All green',
			citations: [{ file: 'src/app.py', line_start: 2, line_end: 2 }],
		},
		{
			criterion: 'Style',
			max_level: 3,
			level: 2,
			final_level: 2,
			confidence: 'Low',
			reason: 'Long functions',
			citations: [],
		},
	],
	submission: {
		repo_url: 'https://github.com/lan/todo',
		commit: 'abcdef123',
		submitted_on: '2026-09-25 09:00:00',
		tests: { passed: 4, total: 5, results: [] },
		history: [],
	},
	neighbours: { previous: null, next: 'DRAFT-2' },
}

describe('Copilot feedback review', () => {
	it('sends edited levels, message and the suggested result, then opens the next draft', async () => {
		serve({
			get_feedback_review: ({ draft }) => ({ ...review, draft }),
			approve_feedback: () => ({ status: 'Approved' }),
		})
		const { wrapper, router } = await open('/copilot/review/DRAFT-1')

		expect(wrapper.text()).toContain('Confidence: Low · needs a closer look')
		expect(
			(
				wrapper.find('[data-testid="copilot-result"]')
					.element as HTMLSelectElement
			).value
		).toBe('Pass')

		const style = wrapper.findAll('[data-testid="copilot-score"]')[1]
		await style
			.findAll('button')
			.find((b) => b.text().startsWith('1'))!
			.trigger('click')
		expect(
			(
				wrapper.find('[data-testid="copilot-result"]')
					.element as HTMLSelectElement
			).value
		).toBe('Fail')

		await wrapper.find('[data-testid="copilot-message"]').setValue('Nice job')
		await wrapper.find('[data-testid="copilot-approve"]').trigger('click')
		await flushPromises()

		expect(called('approve_feedback')[0][1]).toEqual({
			draft: 'DRAFT-1',
			scores: { Tests: 3, Style: 1 },
			message: 'Nice job',
			result_status: 'Fail',
		})
		expect(router.currentRoute.value.params.draft).toBe('DRAFT-2')
	})

	it('shows the cited file with the cited line highlighted', async () => {
		serve({ get_feedback_review: () => review })
		const { wrapper } = await open('/copilot/review/DRAFT-1')

		expect(fetch).toHaveBeenCalledWith(
			'https://raw.githubusercontent.com/lan/todo/abcdef123/src/app.py',
			{ credentials: 'omit' }
		)
		const line = wrapper.find('[data-line="2"]')
		expect(line.text()).toContain('line 2')
		expect(line.classes()).toContain('bg-surface-amber-2')
	})

	it('asks for instructions before sending a draft back for a rewrite', async () => {
		serve({
			get_feedback_review: () => review,
			request_feedback_rewrite: () => ({ status: 'Rewrite Requested' }),
		})
		const { wrapper } = await open('/copilot/review/DRAFT-1')

		const ask = wrapper
			.findAll('button')
			.find((b) => b.text().startsWith('Ask the assistant'))
		await ask!.trigger('click')
		await wrapper.find('[data-testid="copilot-note-confirm"]').trigger('click')
		await flushPromises()
		expect(called('request_feedback_rewrite')).toHaveLength(0)

		await wrapper
			.find('[data-testid="copilot-note-input"]')
			.setValue('Be kinder')
		await wrapper.find('[data-testid="copilot-note-confirm"]').trigger('click')
		await flushPromises()
		expect(called('request_feedback_rewrite')[0][1]).toEqual({
			draft: 'DRAFT-1',
			note: 'Be kinder',
		})
	})

	it('is read-only once the draft is approved', async () => {
		serve({
			get_feedback_review: () => ({
				...review,
				status: 'Approved',
				edit_level: 'Light',
				reviewed_by: 'teacher@x.com',
			}),
		})
		const { wrapper } = await open('/copilot/review/DRAFT-1')

		expect(wrapper.find('[data-testid="copilot-approve"]').exists()).toBe(false)
		expect(wrapper.text()).toContain('Edit: Light')
		expect(wrapper.text()).toContain('by teacher@x.com')
	})
})

describe('Copilot course import form', () => {
	it('uploads every document, then creates the import and opens it', async () => {
		uploadCourseSource.mockImplementation((file: File) =>
			Promise.resolve({ file_url: `/private/files/${file.name}` })
		)
		serve({
			list_course_imports: () => [
				{
					name: 'IMP-0',
					title: 'Older',
					status: 'Ready',
					created: '2026-09-20 10:00:00',
					sources: [{ file_name: 'old.pdf' }],
				},
			],
			create_course_import: () => ({ name: 'IMP-7', status: 'Queued' }),
			get_course_import: () => ({
				name: 'IMP-7',
				title: 'Python',
				status: 'Failed',
				sources: [],
			}),
		})
		const { wrapper, router } = await open('/copilot/import')

		expect(wrapper.find('[data-testid="copilot-import-row"]').text()).toContain(
			'old.pdf'
		)
		await wrapper.find('[data-testid="copilot-import-form"]').trigger('submit')
		expect(toast.error).toHaveBeenCalledWith('Enter a course title.')

		await wrapper
			.find('[data-testid="copilot-import-title"]')
			.setValue('Python')
		const input = wrapper.find('[data-testid="copilot-import-files"]')
		const files = [new File(['a'], 'slides.pdf'), new File(['b'], 'notes.md')]
		Object.defineProperty(input.element, 'files', { value: files })
		await input.trigger('change')
		await wrapper.find('[data-testid="copilot-import-form"]').trigger('submit')
		await flushPromises()

		expect(uploadCourseSource).toHaveBeenCalledTimes(2)
		expect(called('create_course_import')[0][1]).toEqual({
			title: 'Python',
			brief: '',
			files: ['/private/files/slides.pdf', '/private/files/notes.md'],
		})
		expect(router.currentRoute.value.name).toBe('CopilotImportDetail')
		expect(router.currentRoute.value.params.importName).toBe('IMP-7')
	})
})

describe('Copilot course import detail', () => {
	it('polls every five seconds while the import is queued', async () => {
		vi.useFakeTimers()
		try {
			let status = 'Queued'
			serve({
				get_course_import: () => ({
					name: 'IMP-1',
					title: 'Python',
					status,
					sources: [
						{
							source: 'S1',
							file_name: 'slides.pdf',
							unit: 'page',
							pages: 12,
							chars: 3400,
						},
					],
					proposal:
						status === 'Ready'
							? { name: 'PROP-9', status: 'Pending', title: 'Draft' }
							: null,
				}),
			})
			const { wrapper } = await open('/copilot/import/IMP-1')

			expect(
				wrapper.find('[data-testid="copilot-import-queued"]').exists()
			).toBe(true)
			expect(wrapper.text()).toContain('12 page(s), 3400 characters')
			expect(called('get_course_import')).toHaveLength(1)

			await vi.advanceTimersByTimeAsync(5000)
			await flushPromises()
			expect(called('get_course_import')).toHaveLength(2)

			status = 'Ready'
			await vi.advanceTimersByTimeAsync(5000)
			await flushPromises()
			expect(called('get_course_import')).toHaveLength(3)
			expect(
				wrapper
					.find('[data-testid="copilot-import-proposal"]')
					.attributes('href')
			).toBe('/copilot/proposal/PROP-9')

			await vi.advanceTimersByTimeAsync(15000)
			expect(called('get_course_import')).toHaveLength(3)
		} finally {
			vi.useRealTimers()
		}
	})

	it('offers to draft again after a failure', async () => {
		serve({
			get_course_import: () => ({
				name: 'IMP-1',
				title: 'Python',
				status: 'Failed',
				error: 'Gateway down',
				sources: [],
				proposal: null,
			}),
			retry_course_import: () => ({ name: 'IMP-1', status: 'Queued' }),
		})
		const { wrapper } = await open('/copilot/import/IMP-1')

		expect(wrapper.text()).toContain('Gateway down')
		await wrapper.find('[data-testid="copilot-import-retry"]').trigger('click')
		await flushPromises()
		expect(called('retry_course_import')[0][1]).toEqual({ name: 'IMP-1' })
		expect(toast.success).toHaveBeenCalledWith('Queued again.')
	})
})

describe('Copilot weekly insight', () => {
	it('says so when there is no report yet', async () => {
		serve({ get_weekly_insight: () => null })
		const { wrapper } = await open('/copilot/insight/python')
		expect(wrapper.text()).toContain('No weekly report yet')
	})

	it('shows the stuck points, their evidence and linked proposals', async () => {
		serve({
			get_weekly_insight: () => ({
				name: 'INS-1',
				course: 'python',
				course_title: 'Python',
				week_start: '2026-09-21',
				status: 'Draft',
				stats: { learners: 20, questions: 14 },
				groups: [
					{
						title: 'Off-by-one in loops',
						learners: 6,
						count: 9,
						summary: 'Many ask about range()',
						suggestion: 'Add an example',
						evidence: ['Q1', { label: 'Q2' }],
						proposals: ['PROP-5'],
						proposal_status: { 'PROP-5': 'Pending' },
					},
				],
				at_risk: [{ learner: 'L-3', reason: 'No activity' }],
			}),
		})
		const { wrapper } = await open('/copilot/insight/python')

		expect(
			wrapper.find('[data-testid="copilot-insight-stats"]').text()
		).toContain('Learners: 20')
		expect(
			wrapper.find('[data-testid="copilot-insight-bar"]').text()
		).toContain('9')
		const group = wrapper.find('[data-testid="copilot-insight-group"]')
		expect(group.text()).toContain('Evidence (2)')
		expect(group.text()).toContain('Q2')
		expect(group.find('a').attributes('href')).toBe('/copilot/proposal/PROP-5')
		expect(wrapper.text()).toContain('No activity')
	})
})
