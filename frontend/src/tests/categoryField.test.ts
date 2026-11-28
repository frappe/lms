import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('@/utils', () => ({ createLMSCategory: vi.fn() }))
vi.mock('@/components/Controls/Link.vue', () => ({
	default: {
		name: 'Link',
		props: ['modelValue', 'icon', 'trigger', 'variant'],
		template: '<div />',
	},
}))

import CategoryField from '@/components/InlineEdit/CategoryField.vue'

describe('the category field', () => {
	it('draws its tag icon inside the select, as a ghost button', () => {
		const link = mount(CategoryField, {
			global: { mocks: { __: (text: string) => text } },
		}).getComponent({ name: 'Link' })
		expect(link.props('icon')).toBe('lucide-tag')
		expect(link.props('trigger')).toBe('button')
		expect(link.props('variant')).toBe('ghost')
	})
})
