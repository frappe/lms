import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StudentLessonSidebar from '@/components/StudentLessonSidebar.vue'
import { translate } from './helpers/translate'

const outline = vi.hoisted(() => [
	{
		name: 'CH-1',
		title: 'Chapter 1',
		idx: 1,
		lessons: [
			{
				name: 'L1',
				title: 'Lesson 1',
				number: '1-1',
				is_complete: 1,
				locked: 0,
			},
			{
				name: 'L2',
				title: 'Lesson 2',
				number: '1-2',
				is_complete: 0,
				locked: 0,
			},
			{
				name: 'L3',
				title: 'Lesson 3',
				number: '1-3',
				is_complete: 0,
				locked: 1,
			},
		],
	},
])

const route = vi.hoisted(() => ({
	params: {},
	query: {} as Record<string, string>,
}))

vi.mock('vue-router', () => ({
	useRoute: () => route,
	useRouter: () => ({ push: vi.fn() }),
}))

const outlineParams = vi.hoisted(() => [] as (() => Record<string, unknown>)[])

vi.mock('frappe-ui', () => ({
	createResource: (options: { makeParams: () => Record<string, unknown> }) => {
		outlineParams.push(options.makeParams)
		return { data: outline, reload: vi.fn() }
	},
	Tooltip: {
		props: ['text'],
		template: '<span :data-tooltip="text"><slot /></span>',
	},
	Button: { template: '<button><slot name="icon" /><slot /></button>' },
}))

vi.stubGlobal('__', translate)

const mountSidebar = (extra: Record<string, unknown> = {}) =>
	mount(StudentLessonSidebar, {
		props: {
			courseName: 'COURSE-1',
			courseTitle: 'Course 1',
			progress: 33,
			selectedLessonNumber: '1-2',
			...extra,
		},
		global: {
			mocks: { __: translate },
			stubs: {
				'router-link': {
					props: ['to'],
					template: '<a><slot /></a>',
				},
			},
		},
	})

describe('StudentLessonSidebar locked lesson', () => {
	it('renders a lock for a locked lesson and no link', () => {
		const wrapper = mountSidebar()
		const rows = wrapper.findAll('li li')

		expect(rows).toHaveLength(3)
		expect(rows[2].find('a').exists()).toBe(false)
		expect(rows[2].find('.cursor-not-allowed').exists()).toBe(true)
		expect(rows[2].find('.sr-only').text()).toBe('Locked')
		expect(rows[2].find('[aria-label]').exists()).toBe(false)
		expect(rows[2].find('[aria-disabled]').exists()).toBe(false)
	})

	it('still links unlocked lessons', () => {
		const wrapper = mountSidebar()
		const rows = wrapper.findAll('li li')

		expect(rows[0].find('a').exists()).toBe(true)
		expect(rows[1].find('a').exists()).toBe(true)
	})

	it('does not emit select-lesson when a locked row is clicked', async () => {
		const wrapper = mountSidebar()
		const rows = wrapper.findAll('li li')

		await rows[2].find('.cursor-not-allowed').trigger('click')

		expect(wrapper.emitted('select-lesson')).toBeUndefined()
	})
})

describe('StudentLessonSidebar completed lesson', () => {
	// Guards: completion shown by an icon alone. Introduced in #2674; test added
	// with the a11y audit remediation.
	it('announces a completed lesson in text', () => {
		const rows = mountSidebar().findAll('li li')

		expect(rows[0].get('.sr-only').text()).toBe('Completed')
		expect(rows[1].find('.sr-only').exists()).toBe(false)
	})
})

describe('StudentLessonSidebar without progress', () => {
	// Guards #3010: a guest saw "Completed 0%" and an empty ring per lesson.
	const mountGuest = () =>
		mount(StudentLessonSidebar, {
			props: {
				courseName: 'COURSE-1',
				courseTitle: 'Course 1',
				selectedLessonNumber: '1-2',
				withProgress: false,
			},
			global: {
				mocks: { __: translate },
				stubs: { 'router-link': { template: '<a><slot /></a>' } },
			},
		})

	it('shows no completion summary or progress bar', () => {
		const wrapper = mountGuest()

		expect(wrapper.text()).not.toContain('Completed')
		expect(wrapper.find('[style*="width"]').exists()).toBe(false)
		expect(wrapper.text()).toContain('Course 1')
	})
})

describe('StudentLessonSidebar in a not-enrolled preview', () => {
	afterEach(() => {
		route.query = {}
	})

	it('asks the server for the outline a learner in that mode gets', () => {
		for (const [studentView, mode] of [
			['not-enrolled', 'not-enrolled'],
			['1', 'enrolled'],
		]) {
			route.query = { studentView }
			mountSidebar()
			expect(outlineParams.at(-1)!().student_view).toBe(mode)
		}
		route.query = {}
		mountSidebar()
		expect(outlineParams.at(-1)!().student_view).toBeNull()
	})

	it('keeps progress in the enrolled preview', () => {
		route.query = { studentView: '1' }
		const wrapper = mountSidebar()

		expect(wrapper.text()).toContain('33% completed')
		expect(wrapper.findAll('li li')[0].get('.sr-only').text()).toBe('Completed')
	})
})

describe('folding the student chapters panel', () => {
	it('offers a fold button only when the page lets it fold', async () => {
		expect(mountSidebar().find('[data-testid="hide-chapters"]').exists()).toBe(
			false
		)
		const wrapper = mountSidebar({ collapsible: true })
		await wrapper.get('[data-testid="hide-chapters"]').trigger('click')
		expect(wrapper.emitted('hide')).toHaveLength(1)
		expect(wrapper.text()).toContain('Course 1')
	})
})
