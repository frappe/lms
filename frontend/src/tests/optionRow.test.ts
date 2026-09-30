// Guards the shared option row's slots and its unfilled, bordered look.
// Came with this branch's shared assessment components.
// Added on feat/assessment-visual-redesign with the quiz card restyle.
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import OptionRow from '@/components/Assessment/OptionRow.vue'

describe('OptionRow', () => {
	it('renders the control slot and the default slot', () => {
		const wrapper = mount(OptionRow, {
			slots: {
				control: '<input type="radio" data-testid="control" />',
				default: 'Scheduling work orders',
			},
		})
		expect(wrapper.find('[data-testid="control"]').exists()).toBe(true)
		expect(wrapper.text()).toContain('Scheduling work orders')
	})

	it('is a bordered row with no fill color', () => {
		const wrapper = mount(OptionRow)
		expect(wrapper.classes()).toContain('border')
		expect(wrapper.classes()).not.toContain('bg-surface-gray-3')
	})
})
