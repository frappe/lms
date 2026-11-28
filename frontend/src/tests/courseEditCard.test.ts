import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { mount } from '@vue/test-utils'

vi.mock('frappe-ui', () => ({
	Button: { template: '<button><slot /></button>' },
	Dialog: { template: '<div />' },
}))
vi.mock('@/utils', () => ({ openSettings: vi.fn() }))
vi.mock('@/stores/settings', () => ({
	useSettings: () => ({ settings: { data: null } }),
}))
const { inert } = vi.hoisted(() => ({
	inert: () => ({ default: { render: () => null } }),
}))
vi.mock('@/components/Courses/CourseCertificateBox.vue', inert)
vi.mock('@/components/Courses/CourseIncludes.vue', inert)
vi.mock('@/components/Courses/CourseVideoField.vue', inert)
vi.mock('@/components/InlineEdit/PriceField.vue', inert)

import CourseEditCard from '@/components/Courses/CourseEditCard.vue'

const mountCard = (doc: Record<string, unknown>) =>
	mount(CourseEditCard, {
		props: { course: { data: null } as never },
		global: {
			mocks: { __: (text: string) => text },
			provide: {
				courseForm: {
					resource: reactive({ doc }),
					markDirty: () => {},
					isMissing: () => false,
				},
			},
		},
	})

describe('the course card as instructors edit it', () => {
	it('notes only that self enrollment is off, nothing under an open button', () => {
		expect(mountCard({}).find('p').exists()).toBe(false)
		expect(mountCard({ disable_self_learning: 1 }).text()).toContain(
			'Self enrollment is off'
		)
	})
})
