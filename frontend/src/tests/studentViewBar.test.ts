import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

vi.stubGlobal('__', (text: string) => text)

const { resources, toast } = vi.hoisted(() => ({
	resources: {} as Record<string, { submit: ReturnType<typeof vi.fn> }>,
	toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('frappe-ui', async (importOriginal) => {
	const actual = await importOriginal<Record<string, unknown>>()
	return {
		...actual,
		toast,
		createResource: (options: {
			url: string
			makeParams: () => Record<string, unknown>
		}) => {
			const resource = {
				loading: false,
				params: null as Record<string, unknown> | null,
				submit: vi.fn((_params: unknown, handlers: Record<string, any>) => {
					resource.params = options.makeParams()
					const outcome = resources[options.url]?.submit()
					if (outcome instanceof Error) {
						handlers.onError?.({ messages: [outcome.message] })
						return Promise.reject(outcome)
					}
					handlers.onSuccess?.(null)
					return Promise.resolve(null)
				}),
			}
			resources[`${options.url}:resource`] = resource as never
			return resource
		},
		Dialog: defineComponent({
			props: ['open', 'title', 'message', 'actions'],
			setup(props) {
				return () =>
					props.open
						? h('div', { class: 'dialog' }, [
								h('p', props.message),
								...props.actions.map((action: any) =>
									h('button', { class: 'confirm', onClick: action.onClick }, [
										action.label,
									])
								),
						  ])
						: null
			},
		}),
	}
})

import StudentViewBar from '@/components/StudentViewBar.vue'

const ENROLL = 'lms.lms.student_view.enroll_self'
const RESET = 'lms.lms.student_view.reset_own_progress'

const mountBar = (
	modelValue = 'not-enrolled',
	doctype = 'LMS Course',
	name = 'COURSE-1'
) =>
	mount(StudentViewBar, {
		props: {
			modelValue,
			doctype,
			name,
			'onUpdate:modelValue': (value: string) =>
				wrapper.setProps({ modelValue: value }),
		},
		global: { mocks: { __: (text: string) => text } },
	})
let wrapper: ReturnType<typeof mountBar>

const tab = (label: string) =>
	wrapper.findAll('[data-slot="tab-button"]').find((b) => b.text() === label)!

describe('StudentViewBar', () => {
	beforeEach(() => {
		for (const key of Object.keys(resources)) delete resources[key]
		toast.success.mockClear()
		toast.error.mockClear()
	})

	it('writes out both modes next to their icons, with the note and exit', () => {
		wrapper = mountBar()
		expect(tab('Not enrolled').find('.lucide-user-round').exists()).toBe(true)
		expect(tab('Enrolled').find('.lucide-user-round-check').exists()).toBe(true)
		expect(wrapper.text()).toContain(
			'Nothing you do here is saved to a real learner'
		)
		expect(wrapper.text()).toContain('Exit')
		expect(wrapper.text()).not.toContain('Reset progress')
	})

	it('collapses reset and exit to icon buttons on phones', async () => {
		const width = window.innerWidth
		window.innerWidth = 400
		wrapper = mountBar('enrolled')
		await flushPromises()
		window.innerWidth = width

		for (const [label, icon] of [
			['Exit student view', '.lucide-x'],
			['Reset progress', '.lucide-rotate-ccw'],
		]) {
			const button = wrapper.find(`button[aria-label="${label}"]`)
			expect(button.text()).toBe('')
			expect(button.find(icon).exists()).toBe(true)
			expect(button.classes()).toContain('w-7')
		}
	})

	it('enrolls the instructor when they switch to enrolled', async () => {
		wrapper = mountBar()
		await tab('Enrolled').trigger('click')
		await flushPromises()

		const enroll = resources[`${ENROLL}:resource`] as any
		expect(enroll.submit).toHaveBeenCalledTimes(1)
		expect(enroll.params).toEqual({ doctype: 'LMS Course', name: 'COURSE-1' })
		expect(wrapper.emitted('change')).toHaveLength(1)
		expect(wrapper.props('modelValue')).toBe('enrolled')
	})

	it('waits for the course before enrolling on arrival', async () => {
		wrapper = mountBar('enrolled', 'LMS Course', '')
		await flushPromises()
		const enroll = resources[`${ENROLL}:resource`] as any
		expect(enroll.submit).not.toHaveBeenCalled()
		expect(wrapper.props('modelValue')).toBe('enrolled')

		await wrapper.setProps({ name: 'COURSE-1' })
		await flushPromises()
		expect(enroll.submit).toHaveBeenCalledTimes(1)
		expect(enroll.params).toEqual({ doctype: 'LMS Course', name: 'COURSE-1' })
		expect(wrapper.props('modelValue')).toBe('enrolled')
	})

	it('falls back to not enrolled when enrolling fails', async () => {
		resources[ENROLL] = { submit: vi.fn(() => new Error('Seats are full')) }
		wrapper = mountBar()
		await tab('Enrolled').trigger('click')
		await flushPromises()

		expect(toast.error).toHaveBeenCalledWith('Seats are full')
		expect(wrapper.props('modelValue')).toBe('not-enrolled')
		expect(wrapper.emitted('change')).toBeUndefined()
	})

	it('resets progress only after the confirm dialog', async () => {
		wrapper = mountBar('enrolled', 'LMS Batch')
		await flushPromises()
		const reset = resources[`${RESET}:resource`] as any

		const button = wrapper
			.findAll('button')
			.find((b) => b.text() === 'Reset progress')!
		await button.trigger('click')
		expect(reset.submit).not.toHaveBeenCalled()
		expect(wrapper.find('.dialog').text()).toContain(
			'every course of this batch'
		)

		await wrapper.find('.confirm').trigger('click')
		await flushPromises()
		expect(reset.params).toEqual({ doctype: 'LMS Batch', name: 'COURSE-1' })
		expect(toast.success).toHaveBeenCalled()
		expect(wrapper.find('.dialog').exists()).toBe(false)
	})

	it('sticks and adds its height to the sticky stack while shown', () => {
		wrapper = mountBar()
		const root = document.documentElement.style
		expect(wrapper.find('[role="region"]').classes()).toEqual(
			expect.arrayContaining(['sticky', 'top-0'])
		)
		expect(root.getPropertyValue('--student-view-bar-h')).toMatch(/px$/)

		wrapper.unmount()
		expect(root.getPropertyValue('--student-view-bar-h')).toBe('')
	})

	it('exits without touching the enrollment', async () => {
		wrapper = mountBar()
		const exit = wrapper.findAll('button').find((b) => b.text() === 'Exit')!
		await exit.trigger('click')

		expect(wrapper.emitted('exit')).toHaveLength(1)
		expect(
			(resources[`${ENROLL}:resource`] as any).submit
		).not.toHaveBeenCalled()
		expect(
			(resources[`${RESET}:resource`] as any).submit
		).not.toHaveBeenCalled()
	})
})
