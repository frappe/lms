import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import PageHeader from '@/components/Layouts/PageHeader.vue'
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

const router = createRouter({
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
			plugins: [router],
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

	// Load-bearing: this is what forbids "keep the visible text, add an
	// aria-label". That would be a WCAG 2.5.3 Label in Name failure — a speech
	// user saying "click Advanced Python" would not match a control named
	// "Back". With no visible text, 2.5.3 does not apply.
	it('carries no visible text inside the link', () => {
		expect(mountHeader().get('a').text().trim()).toBe('')
	})

	it('keeps the page title visible, outside the link', () => {
		const wrapper = mountHeader()
		expect(wrapper.text()).toContain('Advanced Python')
		expect(wrapper.get('a').text()).not.toContain('Advanced Python')
	})

	// jsdom has no layout engine — getBoundingClientRect() is all zeros — so no
	// test here can assert the 24px of WCAG 2.5.8. These classes are a contract
	// proxy for it, not proof: p-1.5 around a size-4 chevron is 28x28, and -ms-3
	// pays the padding back against the header's px-5 gutter so the glyph stays
	// at the same 14px optical offset it has today. Real proof needs browser mode.
	it('is padded to a 28x28 target without moving the chevron', () => {
		const classes = mountHeader().get('a').classes()
		expect(classes).toContain('p-1.5')
		expect(classes).toContain('-ms-3')
		expect(classes).not.toContain('-ms-1.5')
	})

	describe('branches that must not change', () => {
		it('renders the label without a link when there is no parent route', () => {
			const wrapper = mountHeader([{ label: 'Advanced Python' }])
			expect(wrapper.find('a').exists()).toBe(false)
			expect(wrapper.text()).toContain('Advanced Python')
		})

		it('renders breadcrumbs and no back link on desktop', () => {
			mobile.value = false
			const wrapper = mountHeader()
			expect(wrapper.find('[data-testid="breadcrumbs"]').exists()).toBe(true)
			expect(wrapper.find('a').exists()).toBe(false)
		})
	})
})
