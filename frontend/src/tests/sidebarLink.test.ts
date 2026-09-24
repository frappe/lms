/**
 * SidebarLink maps an LMS sidebar link onto frappe-ui's SidebarItem. Every
 * branch the hand-built row's click handler had is pinned here, so the port
 * cannot drop one: palette, notifications, router route, contact form,
 * same-tab and new-tab externals, and relative web routes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

const { toggleNotifications, openExternal, settings } = vi.hoisted(() => ({
	toggleNotifications: vi.fn(),
	openExternal: vi.fn(),
	settings: { isCommandPaletteOpen: false },
}))

vi.mock('@/stores/settings', () => ({ useSettings: () => settings }))

vi.mock('@/stores/notifications', () => ({ toggleNotifications }))
vi.mock('@/utils/openExternal', () => ({ openExternal }))
vi.mock('@/components/ContactUsEmail.vue', () => ({
	default: {
		name: 'ContactUsEmail',
		props: ['modelValue'],
		template: `<div data-contact :data-open="modelValue" />`,
	},
}))

vi.stubGlobal('__', (text: string) => text)

import SidebarLink from '@/components/Sidebar/SidebarLink.vue'

const Page = { template: '<div />' }

let wrapper: VueWrapper | undefined

async function build(link: Record<string, unknown>) {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/', name: 'Home', component: Page },
			{ path: '/courses', name: 'Courses', component: Page },
		],
	})
	router.push('/')
	await router.isReady()
	wrapper = mount(SidebarLink, {
		props: { link: { label: 'Row', icon: 'Home', ...link } },
		global: { plugins: [router], mocks: { __: (t: string) => t } },
	})
	return { wrapper, router }
}

const control = (w: VueWrapper) => w.find('[data-slot="sidebar-item"] > *')

beforeEach(() => {
	settings.isCommandPaletteOpen = false
	toggleNotifications.mockClear()
	openExternal.mockClear()
})

afterEach(() => {
	wrapper?.unmount()
	wrapper = undefined
})

describe('SidebarLink', () => {
	it('opens the command palette', async () => {
		const { wrapper } = await build({ action: 'commandPalette' })
		await control(wrapper).trigger('click')
		expect(settings.isCommandPaletteOpen).toBe(true)
	})

	it('toggles notifications and keeps the outside-click marker', async () => {
		const { wrapper } = await build({ panel: 'notifications' })
		const button = control(wrapper)
		expect(button.attributes('data-notifications-trigger')).toBe('')
		await button.trigger('click')
		expect(toggleNotifications).toHaveBeenCalledOnce()
	})

	it('omits the notifications marker on other rows', async () => {
		const { wrapper } = await build({ to: 'Courses' })
		expect(control(wrapper).attributes()).not.toHaveProperty(
			'data-notifications-trigger'
		)
	})

	it('routes a known route name through the router', async () => {
		const { wrapper, router } = await build({ to: 'Courses' })
		expect(control(wrapper).attributes('href')).toBe('/courses')
		await control(wrapper).trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('Courses')
	})

	it('opens the contact form for an address without a scheme', async () => {
		const { wrapper } = await build({ to: 'help@example.com' })
		await control(wrapper).trigger('click')
		expect(wrapper.find('[data-contact]').attributes('data-open')).toBe('true')
	})

	it('mounts no contact form on an ordinary row', async () => {
		const { wrapper } = await build({ to: 'Courses' })
		expect(wrapper.find('[data-contact]').exists()).toBe(false)
	})

	it('treats an http URL with an @ as a link, not an address', async () => {
		const { wrapper } = await build({ to: 'https://x.test/@me' })
		await control(wrapper).trigger('click')
		expect(openExternal).toHaveBeenCalledWith('https://x.test/@me')
		expect(wrapper.find('[data-contact]').exists()).toBe(false)
	})

	it('keeps an external row in the same tab when asked', async () => {
		const { wrapper } = await build({
			to: 'https://x.test/a',
			open_in_new_window: 0,
		})
		expect(control(wrapper).element.tagName).toBe('A')
		expect(control(wrapper).attributes('href')).toBe('https://x.test/a')
	})

	it('drops an unsafe same-tab URL instead of linking to it', async () => {
		const { wrapper } = await build({
			to: 'httpx:evil',
			open_in_new_window: 0,
		})
		expect(control(wrapper).element.tagName).toBe('BUTTON')
	})

	it('prefixes a bare web route with one slash', async () => {
		const { wrapper } = await build({ to: 'about' })
		expect(control(wrapper).attributes('href')).toBe('/about')
	})

	it('leaves a rooted route as it is', async () => {
		const { wrapper } = await build({ to: '/about' })
		expect(control(wrapper).attributes('href')).toBe('/about')
	})

	it('is active only for the routes it names', async () => {
		const active = await build({ to: 'Home', activeFor: ['Home'] })
		expect(
			active.wrapper.find('[data-slot="sidebar-item"]').attributes('data-state')
		).toBe('active')
		active.wrapper.unmount()

		const other = await build({ to: 'Courses', activeFor: ['Courses'] })
		expect(
			other.wrapper.find('[data-slot="sidebar-item"]').attributes('data-state')
		).toBe('inactive')
	})

	it('renders nothing for a mobile-only row', async () => {
		const { wrapper } = await build({ to: 'Home', onlyMobile: true })
		expect(wrapper.find('[data-slot="sidebar-item"]').exists()).toBe(false)
	})

	it('shows the unread count in the suffix', async () => {
		const { wrapper } = await build({ panel: 'notifications', count: 4 })
		expect(wrapper.find('[data-slot="sidebar-item-suffix"]').text()).toContain(
			'4'
		)
	})
})
