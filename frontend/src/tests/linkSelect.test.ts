import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Link from '@/components/Controls/Link.vue'

const OPTIONS = [
	{ value: 'course-a', label: 'Course A', description: 'course-a' },
	{ value: 'course-b', label: 'Course B', description: 'course-b' },
]

vi.mock('frappe-ui', () => ({
	Combobox: {
		name: 'Combobox',
		props: ['options', 'modelValue', 'open', 'align'],
		emits: ['update:open', 'update:modelValue'],
		template: '<div />',
	},
	Button: { template: '<button />' },
	FormControl: { template: '<input />' },
	createResource: () => ({
		data: OPTIONS,
		update: () => {},
		reload: () => {},
	}),
}))

vi.mock('@/stores/settings', () => ({
	useSettings: () => ({ settings: { data: {} } }),
}))

const mountLink = () =>
	mount(Link, {
		props: { doctype: 'LMS Course', modelValue: '' },
		global: { mocks: { __: (s: string) => s } },
	})

describe('Link select', () => {
	it('emits the picked option alongside its value', async () => {
		const wrapper = mountLink()
		await wrapper
			.findComponent({ name: 'Combobox' })
			.vm.$emit('update:modelValue', 'course-b')

		expect(wrapper.emitted('update:modelValue')).toEqual([['course-b']])
		expect(wrapper.emitted('select')).toEqual([[OPTIONS[1]]])
	})

	it('emits null when the value is cleared', async () => {
		const wrapper = mountLink()
		await wrapper
			.findComponent({ name: 'Combobox' })
			.vm.$emit('update:modelValue', null)

		expect(wrapper.emitted('update:modelValue')).toEqual([['']])
		expect(wrapper.emitted('select')).toEqual([[null]])
	})
})
