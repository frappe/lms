/**
 * RelatedCourses.vue: guards the get_related_courses resource against a blank
 * courseName. A blank value sent no `course` arg at all, throwing a TypeError
 * the backend has no handler for and crashing every later assertion in the
 * same test file (frontend regression, 2026-09-11).
 */
import { describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import RelatedCourses from '@/components/RelatedCourses.vue'

let lastResourceOpts: { auto?: boolean } | undefined

vi.mock('frappe-ui', () => ({
	createResource: (opts: { url: string; auto?: boolean }) => {
		lastResourceOpts = opts
		return { data: null, reload: vi.fn(), refresh: vi.fn() }
	},
}))
vi.mock('@/components/CourseCard.vue', () => ({
	default: { template: '<div />' },
}))
vi.stubGlobal('__', (s: string) => s)

const mountRelated = (courseName: string) =>
	mount(RelatedCourses, {
		props: { courseName },
		global: {
			mocks: { __: (s: string) => s },
			stubs: { RouterLink: true },
			directives: { external: () => {} },
		},
	})

describe('RelatedCourses resource params', () => {
	it('does not auto-fire get_related_courses without a courseName', async () => {
		mountRelated('')
		await flushPromises()
		expect(lastResourceOpts?.auto).toBe(false)
	})

	it('auto-fires get_related_courses once a courseName is present', async () => {
		mountRelated('C1')
		await flushPromises()
		expect(lastResourceOpts?.auto).toBe(true)
	})
})
