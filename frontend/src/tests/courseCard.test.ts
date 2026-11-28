import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const { session } = vi.hoisted(() => {
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
	return { session: { user: null as string | null } }
})

vi.mock('@/stores/session', () => ({ sessionStore: () => session }))
vi.mock('@/components/UserAvatar.vue', () => ({
	default: { props: ['user'], template: '<i class="avatar" />' },
}))

import CourseCard from '@/components/CourseCard.vue'

const mountCard = (course: Record<string, unknown>) =>
	mount(CourseCard, {
		props: {
			course: { name: 'c-1', title: 'ERPNext', instructors: [], ...course },
		},
		global: {
			mocks: { __: globalThis.__ },
			stubs: { 'router-link': { template: '<a><slot /></a>' } },
		},
	})

describe('CourseCard', () => {
	it('tints the thumbnail from the course colour when there is no image', () => {
		const thumbnail = mountCard({ card_gradient: 'Pink' }).find('.h-40')

		expect(thumbnail.classes()).toEqual(
			expect.arrayContaining(['bg-surface-pink-2', 'text-ink-pink-5'])
		)
		expect(thumbnail.find('img').exists()).toBe(false)
	})

	it('shows any lucide icon on the tint, or an open book', () => {
		expect(
			mountCard({ icon: 'rocket' }).find('.h-40 .lucide-rocket').exists()
		).toBe(true)
		expect(
			mountCard({ icon: 'telescope' }).find('.h-40 .lucide-telescope').exists()
		).toBe(true)
		expect(mountCard({}).find('.h-40 .lucide-book-open').exists()).toBe(true)
		expect(
			mountCard({ icon: 'Not an icon' })
				.find('.h-40 .lucide-book-open')
				.exists()
		).toBe(true)
	})

	it('shows the uploaded image instead of the tint', () => {
		const thumbnail = mountCard({ image: '/files/a b.png' }).find('.h-40')

		expect(thumbnail.find('img').attributes('src')).toBe('/files/a%20b.png')
		expect(thumbnail.classes()).not.toContain('bg-surface-blue-2')
	})

	it('reads the category, certificate and price, but not the tags', () => {
		const wrapper = mountCard({
			category: 'ERPNext',
			tags: 'V15, Accounting',
			enable_certification: 1,
			paid_course: 1,
			price: '₹2,999',
			published: 1,
		})

		expect(wrapper.text()).toContain('ERPNext')
		expect(wrapper.text()).not.toContain('V15')
		expect(wrapper.text()).toContain('Certificate')
		expect(wrapper.text()).toContain('₹2,999')
		expect(wrapper.text()).not.toContain('Draft')
	})

	it('calls a course without a price free and marks a draft', () => {
		const wrapper = mountCard({ paid_course: 0, published: 0, rating: '0' })

		expect(wrapper.text()).toContain('Free')
		expect(wrapper.text()).toContain('Draft')
		expect(wrapper.text()).not.toContain('Rated')
	})

	it('shows an enrolled learner their progress instead of the facts', () => {
		session.user = 'learner@example.com'
		const wrapper = mountCard({ membership: { progress: 39.2 }, rating: '4.5' })
		session.user = null

		expect(
			wrapper.find('[role="progressbar"]').attributes('aria-valuenow')
		).toBe('40')
		expect(wrapper.text()).toContain('40%')
		expect(wrapper.text()).not.toContain('Free')
	})
})
