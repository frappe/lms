import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Link from '@/components/Controls/Link.vue'

const { resources } = vi.hoisted(() => ({
	resources: [] as {
		data: unknown
		params?: Record<string, unknown>
		reloads: number
	}[],
}))

vi.mock('frappe-ui', () => ({
	Combobox: {
		name: 'Combobox',
		props: ['options', 'modelValue', 'open', 'align'],
		emits: ['update:open'],
		template: '<div />',
	},
	Button: { template: '<button />' },
	FormControl: { template: '<input />' },
	createResource: () => {
		const resource = {
			data: null as unknown,
			params: undefined as Record<string, unknown> | undefined,
			reloads: 0,
			update({ params }: { params: Record<string, unknown> }) {
				resource.params = params
			},
			reload() {
				resource.reloads += 1
				resource.data = [{ value: `${resource.params?.doctype}-1` }]
			},
			reset() {
				resource.data = null
			},
		}
		resources.push(resource)
		return resource
	},
}))

vi.mock('@/stores/settings', () => ({
	useSettings: () => ({ settings: { data: {} } }),
}))

// Add Assessment: picking Quiz loaded quizzes, and switching the type to
// Programming Exercise kept offering the quizzes. A Link whose doctype changes
// must forget what it loaded for the old one.
describe('Link with a changing doctype', () => {
	it('loads the new doctype instead of keeping the old options', async () => {
		resources.length = 0
		const wrapper = mount(Link, {
			props: { doctype: 'LMS Quiz', modelValue: '' },
			global: { mocks: { __: (s: string) => s } },
		})
		const options = resources[0]
		const combobox = () => wrapper.findComponent({ name: 'Combobox' })

		await combobox().vm.$emit('update:open', true)
		expect(options.params?.doctype).toBe('LMS Quiz')
		await combobox().vm.$emit('update:open', false)

		await wrapper.setProps({ doctype: 'LMS Programming Exercise' })
		expect(options.data).toBeNull() // the quizzes are gone at once
		await combobox().vm.$emit('update:open', true)
		expect(options.params?.doctype).toBe('LMS Programming Exercise')
		expect(options.data).toEqual([{ value: 'LMS Programming Exercise-1' }])
	})

	it('reloads straight away when the dropdown is open', async () => {
		resources.length = 0
		const wrapper = mount(Link, {
			props: { doctype: 'LMS Quiz', modelValue: '' },
			global: { mocks: { __: (s: string) => s } },
		})
		const options = resources[0]
		await wrapper
			.findComponent({ name: 'Combobox' })
			.vm.$emit('update:open', true)
		await wrapper.setProps({ doctype: 'LMS Assignment' })
		expect(options.params?.doctype).toBe('LMS Assignment')
		expect(options.reloads).toBe(2)
	})
})
