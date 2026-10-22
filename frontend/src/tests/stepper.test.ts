import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { Stepper } from '@/components/Stepper'
import type { StepItem } from '@/components/Stepper'

vi.mock('frappe-ui', () => ({
	Progress: {
		props: ['value', 'intervals'],
		template: '<div role="progressbar" />',
	},
}))

const steps: StepItem[] = [
	{ value: 'a', label: 'Students' },
	{ value: 'b', label: 'Payments' },
	{ value: 'c', label: 'Review' },
]

const render = (props: Record<string, unknown>) =>
	mount(Stepper, { props: { steps, ...props } })

describe('Stepper', () => {
	it('marks the current step with aria-current="step"', () => {
		const items = render({ modelValue: 'b' }).findAll('li')
		expect(items[1].attributes('aria-current')).toBe('step')
		expect(items[0].attributes('aria-current')).toBeUndefined()
	})

	it('makes finished steps buttons only when clickable', () => {
		expect(render({ modelValue: 'b' }).findAll('button')).toHaveLength(0)
		expect(
			render({ modelValue: 'b', clickable: true }).findAll('button')
		).toHaveLength(1)
	})

	it('emits update:modelValue with the clicked finished step', async () => {
		const wrapper = render({ modelValue: 'b', clickable: true })
		await wrapper.find('button').trigger('click')
		expect(wrapper.emitted('update:modelValue')).toEqual([['a']])
	})

	it('turns every step complete and stops clicks when completed', () => {
		const wrapper = render({ completed: true, clickable: true })
		expect(wrapper.findAll('button')).toHaveLength(0)
		expect(wrapper.findAll('li[data-state="complete"]')).toHaveLength(3)
	})
})
