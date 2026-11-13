import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { reactive } from 'vue'

// The home page: one greeting for learners and instructors, a card that picks
// up where you left off, and a first-time page when there is nothing yet.

const seeds = vi.hoisted(() => ({}) as Record<string, unknown>)
const pushMock = vi.hoisted(() => vi.fn())

vi.mock('frappe-ui', async (importOriginal) => {
	const vue = await import('vue')
	const resource = (config: any) =>
		vue.reactive({
			data: seeds[config?.url] ?? null,
			fetched: seeds[config?.url] !== undefined,
			loading: false,
			submit: vi.fn(),
			reload: vi.fn(),
		})
	return {
		...(await importOriginal<Record<string, unknown>>()),
		createResource: resource,
		call: vi.fn(() => Promise.resolve('new-skill')),
		toast: { success: vi.fn(), error: vi.fn() },
	}
})

vi.mock('vue-router', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	useRoute: () => ({ params: {}, query: {} }),
	useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/utils', () => ({ formatTime: (time: string) => time }))
vi.mock('@/utils/timezone', () => ({ formatTimezone: (zone: string) => zone }))
vi.mock('@/utils/routes', () => ({ profileRoute: () => ({ name: 'Profile' }) }))

import { greeting, welcome } from '@/pages/Home/greeting'
import ResumeCard from '@/pages/Home/ResumeCard.vue'
import SkillCard from '@/components/Goals/SkillCard.vue'
import AdminHome from '@/pages/Home/AdminHome.vue'
import AdminWelcome from '@/pages/Home/AdminWelcome.vue'
import StudentHome from '@/pages/Home/StudentHome.vue'

const user = reactive({ data: { full_name: 'Meera Rao', username: 'meera' } })
const dayjs = (await import('dayjs')).default

const stubs = {
	RouterLink: RouterLinkStub,
	AISetupNotice: { template: '<div />' },
	AdminWelcome: {
		name: 'AdminWelcome',
		template: '<div data-test="admin-welcome" />',
	},
	LearnerWelcome: {
		name: 'LearnerWelcome',
		template: '<div data-test="learner-welcome" />',
	},
	LiveClassCard: { template: '<div />' },
	UpcomingEvaluations: { template: '<div />' },
}

const mountWith = (component: any, props: Record<string, unknown> = {}) =>
	mount(component, {
		props,
		global: {
			stubs,
			provide: { $user: user, $dayjs: dayjs },
			mocks: { __: (globalThis as any).__ },
		},
	})

beforeEach(() => {
	for (const key of Object.keys(seeds)) delete seeds[key]
	vi.useFakeTimers({ toFake: ['Date'] })
})

afterEach(() => vi.useRealTimers())

describe('greeting', () => {
	it('greets by the time of day and first name', () => {
		vi.setSystemTime(new Date(2026, 10, 12, 9))
		expect(greeting('Meera Rao')).toBe('Good morning, Meera')
		vi.setSystemTime(new Date(2026, 10, 12, 14))
		expect(greeting('Meera Rao')).toBe('Good afternoon, Meera')
		vi.setSystemTime(new Date(2026, 10, 12, 19))
		expect(greeting('')).toBe('Good evening')
		expect(welcome('Asha K')).toBe('Welcome, Asha')
	})
})

describe('ResumeCard', () => {
	const props = {
		title: 'Fire Safety',
		meta: '2 of 5 parts',
		action: 'Continue',
		route: { name: 'GoalSession', params: { goal: 'fire-safety' } },
	}

	it('makes the whole card one link through its button', () => {
		const wrapper = mountWith(ResumeCard, props)
		const links = wrapper.findAllComponents(RouterLinkStub)
		expect(links).toHaveLength(1)
		expect(links[0].props('to')).toEqual(props.route)
		// The link stretches over the card instead of a second link wrapping it.
		expect(links[0].classes()).toContain('after:inset-0')
	})

	it('marks a draft and leaves out progress it does not have', () => {
		const wrapper = mountWith(ResumeCard, { ...props, draft: true })
		expect(wrapper.text()).toContain('Draft')
		expect(wrapper.find('[role="progressbar"]').exists()).toBe(false)
	})
})

describe('SkillCard', () => {
	it('links to its route when it has one', () => {
		const wrapper = mountWith(SkillCard, {
			title: 'Fire Safety',
			to: { name: 'GoalBuilder', params: { goal: 'fire-safety' } },
		})
		expect(wrapper.findComponent(RouterLinkStub).exists()).toBe(true)
	})

	it('is a button that asks to open the skill when it has no route', async () => {
		const wrapper = mountWith(SkillCard, {
			title: 'Fire Safety',
			meta: 'About 8 minutes',
		})
		await wrapper.find('button').trigger('click')
		expect(wrapper.emitted('open')).toHaveLength(1)
		expect(wrapper.text()).toContain('About 8 minutes')
	})
})

describe('AdminHome', () => {
	const made = (overrides: Record<string, unknown>) => ({
		type: 'Course',
		name: 'c1',
		title: 'A course',
		meta: '4 enrolled',
		published: true,
		route: { name: 'CourseDetail', params: { courseName: 'c1' } },
		...overrides,
	})

	it('shows the first-time page when the instructor has made nothing', async () => {
		seeds['lms.lms.home.admin_home'] = { items: [], resume: null }
		const wrapper = mountWith(AdminHome, {
			liveClasses: { data: [] },
			evals: { data: [] },
		})
		await flushPromises()
		expect(wrapper.find('[data-test="admin-welcome"]').exists()).toBe(true)
	})

	it('reminds them of a live class this week before anything else', async () => {
		vi.setSystemTime(new Date(2026, 10, 12, 9))
		seeds['lms.lms.home.admin_home'] = {
			items: [made({ published: false })],
			resume: made({ published: false }),
		}
		const wrapper = mountWith(AdminHome, {
			liveClasses: {
				data: [
					{
						name: 'l1',
						title: 'Fire drill',
						date: '2026-11-12',
						time: '11:00',
					},
				],
			},
			evals: { data: [] },
		})
		await flushPromises()
		expect(wrapper.find('header p').text()).toBe(
			'Live class today at 11:00: Fire drill.',
		)
	})

	it('counts drafts when nothing is coming up', async () => {
		seeds['lms.lms.home.admin_home'] = {
			items: [
				made({ name: 'd1', published: false }),
				made({ name: 'd2', published: false }),
			],
			resume: made({ name: 'd1', published: false }),
		}
		const wrapper = mountWith(AdminHome, {
			liveClasses: { data: [] },
			evals: { data: [] },
		})
		await flushPromises()
		expect(wrapper.find('header p').text()).toBe(
			'2 drafts are waiting for you to publish.',
		)
		// No side column, so the list runs full width.
		expect(wrapper.find('aside').exists()).toBe(false)
	})
})

describe('StudentHome', () => {
	const props = {
		myLiveClasses: { data: [] },
		streakInfo: { data: {} },
		evalCount: 0,
	}

	it('shows the first-time page when there is nothing to learn yet', async () => {
		seeds['lms.lms.home.my_learning_home'] = []
		const wrapper = mountWith(StudentHome, props)
		await flushPromises()
		expect(wrapper.find('[data-test="learner-welcome"]').exists()).toBe(true)
	})

	it('badges every kind of item, courses included', async () => {
		seeds['lms.lms.home.my_learning_home'] = [
			{
				type: 'Skill',
				title: 'Fire Safety',
				meta: 'Not started',
				done: false,
				route: {},
			},
			{
				type: 'Course',
				title: 'Frappe Books',
				meta: '2 of 6 lessons',
				done: false,
				progress: 33,
				route: {},
			},
			{
				type: 'Batch',
				title: 'Managers',
				meta: 'Next live class Tuesday',
				done: false,
				route: {},
			},
		]
		const wrapper = mountWith(StudentHome, props)
		await flushPromises()
		const text = wrapper
			.find('#your-learning')
			.element.closest('section')!.textContent
		for (const label of ['Skill', 'Course', 'Batch'])
			expect(text).toContain(label)
	})
})

describe('AdminWelcome', () => {
	const mountWelcome = (example: unknown) =>
		mount(AdminWelcome, {
			props: { example },
			global: {
				stubs: { ...stubs, CharacterAvatar: { template: '<span />' } },
				provide: { $user: user },
				mocks: { __: (globalThis as any).__ },
			},
		})

	const ready = { chat_model: 'gemini', embedding_model: 'embed', ready: true }

	it('offers the demo course as a real example to open', () => {
		seeds['lms.lms.ai.api.ai_status'] = ready
		const wrapper = mountWelcome({
			name: 'demo',
			title: 'A guide to Frappe Learning',
			lessons: ['What is Frappe Learning?'],
			certificate: false,
			route: { name: 'CourseDetail', params: { courseName: 'demo' } },
		})
		expect(wrapper.text()).toContain('See an example course')
		expect(wrapper.text()).toContain('What do you want to teach?')
	})

	it('has no example link on a site without the demo course', () => {
		seeds['lms.lms.ai.api.ai_status'] = ready
		const wrapper = mountWelcome(null)
		expect(wrapper.text()).not.toContain('See an example course')
		expect(wrapper.text()).toContain('A topic that needs depth')
	})

	it('puts connecting a model first when the site has none', () => {
		seeds['lms.lms.ai.api.ai_status'] = {
			chat_model: null,
			embedding_model: null,
			ready: false,
		}
		const wrapper = mountWelcome(null)
		expect(wrapper.text()).toContain('First, connect an AI model')
		expect(wrapper.text()).not.toContain('What do you want to teach?')
		const links = wrapper.findAll('a').map((a) => a.attributes('href'))
		expect(links).toContain('/app/flow-model/new')
	})

	it('shows only the embedding step once the chat model is in', () => {
		seeds['lms.lms.ai.api.ai_status'] = {
			chat_model: 'gemini',
			embedding_model: null,
			ready: false,
		}
		const wrapper = mountWelcome(null)
		expect(wrapper.text()).toContain('Done')
		const links = wrapper.findAll('a').map((a) => a.attributes('href'))
		expect(links).toContain('/app/flow-knowledge-settings')
		expect(links).not.toContain('/app/flow-model/new')
	})
})
