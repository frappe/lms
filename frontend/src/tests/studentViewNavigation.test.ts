/**
 * Student view is a mode carried in the URL (`?studentView=1`), not a
 * destination, so every hop that stays on a lesson has to preserve it. The
 * sidebar's lesson links dropped it, which silently returned a previewing
 * moderator to their own identity on the first click, with grading panels and
 * instructor notes reappearing mid-course with no visible cause.
 */
import { mount, RouterLinkStub } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import StudentLessonSidebar from '@/components/StudentLessonSidebar.vue'

const query = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))

vi.mock('vue-router', () => ({
	useRoute: () => ({ params: {}, query: query.current }),
	useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('frappe-ui', () => ({
	createResource: () => ({
		data: [
			{
				name: 'CH-1',
				title: 'Chapter 1',
				lessons: [
					{ name: 'LESSON-1', title: 'Lesson 1', number: '1-1' },
					{ name: 'LESSON-2', title: 'Lesson 2', number: '1-2' },
				],
			},
		],
		loading: false,
		reload: vi.fn(),
		fetch: vi.fn(),
	}),
	Progress: { template: `<div />` },
}))

vi.mock('@headlessui/vue', () => ({
	Disclosure: { template: `<div><slot :open="true" /></div>` },
	DisclosureButton: { template: `<button><slot /></button>` },
	DisclosurePanel: { template: `<div><slot /></div>` },
}))

vi.stubGlobal('__', (s: string) => s)

function mountSidebar() {
	return mount(StudentLessonSidebar, {
		props: { courseName: 'course-1', courseTitle: 'Course 1' },
		global: {
			mocks: { __: (s: string) => s },
			stubs: { 'router-link': RouterLinkStub },
		},
	})
}

function lessonLinkTargets(wrapper: ReturnType<typeof mountSidebar>) {
	return wrapper
		.findAllComponents(RouterLinkStub)
		.map((link) => link.props('to') as Record<string, any>)
		.filter((to) => to?.name === 'Lesson')
}

describe('StudentLessonSidebar lesson links', () => {
	it('carries ?studentView=1 onward while previewing', () => {
		query.current = { studentView: '1' }

		const targets = lessonLinkTargets(mountSidebar())

		expect(targets.length).toBeGreaterThan(0)
		for (const to of targets) {
			expect(to.query).toEqual({ studentView: 1 })
		}
	})

	it('leaves the query off for an ordinary student', () => {
		query.current = {}

		const targets = lessonLinkTargets(mountSidebar())

		expect(targets.length).toBeGreaterThan(0)
		for (const to of targets) {
			expect(to.query).toBeUndefined()
		}
	})

	it('ignores a studentView value that is not the flag', () => {
		query.current = { studentView: '0' }

		for (const to of lessonLinkTargets(mountSidebar())) {
			expect(to.query).toBeUndefined()
		}
	})
})
