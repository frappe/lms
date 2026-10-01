import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { getEditorTools } from '@/utils'
import { Upload } from '@/utils/upload'
import CourseCard from '@/components/CourseCard.vue'
import ProfileAvatar from '@/components/Profile/ProfileAvatar.vue'
import ProgressBar from '@/components/ProgressBar.vue'

vi.hoisted(() => {
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
})
vi.mock('@/utils/pdfViewer', () => ({ usesWebkitPdfViewer: () => false }))
vi.mock('@/stores/settings', () => ({
	useSettings: () => ({ settings: { data: {} } }),
}))
vi.mock('@/stores/user', () => ({ usersStore: () => ({ userResource: {} }) }))
vi.mock('@/stores/session', () => ({ sessionStore: () => ({ user: null }) }))
vi.mock('@/components/CourseInstructors.vue', () => ({
	default: { render: () => null },
}))
vi.mock('@/components/UserAvatar.vue', () => ({
	default: { render: () => null },
}))
vi.mock('frappe-ui', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	Tooltip: { template: '<slot />' },
}))

const global = { mocks: { __: (s: string) => globalThis.__(s) } }

describe('embedded frames', () => {
	// Guards: untitled embed and PDF iframes. Introduced in #713, #1467 and
	// #2664; test added with the a11y audit remediation.
	it('titles every embed service frame, even with quotes in the translation', () => {
		const original = globalThis.__
		globalThis.__ = ((s: string) => `l'intégration "${s}"`) as typeof __
		try {
			const { services } = (getEditorTools() as any).embed.config
			const frames = Object.values(services as Record<string, any>)
				.filter((service) => service.html?.includes('<iframe'))
				.map(
					(service) =>
						new DOMParser()
							.parseFromString(service.html, 'text/html')
							.querySelector('iframe')!
				)
			expect(frames.length).toBeGreaterThanOrEqual(8)
			for (const frame of frames)
				expect(frame.getAttribute('title')).toMatch(/^l'intégration ".+"$/)
		} finally {
			globalThis.__ = original
		}
	})

	it('titles the PDF upload block frame', () => {
		const tool = new Upload({
			data: { file_url: '/files/brief.pdf', file_type: 'PDF' },
			readOnly: true,
		})
		const frame = tool.render().querySelector('iframe')
		expect(frame?.getAttribute('title')).toBe('PDF document')
	})
})

describe('icon-only states', () => {
	// Guards: counts, badges and the profile open-to-work/hiring badge carried by
	// icons and colour alone. Introduced in #1085 and #2793; test added with the
	// a11y audit remediation.
	it('spells out each course card count and badge and hides the icons', () => {
		const course = {
			title: 'Python',
			lessons: 12,
			enrollments: 40,
			rating: 4.46,
			featured: 1,
			enable_certification: 1,
			instructors: [],
		}
		const wrapper = mount(CourseCard, { props: { course }, global })

		expect(wrapper.findAll('.sr-only').map((node) => node.text())).toEqual([
			'12 lessons',
			'40 enrolled',
			'Rated 4.5 out of 5',
			'Featured',
			'Get Certified',
		])
		const icons = wrapper.findAll('svg, [class*="lucide-"]')
		expect(icons.map((icon) => icon.attributes('aria-hidden'))).toEqual(
			Array(5).fill('true')
		)
	})

	it.each([
		['Work', 'Open to Work', 'lucide-badge-check'],
		['Hiring', 'Hiring', 'lucide-briefcase'],
	])('names the %s profile badge in text and shape', (openTo, label, icon) => {
		const wrapper = mount(ProfileAvatar, {
			props: { fullName: 'Ada', openTo },
			global,
		})

		expect(wrapper.get('.sr-only').text()).toBe(label)
		expect(wrapper.get(`.${icon}`).attributes('aria-hidden')).toBe('true')
	})
})

describe('ProgressBar', () => {
	// Guards: progress shown only as a bar width. Introduced in #892; test added
	// with the a11y audit remediation.
	it('exposes its value and label as a progressbar', () => {
		const wrapper = mount(ProgressBar, {
			props: { progress: 42.3, label: 'Course progress' },
			global,
		})

		expect(wrapper.get('[role="progressbar"]').attributes()).toMatchObject({
			'aria-valuenow': '43',
			'aria-valuemin': '0',
			'aria-valuemax': '100',
			'aria-label': 'Course progress',
		})
	})
})
