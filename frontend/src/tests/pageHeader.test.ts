import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import PageHeader from '@/components/Layouts/pages/PageHeader.vue'
import type { Breadcrumb } from '@/types'

const { mobile } = vi.hoisted(() => ({ mobile: { value: true } }))

vi.mock('@/utils/composables', async () => {
	const { computed } = await import('vue')
	return {
		MOBILE_BREAKPOINT: 640,
		useScreenSize: () => ({ isMobile: computed(() => mobile.value) }),
	}
})

vi.mock('frappe-ui', () => ({
	Badge: { name: 'Badge', template: `<span><slot /></span>` },
	Breadcrumbs: {
		name: 'Breadcrumbs',
		props: ['items'],
		template: `<nav data-testid="breadcrumbs" />`,
	},
}))

vi.mock('@/components/SkeletonLoader.vue', () => ({
	default: { name: 'SkeletonLoader', template: `<div />` },
}))

vi.stubGlobal('__', (text: string) => text)

const makeRouter = () =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/courses', name: 'courses', component: { template: '<div />' } },
			{ path: '/', name: 'home', component: { template: '<div />' } },
		],
	})

const TRAIL: Breadcrumb[] = [
	{ label: 'Courses', route: { name: 'courses' } },
	{ label: 'Advanced Python' },
]

const mountHeader = (breadcrumbs: Breadcrumb[] = TRAIL) =>
	mount(PageHeader, {
		props: { breadcrumbs },
		global: {
			plugins: [makeRouter()],
			mocks: { __: (text: string) => text },
		},
	})

describe('PageHeader mobile back link', () => {
	beforeEach(() => {
		mobile.value = true
	})

	// The link was named by breadcrumbs[len-1] — the page you are ON — while
	// routing to breadcrumbs[len-2]. A screen reader announced "Advanced Python,
	// link" on the Advanced Python page, and activating it went to Courses.
	// WCAG 2.4.4.
	it('is not named after the page it is already on', () => {
		const back = mountHeader().get('a')
		expect(back.attributes('aria-label') ?? back.text()).not.toBe(
			'Advanced Python'
		)
	})

	it('names the link Back', () => {
		expect(mountHeader().get('a').attributes('aria-label')).toBe('Back')
	})

	it('keeps the page title visible, outside the link', () => {
		const wrapper = mountHeader()
		expect(wrapper.text()).toContain('Advanced Python')
		expect(wrapper.get('a').text()).not.toContain('Advanced Python')
	})

	describe('branches that must not change', () => {
		it('renders the label without a link when there is no parent route', () => {
			const wrapper = mountHeader([{ label: 'Advanced Python' }])
			expect(wrapper.find('a').exists()).toBe(false)
			expect(wrapper.text()).toContain('Advanced Python')
		})
	})
})
