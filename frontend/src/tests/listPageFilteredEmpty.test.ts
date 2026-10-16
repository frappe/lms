import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ListPage from '@/components/Layouts/pages/ListPage.vue'

// Same contract as translation.js: a string, or `.format` when it has {n}.
vi.stubGlobal('__', (text: string) =>
	/{\d+}/.test(text)
		? {
				format: (...args: string[]) =>
					text.replace(/{(\d+)}/g, (_, i) => args[Number(i)]),
		  }
		: text
)

vi.mock('frappe-ui', () => ({
	Button: {
		props: ['label'],
		emits: ['click'],
		template: '<button @click="$emit(\'click\')">{{ label }}</button>',
	},
	FormControl: { template: '<input />' },
	createResource: vi.fn(),
	toast: {},
}))
vi.mock('frappe-ui/experimental', () => ({ ListFooter: { template: '<i />' } }))
vi.mock('@/components/Layouts/pages/PageHeader.vue', () => ({
	default: { template: '<i />' },
}))
vi.mock('@/components/Layouts/pages/PageBody.vue', () => ({
	default: { template: '<div><slot /></div>' },
}))
vi.mock('@/components/ResponsiveListView.vue', () => ({
	default: { template: '<i />' },
}))
vi.mock('@/components/SkeletonLoader.vue', () => ({
	default: { template: '<i />' },
}))
vi.mock('@/utils/a11y', () => ({ useLoadingAnnouncement: () => '' }))

const mountEmpty = (props: Record<string, unknown> = {}) =>
	mount(ListPage, {
		props: { breadcrumbs: [], rows: [], emptyName: 'Courses', ...props },
		global: { mocks: { __: (text: string) => text } },
	})

describe('ListPage empty state under a search or filter', () => {
	// Regression: a search with no match said "There are no courses currently"
	// (#3011, fixed in #3046).
	it('names the search that matched nothing and offers to clear it', async () => {
		const wrapper = mountEmpty({ searchQuery: 'zzzz' })
		expect(wrapper.text()).not.toContain('There are no courses currently')
		expect(wrapper.text()).toContain('"zzzz"')
		await wrapper.get('button').trigger('click')
		expect(wrapper.emitted('clearFilters')).toHaveLength(1)
	})

	it('clears its own search box', async () => {
		const wrapper = mountEmpty({ search: 'zzzz' })
		expect(wrapper.text()).toContain('"zzzz"')
		await wrapper.get('button').trigger('click')
		expect(wrapper.emitted('update:search')).toEqual([['']])
	})
})
