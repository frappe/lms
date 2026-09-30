import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

window.matchMedia ??= (() => ({
	matches: false,
	addEventListener: () => {},
	removeEventListener: () => {},
})) as unknown as typeof window.matchMedia

const plyrCtor = vi.hoisted(() =>
	vi.fn(function FakePlyr(this: { on: () => void }) {
		this.on = () => {}
	})
)
vi.mock('plyr', () => ({ default: plyrCtor }))
vi.mock('plyr/dist/plyr.css', () => ({}))
vi.mock('@/utils/pdfViewer', () => ({ usesWebkitPdfViewer: () => false }))
vi.mock('@/stores/settings', () => ({
	useSettings: () => ({ settings: { data: {} } }),
}))
vi.mock('@/stores/user', () => ({ usersStore: () => ({ userResource: {} }) }))
vi.mock('@/stores/session', () => ({ sessionStore: () => ({ user: null }) }))
vi.mock('@/components/CourseInstructors.vue', () => ({
	default: defineComponent({ render: () => h('span') }),
}))
vi.mock('@/components/UserAvatar.vue', () => ({
	default: defineComponent({ render: () => h('span') }),
}))
vi.mock('frappe-ui', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	Tooltip: defineComponent({
		props: ['text', 'side'],
		setup:
			(_p, { slots }) =>
			() =>
				slots.default?.(),
	}),
}))

const { enablePlyr } = await import('@/utils/plyr')
const { getEditorTools } = await import('@/utils')
const { Upload } = await import('@/utils/upload')
const { default: ExerciseTestCases } = await import(
	'@/components/ProgrammingExercises/ExerciseTestCases.vue'
)
const { default: ExerciseConsole } = await import(
	'@/components/ProgrammingExercises/ExerciseConsole.vue'
)
const { default: CourseCard } = await import('@/components/CourseCard.vue')
const { default: ProfileAvatar } = await import(
	'@/components/Profile/ProfileAvatar.vue'
)
const { default: ProgressBar } = await import('@/components/ProgressBar.vue')

const translate = (message: string) => {
	if (!/{\d+}/.test(message)) return message
	return {
		format: (...args: unknown[]) =>
			message.replace(/{(\d+)}/g, (match, index) =>
				args[Number(index)] === undefined ? match : String(args[Number(index)])
			),
	}
}
const global = { mocks: { __: translate } }

afterEach(() => {
	document.body.replaceChildren()
})

describe('Plyr', () => {
	// Guards: no captions control in the player. Introduced in #1461; test added
	// with the a11y audit remediation.
	it('offers the captions control', async () => {
		const el = document.createElement('div')
		el.className = 'video-player'
		document.body.append(el)

		await enablePlyr()

		const options = plyrCtor.mock.calls[0][1] as { controls: string[] }
		expect(options.controls).toContain('captions')
	})
})

type Service = { html?: string }
const embedServices = () =>
	(
		getEditorTools() as {
			embed: { config: { services: Record<string, Service | boolean> } }
		}
	).embed.config.services

const iframeOf = (html: string) =>
	new DOMParser()
		.parseFromString(html, 'text/html')
		.querySelector('iframe') as HTMLIFrameElement

const iframeServices = () =>
	Object.entries(embedServices()).filter(
		([, service]) =>
			typeof service === 'object' && service.html?.includes('<iframe')
	) as [string, Required<Service>][]

