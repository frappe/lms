/**
 * InfoTip is a tooltip that a tap also opens: reka's tooltip trigger ignores
 * touch, so without the click toggle a phone could never read the hint.
 */
import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import InfoTip from '@/components/InfoTip.vue'

const bubble = () =>
	document.body.querySelector('[data-testid="info-tip-bubble"]')

const mountTip = () =>
	mount(InfoTip, {
		props: { label: 'About the schedule', text: 'Shown once you add classes' },
		attachTo: document.body,
	})

// reka sizes the tooltip arrow with one; jsdom has none.
window.ResizeObserver = class {
	observe() {}
	unobserve() {}
	disconnect() {}
}

describe('InfoTip', () => {
	it('is named by its label and described by its hint', () => {
		const wrapper = mountTip()
		const button = wrapper.get('button[aria-label="About the schedule"]')
		const hint = document.getElementById(button.attributes('aria-describedby')!)

		expect(hint?.textContent).toBe('Shown once you add classes')
		expect(bubble()).toBeNull()
	})

	it('toggles the hint open and closed on a tap', async () => {
		const button = mountTip().get('button')

		await button.trigger('pointerdown', { pointerType: 'touch' })
		await button.trigger('click')
		await flushPromises()
		expect(bubble()?.textContent?.trim()).toBe('Shown once you add classes')

		await button.trigger('pointerdown', { pointerType: 'touch' })
		await button.trigger('click')
		await flushPromises()
		expect(bubble()).toBeNull()
	})

	it('keeps a hint open when a mouse click follows the hover that opened it', async () => {
		const button = mountTip().get('button')

		await button.trigger('pointerdown', { pointerType: 'mouse' })
		await button.trigger('click')
		await button.trigger('pointerdown', { pointerType: 'mouse' })
		await button.trigger('click')
		await flushPromises()
		expect(bubble()?.textContent?.trim()).toBe('Shown once you add classes')
	})

	it('opens on keyboard focus like a tooltip', async () => {
		await mountTip().get('button').trigger('focus')
		await flushPromises()

		expect(bubble()?.textContent?.trim()).toBe('Shown once you add classes')
	})
})
