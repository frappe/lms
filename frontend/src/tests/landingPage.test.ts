import { describe, expect, it, vi, beforeEach } from 'vitest'
import { config, mount, flushPromises } from '@vue/test-utils'
import Landing from '@/pages/Landing/Landing.vue'

// main.js registers __ on the app; the tests mount without it.
config.global.mocks = {
	...config.global.mocks,
	__: (message: string) =>
		/{\d+}/.test(message) ? { format: () => message } : message,
}

const landing = vi.hoisted(() => ({
	courses: [] as Array<Record<string, unknown>>,
	content: {} as Record<string, unknown>,
}))

vi.mock('frappe-ui', () => ({
	Button: {
		props: ['route', 'variant', 'theme'],
		emits: ['click'],
		template:
			'<button type="button" @click="$emit(\'click\')"><slot /></button>',
	},
	createResource: (opts: { url: string }) => ({
		...opts,
		get data() {
			return opts.url === 'lms.lms.api.get_landing_content'
				? landing.content
				: landing.courses
		},
		loading: false,
	}),
}))

vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ brand: { name: 'Site Name', logo: null } }),
}))

const sampleCourses = [
	{
		name: 'maths-a',
		title: 'Maths Foundation',
		short_introduction: 'Maths',
		paid_course: 1,
		delivery: 'offline',
		image: null,
	},
	{
		name: 'physics-s',
		title: 'Self Paced Physics',
		short_introduction: 'Physics',
		paid_course: 0,
		delivery: 'online',
		image: null,
	},
	{
		name: 'chem-a',
		title: 'Chemistry Batch',
		short_introduction: 'Chem',
		paid_course: 0,
		delivery: 'offline',
		image: null,
	},
]

const sampleContent = {
	enabled: true,
	brand: { name: 'Test Institute', logo: null, primary_colour: '#123456' },
	promo: 'Promo line for the test institute.',
	hero: {
		eyebrow: 'Eyebrow here',
		headline: 'Headline here',
		lede: 'Lede here',
	},
	slides: [
		{
			eyebrow: 'One',
			title: 'Slide one',
			text: 'Body one',
			cta: { label: 'Go one', href: '/courses' },
		},
		{
			eyebrow: 'Two',
			title: 'Slide two',
			text: 'Body two',
			cta: { label: 'Go two', href: '#contact' },
		},
		{
			eyebrow: 'Three',
			title: 'Slide three',
			text: 'Body three',
			cta: { label: '', href: '' },
		},
	],
	branches: [
		{
			label: 'Main Campus',
			name: 'Main Branch',
			address: 'Main street 1',
			phone: '+91 1111111111',
		},
		{
			label: 'Second Campus',
			name: 'Second Branch',
			address: 'Second street 2',
			phone: '+11 2222222',
		},
	],
	contact: {
		phone: '+91 7903466927',
		email: 'info@example.com',
		website: 'https://example.com',
	},
}

function mountLanding() {
	return mount(Landing, { attachTo: document.body })
}

beforeEach(() => {
	landing.courses = sampleCourses
	landing.content = sampleContent
	document.body.innerHTML = ''
})

describe('Landing page', () => {
	it('shows the configured brand, hero and Student Login, and the course cards with labels', async () => {
		const wrapper = mountLanding()
		await flushPromises()

		expect(wrapper.text()).toContain('Test Institute')
		expect(wrapper.text()).toContain('Headline here')
		expect(wrapper.text()).toContain('Student Login')
		expect(wrapper.text()).toContain('Maths Foundation')
		expect(wrapper.text()).toContain('Self Paced Physics')
		expect(wrapper.text()).toContain('Online self-paced')
		wrapper.unmount()
	})

	it('filters courses by delivery and sets aria-pressed on the active tab', async () => {
		const wrapper = mountLanding()
		await flushPromises()

		const offlineTab = wrapper
			.findAll('button')
			.find((b) => b.text() === 'Offline batch')!
		await offlineTab.trigger('click')

		expect(offlineTab.attributes('aria-pressed')).toBe('true')
		expect(wrapper.text()).toContain('Maths Foundation')
		expect(wrapper.text()).toContain('Chemistry Batch')
		expect(wrapper.text()).not.toContain('Self Paced Physics')
		wrapper.unmount()
	})

	it('shows every configured branch and phone, and no fee amounts', async () => {
		const wrapper = mountLanding()
		await flushPromises()

		for (const branch of sampleContent.branches) {
			expect(wrapper.text()).toContain(branch.label)
			expect(wrapper.text()).toContain(branch.phone)
		}
		expect(wrapper.text()).not.toMatch(/₹/)
		wrapper.unmount()
	})

	it('applies the configured primary colour to the page', async () => {
		const wrapper = mountLanding()
		await flushPromises()

		expect(wrapper.find('.lp-root').attributes('style')).toContain(
			'--lp-accent: #123456',
		)
		wrapper.unmount()
	})

	it('copy falls back to selecting the number when the clipboard refuses', async () => {
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText: vi.fn().mockRejectedValue(new Error('refused')) },
			configurable: true,
		})
		const wrapper = mountLanding()
		await flushPromises()

		const copy = wrapper.findAll('button').find((b) => b.text() === 'Copy')!
		await copy.trigger('click')
		await flushPromises()

		expect(wrapper.findAll('button').some((b) => b.text() === 'Ctrl+C')).toBe(
			true,
		)
		expect(window.getSelection()?.toString()).toContain('+91 7903466927')
		wrapper.unmount()
	})

	it('carousel shows one slide at a time, moves with the arrows and the dots', async () => {
		const wrapper = mountLanding()
		await flushPromises()

		const active = () =>
			wrapper.findAll('.lp-slide').filter((el) => el.classes('is-active'))
		expect(wrapper.findAll('.lp-slide')).toHaveLength(
			sampleContent.slides.length,
		)
		expect(active()).toHaveLength(1)
		expect(active()[0].text()).toContain('Slide one')

		await wrapper.find('[aria-label="Next slide"]').trigger('click')
		expect(active()[0].text()).toContain('Slide two')

		const dots = wrapper.findAll('.lp-dot')
		await dots[2].trigger('click')
		expect(active()[0].text()).toContain('Slide three')
		expect(dots[2].attributes('aria-current')).toBe('true')
		expect(dots[0].attributes('aria-current')).toBe('false')
		wrapper.unmount()
	})

	it('a slide without a button shows no button', async () => {
		const wrapper = mountLanding()
		await flushPromises()

		const third = wrapper.findAll('.lp-slide')[2]
		expect(third.find('a').exists()).toBe(false)
		wrapper.unmount()
	})

	it('the navigation has the six section links', async () => {
		const wrapper = mountLanding()
		await flushPromises()

		const labels = wrapper.findAll('nav a').map((a) => a.text())
		for (const label of [
			'Classroom Courses',
			'Online Courses',
			'Test Series',
			'Results',
			'Study Materials',
			'Scholarships',
		]) {
			expect(labels).toContain(label)
		}
		wrapper.unmount()
	})
})
