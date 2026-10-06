import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.stubGlobal('__', (text: string) => text)
// translation.js installs String.prototype.format at app boot; the component
// calls __('No {0} Found').format(name) and never reaches Vue without it.
if (!('format' in String.prototype)) {
	// eslint-disable-next-line no-extend-native
	Object.defineProperty(String.prototype, 'format', {
		value: function (...args: string[]) {
			return this.replace(/\{(\d+)\}/g, (_: string, i: number) => args[i] ?? '')
		},
	})
}

import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'

// The class strings ARE the behaviour, since this component renders nothing
// but layout. Each assertion below fails if its class is removed.
const mountEmpty = (props: Record<string, unknown> = {}) =>
	mount(EmptyStateLayout, {
		props: { name: 'Courses', ...props },
		global: { mocks: {}, stubs: {} },
	})

describe('EmptyStateLayout', () => {
	// Was `absolute` with `top-1/3`, which sits near the top of any container
	// taller than a phone screen instead of centered. Flex on the root is
	// what actually centers it regardless of container height.
	it('centers vertically, not just horizontally', () => {
		const outer = mountEmpty().element

		expect(outer.className).toContain('items-center')
		expect(outer.className).not.toContain('top-1/3')
	})

	it('fills the phone width, and only narrows from sm up', () => {
		const panel = mountEmpty().get('[class*="flex-col"]')

		expect(panel.classes()).toContain('w-full')
		expect(panel.classes()).toContain('sm:w-4/12')
		// The unqualified fractional width was the bug: ~130px on a 390px screen.
		expect(panel.classes()).not.toContain('w-4/12')
	})

	it('keeps the desktop widths behind sm for every size', () => {
		expect(
			mountEmpty({ width: 'sm' }).get('[class*="flex-col"]').classes()
		).toContain('sm:w-2/12')
		expect(
			mountEmpty({ width: 'lg' }).get('[class*="flex-col"]').classes()
		).toContain('sm:w-8/12')
	})

	it('draws a larger icon on a phone than on the desk', () => {
		const icon = mountEmpty().get('span.lucide-graduation-cap')

		expect(icon.classes()).toContain('size-10')
		expect(icon.classes()).toContain('sm:size-7.5')
	})

	it('steps the type down on a phone rather than up', () => {
		const wrapper = mountEmpty()
		const title = wrapper.get('.text-base-medium')
		const description = wrapper.get('.text-p-sm')

		expect(title.classes()).toContain('sm:text-lg-medium')
		expect(description.classes()).toContain('sm:text-p-base')
	})

	it('centres via flex, not a physical offset, so RTL is unaffected', () => {
		const outer = mountEmpty().element

		expect(outer.className).toContain('items-center')
		expect(outer.className).toContain('justify-center')
		expect(outer.className).not.toContain('left-1/2')
	})

	it('still renders the copy it is given', () => {
		const wrapper = mountEmpty({
			title: 'Nothing here',
			description: 'Try again later',
		})

		expect(wrapper.text()).toContain('Nothing here')
		expect(wrapper.text()).toContain('Try again later')
	})
})
