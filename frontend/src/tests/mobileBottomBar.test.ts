/**
 * The phone's bottom bar.
 *
 * Two things here are easy to regress and invisible in a unit test of the
 * taxonomy alone. The You tab is drawn as the user's own avatar rather than
 * `icons[tab.icon]` — the detail that makes the bar read as "you" instead of
 * "menu", and a branch in the template that nothing else exercises. And the
 * More button and its sheet are gone: every destination they held now lives on
 * the You page, so an ellipsis reappearing on the bar means something has been
 * put back in two places at once.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h } from 'vue'

vi.stubGlobal('__', (text: string) => text)
enableAutoUnmount(afterEach)

const {
	ensureMobileNavLinks,
	isLoggedIn,
	loadMobileNavLinks,
	sidebarLinks,
	sidebarSettings,
	user,
} = vi.hoisted(() => ({
	ensureMobileNavLinks: vi.fn().mockResolvedValue(undefined),
	isLoggedIn: { value: true },
	loadMobileNavLinks: vi.fn().mockResolvedValue(undefined),
	sidebarLinks: { value: [] as unknown[] },
	sidebarSettings: { data: {} as unknown },
	user: { data: null as Record<string, unknown> | null },
}))

vi.mock('frappe-ui', () => ({
	Avatar: {
		props: ['image', 'label', 'size'],
		// Renders no text of its own: the tab's own caption is what a label
		// assertion should be reading.
		template: `<span :data-image="image" :data-label="label" />`,
	},
}))

vi.mock('pinia', () => ({ storeToRefs: (store: unknown) => store }))

vi.mock('@/stores/session', () => ({ sessionStore: () => ({ isLoggedIn }) }))

vi.mock('@/stores/settings', () => ({
	useSettings: () => ({ sidebarSettings }),
}))

vi.mock('@/stores/user', async () => {
	const { reactive } = await import('vue')
	const userResource = reactive(user)
	return { usersStore: () => ({ userResource }) }
})

vi.mock('@/stores/mobileNavLinks', () => ({
	ensureMobileNavLinks,
	loadMobileNavLinks,
	sidebarLinks,
}))

import MobileLayout from '@/components/Layouts/MobileLayout.vue'

const Blank = defineComponent({ render: () => h('div') })

const SIDEBAR = [
	{ label: 'Home', icon: 'House', to: 'Home', activeFor: ['Home'] },
	{ label: 'Courses', icon: 'BookOpen', to: 'Courses', activeFor: ['Courses'] },
	{ label: 'Batches', icon: 'Users', to: 'Batches', activeFor: ['Batches'] },
	{
		label: 'Certifications',
		icon: 'GraduationCap',
		to: 'Certifications',
		activeFor: ['Certifications'],
	},
]

const openBar = async (path = '/') => {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/', name: 'Home', component: Blank },
			{ path: '/you', name: 'MobileYou', component: Blank },
			{ path: '/courses', name: 'Courses', component: Blank },
			{ path: '/:rest(.*)', component: Blank },
		],
	})
	router.push(path)
	await router.isReady()
	const wrapper = mount(MobileLayout, {
		global: { plugins: [router], mocks: { __: (text: string) => text } },
	})
	await flushPromises()
	return { wrapper, router }
}

const tabLabels = (wrapper: {
	findAll: (s: string) => { text: () => string }[]
}) => wrapper.findAll('nav button').map((button) => button.text())

beforeEach(() => {
	vi.clearAllMocks()
	isLoggedIn.value = true
	sidebarSettings.data = {}
	sidebarLinks.value = [...SIDEBAR]
	user.data = {
		full_name: 'Raiza Safeel',
		username: 'raiza',
		user_image: '/files/raiza.png',
	}
})

describe('the bar', () => {
	it('ends with You rather than Profile', async () => {
		const { wrapper } = await openBar()
		expect(tabLabels(wrapper)).toEqual(['Home', 'Courses', 'Batches', 'You'])
	})

	it('has no More button', async () => {
		const { wrapper } = await openBar()
		expect(wrapper.text()).not.toContain('More')
		expect(wrapper.find('[aria-haspopup="dialog"]').exists()).toBe(false)
	})

	it('waits for the admin settings before drawing a signed-in bar', async () => {
		// Unchanged from the More-tab era: the tabs are picked out of
		// admin-configured links, and a bar that reshuffles a beat after paint
		// reads worse than one that arrives whole.
		sidebarSettings.data = undefined
		const { wrapper } = await openBar()
		expect(wrapper.find('nav').exists()).toBe(false)
	})

	it('draws a signed-out visitor a bar immediately', async () => {
		isLoggedIn.value = false
		user.data = null
		sidebarSettings.data = undefined
		const { wrapper } = await openBar()
		expect(wrapper.find('nav').exists()).toBe(true)
	})
})

describe('the You tab', () => {
	it('is the user, not a glyph', async () => {
		const { wrapper } = await openBar()
		const avatar = wrapper.find('[data-testid="you-tab-avatar"]')
		expect(avatar.exists()).toBe(true)
		expect(avatar.attributes('data-image')).toBe('/files/raiza.png')
		expect(avatar.attributes('data-label')).toBe('Raiza Safeel')
	})

	it('still has a face before the user has loaded', async () => {
		user.data = null
		const { wrapper } = await openBar()
		expect(
			wrapper.find('[data-testid="you-tab-avatar"]').attributes('data-label')
		).toBe('You')
	})

	it('goes to the You page', async () => {
		const { wrapper, router } = await openBar()
		await wrapper.findAll('nav button').at(-1)?.trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('MobileYou')
	})

	it('rings the avatar only while the You page is open', async () => {
		const closed = await openBar('/')
		expect(
			closed.wrapper.find('[data-testid="you-tab-avatar"]').classes()
		).not.toContain('ring-2')

		const open = await openBar('/you')
		expect(
			open.wrapper.find('[data-testid="you-tab-avatar"]').classes()
		).toContain('ring-2')
	})
})
