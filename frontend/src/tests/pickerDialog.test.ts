import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('frappe-ui', () => ({
	Button: {
		name: 'Button',
		props: ['disabled', 'variant'],
		emits: ['click'],
		template:
			'<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
	},
	Checkbox: {
		name: 'Checkbox',
		props: ['modelValue', 'size'],
		emits: ['update:modelValue'],
		template:
			'<input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
	},
	Combobox: {
		name: 'Combobox',
		props: ['modelValue', 'options'],
		emits: ['update:modelValue'],
		template: '<div />',
	},
	Dialog: {
		props: ['open', 'title'],
		template: '<div v-if="open"><slot /><slot name="actions" /></div>',
	},
	FormControl: {
		name: 'FormControl',
		props: ['modelValue'],
		emits: ['update:modelValue'],
		template:
			'<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
	},
}))

String.prototype.format = function (this: string, ...args: unknown[]): string {
	return this.replace(/{(\d+)}/g, (match, index) =>
		args[Number(index)] === undefined ? match : String(args[Number(index)])
	)
}

import PickerDialog from '@/components/InlineEdit/PickerDialog.vue'

const items = [
	{
		value: 'mfg',
		title: 'Manufacturing',
		category: 'ERPNext',
		suggested: true,
	},
	{ value: 'stack', title: 'Full-stack App', category: 'Framework' },
	{ value: 'hr', title: 'Frappe HR', category: 'Business' },
]

const mountDialog = (overrides: Record<string, unknown> = {}) =>
	mount(PickerDialog, {
		props: {
			open: true,
			title: 'Add related courses',
			items,
			...overrides,
			categories: ['Business', 'ERPNext', 'Framework'],
			'onUpdate:open': () => {},
		},
		global: { mocks: { __: (text: string) => text } },
	})

const titles = (wrapper: ReturnType<typeof mountDialog>) =>
	wrapper.findAll('[data-testid^="pick-"]').map((row) => row.text())

describe('the picker dialog', () => {
	it('lists suggested items first, under no heading', () => {
		const wrapper = mountDialog({
			items: [...items.slice(1), items[0]],
		})
		expect(wrapper.findAll('h3')).toHaveLength(0)
		expect(titles(wrapper)[0]).toContain('Manufacturing')
	})

	it('narrows by search text and by category', async () => {
		const wrapper = mountDialog()
		await wrapper.getComponent({ name: 'FormControl' }).setValue('frappe')
		expect(titles(wrapper)).toHaveLength(1)
		await wrapper.getComponent({ name: 'FormControl' }).setValue('')
		wrapper
			.getComponent({ name: 'Combobox' })
			.vm.$emit('update:modelValue', 'Framework')
		await wrapper.vm.$nextTick()
		expect(titles(wrapper)).toEqual([expect.stringContaining('Full-stack')])
	})

	it('adds what was picked and counts it', async () => {
		const wrapper = mountDialog()
		const add = wrapper.findAll('button').find((b) => b.text() === 'Add')!
		expect(add.attributes('disabled')).toBeDefined()
		const pick = (value: string, checked: boolean) =>
			wrapper.get(`[data-testid="pick-${value}"] input`).setValue(checked)
		await pick('hr', true)
		await pick('mfg', true)
		await pick('mfg', false)
		expect(
			wrapper.get('[data-testid="pick-hr"] input').attributes('aria-labelledby')
		).toBe(wrapper.get('[data-testid="pick-hr"] span[id]').attributes('id'))
		expect(wrapper.text()).toContain('1 selected')
		await add.trigger('click')
		expect(wrapper.emitted('add')).toEqual([[['hr']]])
	})
})
