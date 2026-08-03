import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

// Stub @vueuse/core so the sheet's scroll-lock / swipe / key-listener helpers
// don't touch real globals in jsdom. We assert behavior via the component's
// own emitted events and rendered DOM, not the library internals.
const keydownHandlers: Array<(e: KeyboardEvent) => void> = []
vi.mock('@vueuse/core', () => ({
	useScrollLock: () => ({ value: false }),
	useSwipe: () => ({ lengthY: { value: 0 }, isSwiping: { value: false } }),
	useEventListener: (
		_target: unknown,
		event: string,
		handler: (e: KeyboardEvent) => void
	) => {
		if (event === 'keydown') keydownHandlers.push(handler)
	},
}))

import BottomSheet from '@/components/BottomSheet.vue'

const mountSheet = (props: Record<string, unknown> = {}, slots = {}) =>
	mount(BottomSheet, {
		props,
		slots,
		attachTo: document.body,
		global: { stubs: { teleport: true } },
	})

describe('BottomSheet', () => {
	it('renders nothing when closed', () => {
		const wrapper = mountSheet({ modelValue: false }, { default: 'BODY' })
		expect(wrapper.html()).not.toContain('BODY')
	})

	it('renders the title and body slot when open', () => {
		const wrapper = mountSheet(
			{ modelValue: true, title: 'Contents' },
			{ default: '<div class="body">BODY</div>' }
		)
		expect(wrapper.text()).toContain('Contents')
		expect(wrapper.find('.body').text()).toBe('BODY')
	})

	it('prefers the header slot over the title prop', () => {
		const wrapper = mountSheet(
			{ modelValue: true, title: 'Ignored' },
			{ header: '<div class="hdr">Custom</div>' }
		)
		expect(wrapper.find('.hdr').exists()).toBe(true)
		expect(wrapper.text()).not.toContain('Ignored')
	})

	it('emits update:modelValue=false when the backdrop is tapped', async () => {
		const wrapper = mountSheet({ modelValue: true })
		// The backdrop is the first fixed-inset element.
		await wrapper.find('.bg-black\\/40').trigger('click')
		expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
	})

	it('closes on Escape while open', () => {
		keydownHandlers.length = 0
		const wrapper = mountSheet({ modelValue: true })
		keydownHandlers.forEach((h) =>
			h(new KeyboardEvent('keydown', { key: 'Escape' }))
		)
		expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
	})
})
