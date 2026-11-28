import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, reactive } from 'vue'

const { state } = vi.hoisted(() => ({ state: { resource: null as any } }))

vi.mock('frappe-ui', async () => {
	const { reactive } = await import('vue')
	return {
		createDocumentResource: () => {
			const resource = reactive({
				doc: null as Record<string, unknown> | null,
				// Async like the real reload, so the form's watcher sees the doc arrive.
				reload: vi.fn(async () => {
					await Promise.resolve()
					resource.doc = {
						name: 'C1',
						title: 'Course',
						short_introduction: 'Intro',
						description: '<p>About</p>',
						instructors: [{ instructor: 'ash@example.com' }],
						related_courses: [],
					}
				}),
				setValue: { submit: vi.fn(), loading: false },
			})
			state.resource = resource
			return resource
		},
		toast: { success: vi.fn(), error: vi.fn() },
	}
})
vi.mock('@/utils', () => ({ getMetaInfo: vi.fn(), updateMetaInfo: vi.fn() }))

import { useCourseForm } from '@/composables/useCourseForm'
import type { CourseForm } from '@/composables/useCourseForm'

const mountForm = async (): Promise<CourseForm> => {
	let form!: CourseForm
	const course = reactive({ data: { name: 'C1' }, reload: vi.fn() })
	mount(
		defineComponent({
			setup() {
				form = useCourseForm('C1', course as never, () => true)
				return () => h('div')
			},
		})
	)
	await flushPromises()
	return form
}

describe('the course form', () => {
	beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }))
	afterEach(() => vi.useRealTimers())

	it('waits for Save instead of saving edits on its own', async () => {
		const form = await mountForm()
		form.resource.doc!.title = 'Renamed'
		form.markDirty()
		vi.advanceTimersByTime(5000)
		expect(state.resource.setValue.submit).not.toHaveBeenCalled()
		expect(form.isDirty.value).toBe(true)
		form.submitCourse()
		expect(state.resource.setValue.submit).toHaveBeenCalledTimes(1)
	})
})
