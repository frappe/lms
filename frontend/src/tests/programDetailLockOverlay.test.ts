import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'

vi.stubGlobal('__', (text: string) => text)
enableAutoUnmount(afterEach)

const { programResource } = vi.hoisted(() => ({
	programResource: {
		data: null as Record<string, unknown> | null,
		reload: () => {},
	},
}))

vi.mock('frappe-ui', () => ({
	createResource: () => programResource,
	call: () => new Promise(() => {}),
	usePageMeta: () => {},
	Badge: { template: '<span><slot /></span>' },
	Tooltip: { template: '<span><slot /></span>' },
}))

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/components/CourseCard.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/stores/session', () => ({ sessionStore: () => ({ brand: {} }) }))

import ProgramDetail from '@/pages/Programs/ProgramDetail.vue'

const mountWithLockedCourse = () => {
	programResource.data = {
		name: 'data-science',
		progress: 0,
		enforce_course_order: 1,
		courses: [{ name: 'C2', title: 'Advanced Pandas', eligible: false }],
	}
	return mount(ProgramDetail, {
		props: { programName: 'data-science' },
		global: {
			provide: { $user: { data: { name: 'student@example.com' } } },
			mocks: { __: (text: string) => text },
			stubs: {
				PageHeader: true,
				PageBody: { template: '<div><slot name="name" /><slot /></div>' },
			},
		},
	})
}

describe('the locked-course overlay', () => {
	it('stays hidden on touch until the card is pressed', async () => {
		const wrapper = mountWithLockedCourse()
		await flushPromises()

		const overlay = wrapper.find('.lucide-lock-keyhole').element.parentElement
		const classes = Array.from(overlay?.classList ?? [])

		expect(classes).toContain('invisible')
		expect(classes).toContain('group-hover:visible')
		expect(classes).toContain('[@media(hover:none)]:group-active:visible')
		expect(classes).not.toContain('[@media(hover:none)]:visible')
	})
})
