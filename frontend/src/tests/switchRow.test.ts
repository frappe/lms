import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import SwitchRow from '@/components/Controls/SwitchRow.vue'

enableAutoUnmount(afterEach)

vi.mock('frappe-ui', () => ({
	Switch: {
		name: 'SwitchStub',
		props: ['modelValue', 'disabled'],
		emits: ['update:modelValue'],
		template: `<button type="button" role="switch" :aria-checked="String(Boolean(modelValue))" :disabled="disabled" @click="$emit('update:modelValue', !modelValue)" />`,
	},
}))

const control = (w: ReturnType<typeof mount>) => w.get('[role="switch"]')

describe('SwitchRow', () => {
	it('labels and describes the switch by id', () => {
		const w = mount(SwitchRow, {
			props: { label: 'Disable signup', description: 'Admins add users.' },
		})
		const label = w.get('[data-testid="switch-label"]')
		const description = w.get('[data-testid="switch-description"]')
		expect(label.text()).toBe('Disable signup')
		expect(description.text()).toBe('Admins add users.')
		expect(control(w).attributes('aria-labelledby')).toBe(
			label.attributes('id')
		)
		expect(control(w).attributes('aria-describedby')).toBe(
			description.attributes('id')
		)
	})

	it('drops the description and its reference when there is none', () => {
		const w = mount(SwitchRow, { props: { label: 'Enabled' } })
		expect(w.find('[data-testid="switch-description"]').exists()).toBe(false)
		expect(control(w).attributes('aria-describedby')).toBeUndefined()
	})

	it('renders the label and description slots in place of the props', () => {
		const w = mount(SwitchRow, {
			props: { label: 'Preview' },
			slots: {
				label: '<span data-testid="custom-label">Preview ?</span>',
				description: 'Slotted text',
			},
		})
		expect(w.find('[data-testid="custom-label"]').exists()).toBe(true)
		expect(w.get('[data-testid="switch-description"]').text()).toBe(
			'Slotted text'
		)
		expect(control(w).attributes('aria-describedby')).toBeDefined()
	})

	it('toggles through v-model and passes listeners and attrs to the switch', async () => {
		const onToggle = vi.fn()
		const w = mount(SwitchRow, {
			props: {
				label: 'Enabled',
				modelValue: false,
				'onUpdate:modelValue': (value: boolean) => {
					onToggle(value)
					w.setProps({ modelValue: value })
				},
			},
			attrs: { 'data-testid': 'enabled-toggle' },
		})
		const toggle = w.get('[data-testid="enabled-toggle"]')
		expect(toggle.attributes('aria-checked')).toBe('false')
		await toggle.trigger('click')
		expect(onToggle).toHaveBeenCalledWith(true)
		expect(toggle.attributes('aria-checked')).toBe('true')
	})

	it('flips the switch when the label is clicked', async () => {
		const w = mount(SwitchRow, {
			props: {
				label: 'Enabled',
				modelValue: false,
				'onUpdate:modelValue': (value: boolean) =>
					w.setProps({ modelValue: value }),
			},
			attachTo: document.body,
		})
		const label = w.get('[data-testid="switch-label"]')
		expect(label.attributes('for')).toBe(control(w).attributes('id'))
		await label.trigger('click')
		expect(control(w).attributes('aria-checked')).toBe('true')
	})

	it('leaves a disabled switch alone when the label is clicked', async () => {
		const onToggle = vi.fn()
		const w = mount(SwitchRow, {
			props: {
				label: 'Enabled',
				disabled: true,
				modelValue: false,
				'onUpdate:modelValue': onToggle,
			},
			attachTo: document.body,
		})
		await w.get('[data-testid="switch-label"]').trigger('click')
		expect(onToggle).not.toHaveBeenCalled()
		expect(control(w).attributes('aria-checked')).toBe('false')
	})

	it('passes disabled through to the switch', () => {
		const w = mount(SwitchRow, { props: { label: 'Enabled', disabled: true } })
		expect(control(w).attributes('disabled')).toBeDefined()
	})
})
