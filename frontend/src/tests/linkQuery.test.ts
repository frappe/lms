import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Link from '@/components/Controls/Link.vue'

const { resources } = vi.hoisted(() => ({
	resources: [] as { params?: Record<string, unknown> }[],
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
			data: [],
			params: undefined as Record<string, unknown> | undefined,
			update({ params }: { params: Record<string, unknown> }) {
				resource.params = params
			},
			reload: () => {},
		}
		resources.push(resource)
		return resource
	},
}))

vi.mock('@/stores/settings', () => ({
	useSettings: () => ({ settings: { data: {} } }),
}))

const QUERY = 'lms.lms.api.search_currencies'

// Regression: currency picker 403 for LMS roles (#3023, fixed in #3038).
describe('Link query', () => {
	it('sends the query with both the search and the title lookup', async () => {
		resources.length = 0
		const wrapper = mount(Link, {
			props: { doctype: 'Currency', query: QUERY, modelValue: 'EUR' },
			global: { mocks: { __: (s: string) => s } },
		})
		await wrapper
			.findComponent({ name: 'Combobox' })
			.vm.$emit('update:open', true)

		expect(resources).toHaveLength(2)
		for (const resource of resources) {
			expect(resource.params?.query).toBe(QUERY)
		}
	})
})
