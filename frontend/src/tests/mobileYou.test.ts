/**
 * The You page, mounted.
 *
 * buildYouRows is tested on its own in youRows.test.ts, so what is left here is
 * everything mounting adds: that a row reporting an action reaches the right
 * handler, that a guest who types the URL gets a prompt rather than a Log out
 * button, and that the page stands up with no bottom bar above it.
 *
 * That last one is not hypothetical. Every routed screen on this branch has to
 * survive a cold deep link — a load straight into the URL, where no parent has
 * mounted and nothing has primed the stores. The bug in 1298a0dae was exactly
 * this shape, so the page is mounted through a router here rather than directly.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	DOMWrapper,
	enableAutoUnmount,
	flushPromises,
	mount,
} from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { defineComponent, h } from 'vue'

vi.stubGlobal('__', (text: string) => text)
enableAutoUnmount(afterEach)

const {
	ensureMobileNavLinks,
	isLoggedIn,
	logoutSubmit,
	loadUnreadCount,
	otherLinks,
	setThemePreference,
	sidebarLinks,
	themePreference,
	toggleNotifications,
	unreadCount,
	userResource,
} = vi.hoisted(() => ({
	// Plain boxes rather than vue refs: the mock factories run before any import
	// has been evaluated, and every test mounts fresh after setting them, so
	// nothing here needs to be reactive after the fact.
	ensureMobileNavLinks: vi.fn(() => Promise.resolve()),
	isLoggedIn: { value: true },
	logoutSubmit: vi.fn(),
	loadUnreadCount: vi.fn(),
	otherLinks: { value: [] as unknown[] },
	setThemePreference: vi.fn(),
	sidebarLinks: { value: [] as unknown[] },
	themePreference: { value: 'system' },
	toggleNotifications: vi.fn(),
	unreadCount: { value: 0 },
	userResource: { data: null as Record<string, unknown> | null },
}))

vi.mock('frappe-ui', () => ({
	Avatar: {
		props: ['image', 'label', 'size'],
		template: `<span data-testid="avatar" :data-image="image">{{ label }}</span>`,
	},
	usePageMeta: vi.fn(),
}))

vi.mock('pinia', () => ({ storeToRefs: (store: unknown) => store }))

vi.mock('@/stores/session', () => ({
	sessionStore: () => ({
		isLoggedIn,
		logout: { submit: logoutSubmit },
		brand: { favicon: '' },
	}),
}))

vi.mock('@/stores/user', () => ({ usersStore: () => ({ userResource }) }))

vi.mock('@/stores/mobileNavLinks', () => ({
	ensureMobileNavLinks,
	sidebarLinks,
	otherLinks,
}))

vi.mock('@/stores/notifications', () => ({
	loadUnreadCount,
	toggleNotifications,
	unreadCount,
}))

vi.mock('@/utils/theme', () => ({ setThemePreference, themePreference }))

import MobileYou from '@/pages/MobileYou.vue'

const Blank = defineComponent({ render: () => h('div') })

const SIDEBAR = [
	{ label: 'Home', icon: 'Home', to: 'Home' },
	{ label: 'Courses', icon: 'BookOpen', to: 'Courses' },
	{ label: 'Batches', icon: 'Users', to: 'Batches' },
	{ label: 'Certifications', icon: 'GraduationCap', to: 'Certifications' },
]
const OTHER = [
	{ label: 'Notifications', icon: 'Bell', to: 'Notifications' },
	{ label: 'Profile', icon: 'UserRound', to: '' },
	{ label: 'Log out', icon: 'LogOut', to: '' },
]

// Mounted the way a cold deep link mounts it: through the router, into a bare
// RouterView, with no MobileLayout anywhere above.
const openYou = async () => {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/you', name: 'MobileYou', component: MobileYou },
			{ path: '/batches', name: 'Batches', component: Blank },
			{ path: '/certifications', name: 'Certifications', component: Blank },
			{ path: '/user/:username', name: 'Profile', component: Blank },
			{ path: '/:rest(.*)', component: Blank },
		],
	})
	router.push('/you')
	await router.isReady()
	const wrapper = mount(RouterView, {
		global: {
			plugins: [router],
			mocks: { __: (text: string) => text },
			stubs: { teleport: true },
		},
	})
	await flushPromises()
	return { wrapper, router }
}

const rowLabelled = (
	wrapper: { findAll: (s: string) => DOMWrapper<Element>[] },
	label: string
): DOMWrapper<Element> | undefined =>
	wrapper.findAll('button').find((button) => button.text().includes(label))

beforeEach(() => {
	vi.clearAllMocks()
	isLoggedIn.value = true
	unreadCount.value = 0
	sidebarLinks.value = [...SIDEBAR]
	otherLinks.value = [...OTHER]
	userResource.data = {
		full_name: 'Raiza Safeel',
		username: 'raiza',
		user_image: '/files/raiza.png',
		is_moderator: true,
	}
})

describe('a cold deep link to /you', () => {
	it('renders the page with nothing mounted above it', async () => {
		const { wrapper } = await openYou()
		expect(wrapper.text()).toContain('You')
		expect(wrapper.text()).toContain('Raiza Safeel')
		expect(wrapper.text()).toContain('Log out')
	})

	// Its own <img>, not frappe-ui's Avatar: that tops out at 46px and would
	// carry a 14px initial inside this 96px circle.
	it('draws the user picture rather than an icon', async () => {
		const { wrapper } = await openYou()
		const picture = wrapper.find('[data-testid="you-profile"] img')

		expect(picture.attributes('src')).toBe('/files/raiza.png')
		expect(picture.attributes('alt')).toBe('')
	})

	it('offers no back control, because it is a root tab', async () => {
		const { wrapper } = await openYou()
		expect(wrapper.find('[data-testid="mobile-page-back"]').exists()).toBe(
			false
		)
	})

	it('stands up before the nav links have arrived', async () => {
		// The store is module-level and the layout fills it asynchronously; on a
		// cold link the page renders first and the destinations appear after.
		sidebarLinks.value = []
		otherLinks.value = []
		const { wrapper } = await openYou()
		expect(wrapper.text()).toContain('Raiza Safeel')
		expect(wrapper.text()).toContain('Colour mode')
	})

	it('asks for the unread count itself', async () => {
		await openYou()
		expect(loadUnreadCount).toHaveBeenCalledTimes(1)
	})
})

describe('what the page shows', () => {
	it('leaves out the destinations already on the bottom bar', async () => {
		const { wrapper } = await openYou()
		for (const primary of ['Home', 'Courses', 'Batches']) {
			expect(rowLabelled(wrapper, primary)).toBeUndefined()
		}
		expect(rowLabelled(wrapper, 'Certifications')).toBeDefined()
	})

	it('shows the unread count on the Notifications row', async () => {
		unreadCount.value = 4
		const { wrapper } = await openYou()
		expect(rowLabelled(wrapper, 'Notifications')?.text()).toContain('4')
	})

	it('offers no way into settings, not even to a moderator', async () => {
		// An LMS is not configured with a thumb. The desktop dialog is the only
		// settings surface, so there is no row here and no gate on one.
		const { wrapper } = await openYou()
		expect(rowLabelled(wrapper, 'Settings')).toBeUndefined()
		expect(rowLabelled(wrapper, 'Colour mode')).toBeDefined()
	})
})

describe('a signed-out visitor who types the URL', () => {
	it('is asked to log in rather than shown an account', async () => {
		isLoggedIn.value = false
		userResource.data = null
		const { wrapper } = await openYou()
		expect(wrapper.find('[data-testid="you-signed-out"]').exists()).toBe(true)
		expect(wrapper.text()).not.toContain('Log out')
	})
})

describe('picking a row', () => {
	it('opens the notifications panel in place', async () => {
		const { wrapper } = await openYou()
		await rowLabelled(wrapper, 'Notifications')?.trigger('click')
		expect(toggleNotifications).toHaveBeenCalledTimes(1)
	})

	it('logs out in place rather than routing somewhere', async () => {
		const { wrapper } = await openYou()
		await rowLabelled(wrapper, 'Log out')?.trigger('click')
		expect(logoutSubmit).toHaveBeenCalledTimes(1)
	})

	it('navigates to a destination', async () => {
		const { wrapper, router } = await openYou()
		await rowLabelled(wrapper, 'Certifications')?.trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('Certifications')
	})

	it('opens the colour-mode sheet rather than navigating away for it', async () => {
		const { wrapper } = await openYou()

		expect(wrapper.find('[data-testid="colour-mode-sheet"]').exists()).toBe(
			false
		)

		await rowLabelled(wrapper, 'Colour mode')?.trigger('click')

		const sheet = wrapper.get('[data-testid="colour-mode-sheet"]')
		expect(sheet.text()).toContain('System')
		expect(sheet.text()).toContain('Light')
		expect(sheet.text()).toContain('Dark')
	})

	it('sets the preference from the sheet and closes it', async () => {
		const { wrapper } = await openYou()

		await rowLabelled(wrapper, 'Colour mode')?.trigger('click')
		await wrapper
			.get('[data-testid="colour-mode-sheet"]')
			.findAll('button')
			.find((b) => b.text().includes('Dark'))
			?.trigger('click')

		expect(setThemePreference).toHaveBeenCalledWith('dark')
		expect(wrapper.find('[data-testid="colour-mode-sheet"]').exists()).toBe(
			false
		)
	})
})
