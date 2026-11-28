import { afterEach, describe, expect, it } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import SwitchRow from '@/components/Controls/SwitchRow.vue'
import BooleanSwitch from '@/components/Controls/BooleanSwitch.vue'
import SettingSwitch from '@/components/InlineEdit/SettingSwitch.vue'

enableAutoUnmount(afterEach)

function mountRow(props: Record<string, unknown> = {}) {
	const updates: boolean[] = []
	const wrapper = mount(SwitchRow, {
		props: {
			label: 'Enabled',
			description: 'Shown to learners.',
			modelValue: false,
			'onUpdate:modelValue': (value: boolean) => {
				updates.push(value)
				wrapper.setProps({ modelValue: value })
			},
			...props,
		},
		attachTo: document.body,
	})
	return { wrapper, updates }
}

const control = (wrapper: ReturnType<typeof mount>) =>
	wrapper.get('[role="switch"]')

describe('SwitchRow toggles from anywhere on the row', () => {
	it.each([
		['the label', '[data-testid="switch-label"]'],
		['the description', '[data-testid="switch-description"]'],
		['the row padding', '[data-testid="switch-row"]'],
		['the switch', '[role="switch"]'],
	])('toggles exactly once from %s', async (_, selector) => {
		const { wrapper, updates } = mountRow()
		await wrapper.get(selector).trigger('click')
		expect(updates).toEqual([true])
		expect(control(wrapper).attributes('aria-checked')).toBe('true')
	})

	it('toggles once with Enter on the focused switch, and Space stays native', async () => {
		const { wrapper, updates } = mountRow()
		expect(control(wrapper).element.tagName).toBe('BUTTON')
		await control(wrapper).trigger('keydown', { key: 'Enter' })
		expect(updates).toEqual([true])
	})

	it('ignores clicks anywhere when disabled', async () => {
		const { wrapper, updates } = mountRow({ disabled: true })
		for (const selector of [
			'[data-testid="switch-row"]',
			'[data-testid="switch-label"]',
			'[data-testid="switch-description"]',
		])
			await wrapper.get(selector).trigger('click')
		expect(updates).toEqual([])
		expect(wrapper.get('[data-testid="switch-row"]').classes()).toContain(
			'cursor-not-allowed'
		)
	})

	it('puts the switch before the label when asked', () => {
		const { wrapper } = mountRow({ controlPosition: 'start' })
		const row = wrapper.get('[data-testid="switch-row"]').classes()
		expect(row).toContain('flex-row-reverse')
		expect(row).toContain('w-fit')
	})

	it('puts the caller class on the row and other attributes on the switch', () => {
		const { wrapper } = mountRow({ class: 'py-3', 'data-label': 'Enabled' })
		expect(wrapper.get('[data-testid="switch-row"]').classes()).toContain(
			'py-3'
		)
		expect(control(wrapper).attributes('data-label')).toBe('Enabled')
	})
})

describe('number fields', () => {
	it('keeps a 0/1 value a number from a row click', async () => {
		const wrapper = mount(BooleanSwitch, {
			props: { label: 'Featured', modelValue: 0 },
			attachTo: document.body,
		})
		await wrapper.get('[data-testid="switch-row"]').trigger('click')
		expect(wrapper.emitted('update:modelValue')).toEqual([[1]])
	})

	it('renders a settings row that toggles from its summary', async () => {
		const wrapper = mount(SettingSwitch, {
			props: { label: 'Featured', summary: 'On the home page.', modelValue: 1 },
			attachTo: document.body,
		})
		expect(wrapper.get('[data-testid="switch-row"]').classes()).toContain(
			'py-3.5'
		)
		await wrapper.get('[data-testid="switch-description"]').trigger('click')
		expect(wrapper.emitted('update:modelValue')).toEqual([[0]])
	})
})
