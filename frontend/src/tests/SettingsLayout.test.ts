import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

// Stub frappe-ui's Button so importing it doesn't pull the full frappe-ui
// module graph (resources/*) into the test environment.
vi.mock('frappe-ui', () => ({
	Button: {
		name: 'Button',
		props: ['icon', 'variant'],
		template: '<button><slot /></button>',
	},
}))

import SettingsLayout from '@/components/Layouts/SettingsLayout.vue'

const mountLayout = (props: Record<string, unknown>, slots = {}) =>
	mount(SettingsLayout, {
		props,
		slots,
		global: { mocks: { __: (s: string) => s } },
	})

describe('SettingsLayout', () => {
	it('renders the title in a semantic h2 with the canonical classes', () => {
		const wrapper = mountLayout({ title: 'Categories' })
		const h2 = wrapper.get('h2')
		expect(h2.text()).toBe('Categories')
		expect(h2.classes()).toEqual(
			expect.arrayContaining([
				'text-p-xl',
				'font-semibold',
				'text-ink-gray-9',
			])
		)
	})

	it('renders the description only when provided', () => {
		expect(mountLayout({ title: 'X' }).find('p').exists()).toBe(false)
		const wrapper = mountLayout({ title: 'X', description: 'Hello' })
		const p = wrapper.get('p')
		expect(p.text()).toBe('Hello')
		expect(p.classes()).toEqual(
			expect.arrayContaining(['text-p-base', 'text-ink-gray-6'])
		)
	})

	it('renders default, header-actions and header-bottom slots', () => {
		const wrapper = mountLayout(
			{ title: 'X' },
			{
				default: '<div class="body">BODY</div>',
				'header-actions': '<button class="act">New</button>',
				'header-bottom': '<div class="hb">FILTER</div>',
			}
		)
		expect(wrapper.find('.body').text()).toBe('BODY')
		expect(wrapper.find('.act').exists()).toBe(true)
		expect(wrapper.find('.hb').exists()).toBe(true)
	})

	it('omits the header-actions wrapper when the slot is empty', () => {
		const wrapper = mountLayout({ title: 'X' })
		expect(wrapper.findAll('header > div').length).toBe(1)
	})
})
