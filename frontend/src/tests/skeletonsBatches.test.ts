/**
 * Batch detail sections each wait on their own fetch. A section shows its
 * skeleton until that fetch first lands, then never again: a refetch keeps
 * `data` and re-raises `loading`, and must leave the content in place.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import dayjs from 'dayjs'
import { computed, nextTick } from 'vue'
import { BATCH_FORM } from '@/pages/Batches/composables/useBatchForm'

vi.stubGlobal('__', (text: string) => text)
String.prototype.format = function (this: string, ...args: unknown[]): string {
	return args.reduce<string>(
		(out, arg, i) => out.replaceAll(`{${i}}`, String(arg)),
		this
	)
}

type FakeResource = {
	data: unknown
	loading: boolean
	error: unknown
	fetched: boolean
	list: { loading: boolean; error: unknown }
}

const { resources, fake, stub } = vi.hoisted(() => {
	const resources = {} as Record<string, FakeResource>
	const fake = (key: string) => {
		const { reactive } = require('vue')
		const resource = reactive({
			data: null,
			loading: true,
			error: null,
			fetched: false,
			list: { loading: true, error: null },
			params: {},
			reload: () => {},
			abort: () => {},
			submit: () => {},
			insert: { loading: false, submit: () => {} },
			delete: { loading: false, submit: () => {} },
		})
		resources[key] = resource
		return resource
	}
	const stub = (template: string) => ({ default: { template } })
	return { resources, fake, stub }
})

vi.mock('frappe-ui', () => ({
	createResource: (options: { url: string }) => fake(options.url),
	createListResource: (options: { doctype: string }) => fake(options.doctype),
	call: vi.fn(() => Promise.resolve()),
	toast: { success: vi.fn(), error: vi.fn() },
	Alert: { template: '<div />' },
	Avatar: { template: '<span />' },
	Badge: { template: '<span><slot /></span>' },
	Button: { template: '<button><slot /></button>' },
	Tooltip: { template: '<div><slot /></div>' },
}))

vi.mock('@/utils', () => ({ timeAgo: () => '', formatTime: () => '' }))
vi.mock('@/router', () => ({ default: { push: () => {} } }))
vi.mock('@/composables/useBatchForms', () => ({ openBatchForm: () => {} }))
vi.mock('vue-router', () => ({
	useRoute: () => ({ hash: '' }),
	useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/components/Layouts/EmptyStateLayout.vue', () =>
	stub('<div data-testid="empty" />')
)
vi.mock('@/components/ResponsiveListView.vue', () =>
	stub('<div data-testid="rows" />')
)
vi.mock('@/components/SectionEmptyState.vue', () =>
	stub('<div data-testid="empty" />')
)
vi.mock('@/components/Modals/LiveClassAttendance.vue', () => stub('<i />'))
vi.mock('@/components/ProgressBar.vue', () => stub('<i />'))
vi.mock('@/components/InlineEdit/PickerDialog.vue', () => stub('<i />'))
vi.mock('@/composables/useCoursePickerItems', async () => {
	const { computed } = await import('vue')
	return {
		useCoursePickerItems: () => ({
			items: computed(() => []),
			categories: computed(() => []),
			byName: computed(() => ({})),
			load: vi.fn(),
		}),
	}
})

import Announcements from '@/pages/Batches/components/Announcements.vue'
import Assessments from '@/pages/Batches/components/Assessments.vue'
import BatchCourseList from '@/pages/Batches/components/overview/BatchCourseList.vue'
import BatchSchedule from '@/pages/Batches/components/overview/BatchSchedule.vue'
import LiveClass from '@/pages/Batches/components/LiveClass.vue'

const batch = { data: { name: 'B1', can_manage: 1, student_count: 2 } }

const mountWith = (component: unknown, props: Record<string, unknown>) =>
	mount(component as never, {
		props,
		global: {
			mocks: { __: (text: string) => text },
			provide: {
				$user: { data: { name: 'a@b.c', is_moderator: true } },
				$dayjs: dayjs,
				[BATCH_FORM as symbol]: {
					doc: computed(() => ({
						conferencing_provider: 'Zoom',
						zoom_account: 'Z1',
					})),
				},
			},
			directives: { safeHtml: {}, external: {} },
			stubs: { 'router-link': { template: '<a><slot /></a>' } },
		},
	})

const land = async (resource: FakeResource, data: unknown) => {
	resource.data = data
	resource.loading = false
	resource.list.loading = false
	resource.fetched = true
	await nextTick()
}

const refetch = async (resource: FakeResource) => {
	resource.loading = true
	resource.list.loading = true
	await nextTick()
}

const cases = [
	{
		name: 'Classes tab',
		mount: () => mountWith(LiveClass, { batch }),
		key: 'LMS Live Class',
		skeleton: 'live-classes-skeleton',
		data: [{ name: 'C1', title: 'Intro', date: '2030-01-01', time: '10:00' }],
	},
	{
		name: 'Announcements tab',
		mount: () => mountWith(Announcements, { batch }),
		key: 'lms.lms.api.get_announcements',
		skeleton: 'announcements-skeleton',
		data: [{ name: 'A1', sender_full_name: 'Ann', content: 'Hi' }],
	},
	{
		name: 'student dashboard assessments',
		mount: () => mountWith(Assessments, { batch: 'B1', expected: 2 }),
		key: 'lms.lms.utils.get_assessments',
		skeleton: 'assessments-skeleton',
		data: [{ name: 'AS1', title: 'Quiz' }],
	},
	{
		name: 'overview courses',
		mount: () =>
			mountWith(BatchCourseList, {
				batchName: 'B1',
				editable: true,
				expected: 1,
			}),
		key: 'lms.lms.utils.get_batch_courses',
		skeleton: 'batch-courses-skeleton',
		data: [{ name: 'C1', title: 'One', batch_course: 'BC1' }],
	},
	{
		name: 'overview schedule',
		mount: () => mountWith(BatchSchedule, { batchName: 'B1', editable: true }),
		key: 'LMS Live Class',
		skeleton: 'batch-schedule-skeleton',
		data: [{ name: 'C1', title: 'Intro', date: '2030-01-01' }],
	},
]

beforeEach(() => {
	for (const key of Object.keys(resources)) delete resources[key]
})

describe.each(cases)('$name skeleton', (section) => {
	const selector = `[data-testid="${section.skeleton}"]`

	it('shows while nothing has loaded, and is hidden from readers', () => {
		const wrapper = section.mount()
		const skeleton = wrapper.get(selector)
		const hidden =
			skeleton.attributes('aria-hidden') ??
			skeleton.find('[aria-hidden="true"]').attributes('aria-hidden')
		expect(hidden).toBe('true')
	})

	it('gives way once its data lands', async () => {
		const wrapper = section.mount()
		await land(resources[section.key], section.data)
		expect(wrapper.find(selector).exists()).toBe(false)
	})

	it('stays away on a refetch', async () => {
		const wrapper = section.mount()
		await land(resources[section.key], section.data)
		await refetch(resources[section.key])
		expect(wrapper.find(selector).exists()).toBe(false)
	})
})

describe('batch skeleton sizing', () => {
	it('draws one course row per course the batch reports', () => {
		const wrapper = mountWith(BatchCourseList, {
			batchName: 'B1',
			editable: true,
			expected: 3,
		})
		const rows = wrapper.findAll(
			'[data-testid="batch-courses-skeleton"] .size-10'
		)
		expect(rows).toHaveLength(3)
	})

	it('draws the empty tile when the batch reports no courses', () => {
		const wrapper = mountWith(BatchCourseList, {
			batchName: 'B1',
			editable: true,
			expected: 0,
		})
		expect(
			wrapper
				.find('[data-testid="batch-courses-skeleton"] .border-dashed')
				.exists()
		).toBe(true)
	})

	it('leaves a learner with no courses nothing to replace', () => {
		const wrapper = mountWith(BatchCourseList, {
			batchName: 'B1',
			editable: false,
			expected: 0,
		})
		expect(wrapper.find('section').exists()).toBe(false)
	})
})
