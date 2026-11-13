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
	Button: {
		name: 'Button',
		template: `<button type="button"><slot /></button>`,
	},
	Tooltip: { name: 'Tooltip', template: `<span><slot /></span>` },
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

	// Regression on this branch only, no upstream PR: settings switches kept their
	// own row to get these. Added on fix/course-progress-enforcement (no PR yet).
	it('flips the switch when the description is clicked', async () => {
		const w = mount(SwitchRow, {
			props: {
				label: 'Enabled',
				description: 'Shown to learners.',
				modelValue: false,
				'onUpdate:modelValue': (value: boolean) =>
					w.setProps({ modelValue: value }),
			},
			attachTo: document.body,
		})
		await w.get('[data-testid="switch-description"]').trigger('click')
		expect(control(w).attributes('aria-checked')).toBe('true')
	})

	it('keeps the caution out of the label so it does not toggle', async () => {
		const onToggle = vi.fn()
		const w = mount(SwitchRow, {
			props: {
				label: 'Videos',
				caution: 'Embeds are not tracked.',
				modelValue: false,
				'onUpdate:modelValue': onToggle,
			},
			attachTo: document.body,
		})
		const caution = w.get('button[aria-label="Embeds are not tracked."]')
		expect(caution.element.closest('label')).toBeNull()
		await caution.trigger('click')
		expect(onToggle).not.toHaveBeenCalled()
	})
})
