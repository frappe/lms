import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { translate } from './helpers/translate'

vi.mock('frappe-ui', () => ({
	HoverCard: { template: '<span><slot name="trigger" /><slot /></span>' },
	Button: { template: '<button><slot /></button>' },
}))
vi.mock('@/components/UserAvatar.vue', () => ({
	default: { template: '<span />' },
}))
vi.mock('@/utils', () => ({
	decodeEntities: (text: string) => text,
	htmlToText: (html: string) => html.replace(/<[^>]+>/g, ''),
}))
vi.stubGlobal('__', translate)

import CourseInstructors from '@/components/CourseInstructors.vue'
import InstructorHoverCard from '@/components/InstructorHoverCard.vue'

const person = (first: string) => ({
	username: first.toLowerCase(),
	first_name: first,
	full_name: `${first} Last`,
	bio: `<p>${first} teaches.</p>`,
})

const signedIn = { data: { name: 'ada@example.com' } }
const guest = { data: null }

const mountNames = (names: string[], hoverCards = false, user = signedIn) =>
	mount(CourseInstructors, {
		props: { instructors: names.map(person), hoverCards },
		global: {
			provide: { $user: user },
			mocks: { __: translate },
			stubs: { RouterLink: { template: '<a><slot /></a>' } },
		},
	})

const names = (wrapper: ReturnType<typeof mountNames>) =>
	wrapper.findAll('a').map((link) => link.text())

describe('the instructor names', () => {
	it('names one instructor in full', () => {
		expect(names(mountNames(['Dipen']))).toEqual(['Dipen Last'])
	})

	it('names up to three by first name', () => {
		const wrapper = mountNames(['Dipen', 'Umair', 'Pushkar'])
		expect(names(wrapper)).toEqual(['Dipen', 'Umair', 'Pushkar'])
		expect(wrapper.text().replace(/\s+/g, ' ')).toBe('Dipen, Umair and Pushkar')
	})

	it('collapses more than three to the first and a count', () => {
		const wrapper = mountNames(['A', 'B', 'C', 'D'])
		expect(names(wrapper)).toEqual(['A'])
		expect(wrapper.text()).toBe('A and 3 others')
	})

	it("shows each named instructor's card when asked", () => {
		const wrapper = mountNames(['Dipen', 'Umair'], true)
		const cards = wrapper.findAll('[data-testid="instructor-card"]')
		expect(cards).toHaveLength(2)
		expect(cards[0].text()).toContain('Dipen teaches.')
		expect(cards[0].text()).toContain('View profile')
	})
	it('shows guests plain names with no card', () => {
		const wrapper = mountNames(['Dipen', 'Umair'], true, guest)
		expect(wrapper.find('[data-testid="instructor-card"]').exists()).toBe(false)
		expect(wrapper.text()).not.toContain('teaches')
		expect(names(wrapper)).toEqual(['Dipen', 'Umair'])
		expect(wrapper.find('.decoration-dotted').exists()).toBe(false)
	})
})

describe('the instructor card', () => {
	const mountCard = (user: object) =>
		mount(InstructorHoverCard, {
			props: { instructor: person('Dipen') },
			slots: { default: '<i>avatar</i>' },
			global: { provide: { $user: user }, mocks: { __: translate } },
		})

	it('opens for signed-in users', () => {
		const wrapper = mountCard(signedIn)
		expect(wrapper.find('[data-testid="instructor-card"]').exists()).toBe(true)
	})

	it('leaves only the trigger for guests', () => {
		const wrapper = mountCard(guest)
		expect(wrapper.html()).toBe('<i>avatar</i>')
	})
})
