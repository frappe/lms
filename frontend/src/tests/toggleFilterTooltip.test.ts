// Real Tooltip and Checkbox, so reka-ui does the as-child merge. Proves the
// trigger attrs land on ToggleFilter's span and focus still opens the tooltip.
import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ToggleFilter from '@/components/Controls/ToggleFilter.vue'

vi.mock('@/utils/composables', async () => {
	const { computed } = await import('vue')
	return {
		MOBILE_BREAKPOINT: 640,
		useScreenSize: () => ({ isMobile: computed(() => false) }),
	}
})

vi.stubGlobal(
	'ResizeObserver',
	class {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
)

function mountFilter(modelValue = true) {
	return mount(ToggleFilter, {
		props: { modelValue, label: 'Active', tooltip: 'Only active' },
		attachTo: document.body,
		global: { mocks: { __: (s: string) => s } },
	})
}

describe('ToggleFilter desk tooltip trigger', () => {
	it('lands the trigger attributes on the wrapping span', () => {
		const wrapper = mountFilter()
		const trigger = wrapper.find('[data-slot="trigger"]')
		expect(trigger.exists()).toBe(true)
		expect(trigger.element.tagName).toBe('SPAN')
		expect(trigger.attributes('data-state')).toBe('closed')
		wrapper.unmount()
	})

	it('leaves the checkbox input its own data-slot and data-state', () => {
		const wrapper = mountFilter()
		const input = wrapper.find('input[type="checkbox"]')
		expect(input.attributes('data-slot')).toBe('control')
		expect(input.attributes('data-state')).toBe('checked')
		expect(input.element.closest('[data-slot="trigger"]')).not.toBeNull()
		wrapper.unmount()
	})
})

describe('ToggleFilter desk tooltip keyboard access', () => {
	it('opens the tooltip when the checkbox input takes focus', async () => {
		const wrapper = mountFilter()
		const input = wrapper.find('input[type="checkbox"]')
		;(input.element as HTMLInputElement).focus()
		expect(document.activeElement).toBe(input.element)
		await flushPromises()
		const trigger = wrapper.find('[data-slot="trigger"]')
		expect(trigger.attributes('data-state')).not.toBe('closed')
		const bubble = document.body.querySelector('[data-slot="bubble"]')
		expect(bubble?.textContent).toContain('Only active')
		;(input.element as HTMLInputElement).blur()
		await flushPromises()
		expect(trigger.attributes('data-state')).toBe('closed')
		wrapper.unmount()
	})

	it('describes the checkbox input with the tooltip text', () => {
		const wrapper = mountFilter()
		const input = wrapper.find('input[type="checkbox"]')
		expect(input.attributes('aria-description')).toBe('Only active')
		wrapper.unmount()
	})
})

describe('ToggleFilter desk emit', () => {
	it('emits once per toggle through the real Checkbox', async () => {
		const wrapper = mountFilter(false)
		const input = wrapper.find('input[type="checkbox"]')

		await input.setValue(true)
		expect(wrapper.emitted('update:modelValue')).toEqual([[true]])

		await wrapper.setProps({ modelValue: true })
		await input.setValue(false)
		expect(wrapper.emitted('update:modelValue')).toEqual([[true], [false]])
		wrapper.unmount()
	})
})
