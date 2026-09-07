import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import StudentLessonSidebar from '@/components/StudentLessonSidebar.vue'

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

vi.mock('vue-router', () => ({
	useRoute: () => ({ params: {}, query: {} }),
	useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('frappe-ui', () => ({
	createResource: () => ({ data: outline, reload: vi.fn() }),
}))

vi.stubGlobal('__', (s: string) => s)

const mountSidebar = () =>
	mount(StudentLessonSidebar, {
		props: {
			courseName: 'COURSE-1',
			courseTitle: 'Course 1',
			progress: 33,
			selectedLessonNumber: '1-2',
		},
		global: {
			mocks: { __: (s: string) => s },
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