describe('embed iframes', () => {
	// Guards: untitled embed iframes. Introduced in #713 and #1467; test added
	// with the a11y audit remediation.
	it('finds the iframe services to check', () => {
		expect(iframeServices().length).toBeGreaterThanOrEqual(8)
	})

	it.each(iframeServices().map(([name]) => name))(
		'%s names its frame',
		(name) => {
			const html = (embedServices()[name] as Required<Service>).html
			expect(iframeOf(html).getAttribute('title')).toMatch(/\S/)
		}
	)

	it('keeps a translated title that contains quotes inside the attribute', () => {
		const original = globalThis.__
		globalThis.__ = ((message: string) =>
			`l'intégration "${message}"`) as unknown as typeof __
		try {
			for (const [, service] of iframeServices()) {
				const frame = iframeOf(service.html)
				expect(frame.getAttribute('title')).toMatch(/^l'intégration ".+"$/)
				expect(frame.getAttributeNames()).not.toContain('intégration')
			}
		} finally {
			globalThis.__ = original
		}
	})
})

describe('the PDF upload block', () => {
	// Guards: untitled PDF iframe. Introduced in #2664; test added with the a11y
	// audit remediation.
	it('names its frame', () => {
		const tool = new Upload({
			data: { file_url: '/files/brief.pdf', file_type: 'PDF' },
			readOnly: true,
		})
		const frame = tool.render().querySelector('iframe')

		expect(frame?.getAttribute('title')).toBe('PDF document')
	})
})

const results = [
	{
		idx: 1,
		status: 'Passed' as const,
		hidden: 0,
		input: 'add(2, 3)',
		output: '5',
		expected_output: '5',
		elapsed: 1.5,
	},
	{
		idx: 2,
		status: 'Failed' as const,
		hidden: 0,
		input: 'add(1, 1)',
		output: '3',
		expected_output: '2',
		elapsed: 1.5,
	},
]

describe('ExerciseTestCases', () => {
	// Guards: pass/fail shown by colour and icon alone, results not announced.
	// Introduced in #2823; test added with the a11y audit remediation.
	it('says in text whether each case passed', () => {
		const wrapper = mount(ExerciseTestCases, {
			props: { results, duration: 0.4 },
			global,
		})
		const rows = wrapper.findAll('[data-testid="test-case-row"]')

		expect(rows[0].find('.sr-only').text()).toBe('Passed')
		expect(rows[1].find('.sr-only').text()).toBe('Failed')
		expect(rows[0].find('.lucide-circle-check').attributes()).toHaveProperty(
			'aria-hidden',
			'true'
		)
	})

	it('keeps its result summary in a status region that is always there', async () => {
		const wrapper = mount(ExerciseTestCases, {
			props: { results: [], duration: null },
			global,
		})
		const status = wrapper.get('[role="status"]')
		expect(status.text()).toBe('')

		await wrapper.setProps({ results, duration: 0.4 })

		expect(wrapper.get('[role="status"]').element).toBe(status.element)
		expect(status.text()).toBe('1 of 2 passed')
	})
})

describe('ExerciseConsole', () => {
	// Guards: code runs not announced. Introduced in #2823; test added with the
	// a11y audit remediation.
	it('announces the run through a status region that survives collapsing', async () => {
		const wrapper = mount(ExerciseConsole, {
			props: { lines: [], duration: null, running: true },
			global,
		})
		const status = wrapper.get('[role="status"]')
		expect(status.text()).toBe('Running your code…')

		await wrapper.get('[data-testid="console-toggle"]').trigger('click')
		await wrapper.setProps({ running: false, duration: 0.42 })

		expect(wrapper.get('[role="status"]').element).toBe(status.element)
		expect(status.text()).toBe('Ran in 0.42s')
	})
})

describe('CourseCard', () => {
	// Guards: counts and badges carried by icons alone. Introduced in #1085; test
	// added with the a11y audit remediation.
	const course = {
		title: 'Python',
		lessons: 12,
		enrollments: 40,
		rating: 4.46,
		featured: 1,
		enable_certification: 1,
		instructors: [],
	}

	it('spells out each icon-only count and badge', () => {
		const wrapper = mount(CourseCard, { props: { course }, global })
		const labels = wrapper.findAll('.sr-only').map((node) => node.text())

		expect(labels).toEqual([
			'12 lessons',
			'40 enrolled',
			'Rated 4.5 out of 5',
			'Featured',
			'Get Certified',
		])
	})

	it('hides every decorative icon', () => {
		const wrapper = mount(CourseCard, { props: { course }, global })
		const icons = wrapper.findAll(
			'.lucide-book-open, .lucide-users, .lucide-award, .lucide-graduation-cap, svg'
		)

		expect(icons.length).toBe(5)
		for (const icon of icons)
			expect(icon.attributes('aria-hidden')).toBe('true')
	})

	it('uses the singular for one lesson', () => {
		const wrapper = mount(CourseCard, {
			props: { course: { ...course, lessons: 1 } },
			global,
		})

		expect(wrapper.find('.sr-only').text()).toBe('1 lesson')
	})
})

describe('ProfileAvatar', () => {
	// Guards: open-to-work and hiring told apart by colour alone. Introduced in
	// #2793; test added with the a11y audit remediation.
	it.each([
		['Work', 'Open to Work', 'lucide-badge-check'],
		['Hiring', 'Hiring', 'lucide-briefcase'],
	])(
		'names the %s badge in text and shape, not colour',
		(openTo, label, icon) => {
			const wrapper = mount(ProfileAvatar, {
				props: { fullName: 'Ada', openTo },
				global,
			})

			expect(wrapper.get('.sr-only').text()).toBe(label)
			expect(wrapper.get(`.${icon}`).attributes('aria-hidden')).toBe('true')
		}
	)
})

describe('ProgressBar', () => {
	// Guards: progress shown only as a bar width. Introduced in #892; test added
	// with the a11y audit remediation.
	it('exposes its value as a progressbar', () => {
		const wrapper = mount(ProgressBar, { props: { progress: 42.3 }, global })
		const bar = wrapper.get('[role="progressbar"]')

		expect(bar.attributes()).toMatchObject({
			'aria-valuenow': '43',
			'aria-valuemin': '0',
			'aria-valuemax': '100',
			'aria-label': 'Progress',
		})
	})

	it('takes its accessible name from the label prop', () => {
		const wrapper = mount(ProgressBar, {
			props: { progress: 100, label: 'Course progress' },
			global,
		})

		expect(wrapper.get('[role="progressbar"]').attributes('aria-label')).toBe(
			'Course progress'
		)
	})
})
