import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CategoryChips from '@/components/CategoryChips.vue'

const options = [
	{ label: 'Business', value: 'Business' },
	{ label: 'Design', value: 'Design' },
]

const chips = (modelValue: string | null = null) =>
	mount(CategoryChips, {
		props: {
			options,
			modelValue,
			'onUpdate:modelValue': (value: string | null) =>
				wrapper.setProps({ modelValue: value }),
		},
		global: { mocks: { __: (text: string) => text } },
	})
let wrapper: ReturnType<typeof chips>

const pressed = () =>
	wrapper
		.findAll('button')
		.filter((b) => b.attributes('aria-pressed') === 'true')
		.map((b) => b.text())

describe('category chips', () => {
	it('picks a category', async () => {
		wrapper = chips()
		await wrapper.get('[data-testid="category-Design"]').trigger('click')
		expect(pressed()).toEqual(['Design'])
	})

	it('goes back to All when the chosen one is picked again', async () => {
		wrapper = chips('Design')
		await wrapper.get('[data-testid="category-Design"]').trigger('click')
		expect(pressed()).toEqual(['All'])
	})

	it('stays on All when All is picked again', async () => {
		wrapper = chips()
		await wrapper.get('[data-testid="category-All"]').trigger('click')
		expect(pressed()).toEqual(['All'])
	})
})
