/**
 * The user menu's Theme row. Before this conversion it toggled light/dark only
 * — the tri-state 'system' preference `utils/theme.ts` already supports had no
 * way into the UI. It is now a submenu (Light/Dark/System), matching the
 * pattern frappe-ui's Dropdown docs show for a theme switcher in a user menu
 * (stories/UserMenu.vue) — not the full `ThemeSwitcher` component, which is
 * for a settings panel, not a menu row.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// Only what this suite controls is replaced; the rest of frappe-ui stays real.
// SidebarHeader becomes a prop-capturing stub because the assertions are about
// the menu's own data (which rows exist, what they call), not popover mechanics.
vi.mock('frappe-ui', async () => {
	const actual = await vi.importActual<typeof import('frappe-ui')>('frappe-ui')
	return {
		...actual,
		call: vi.fn(),
		createResource: () => ({ data: null, loading: false, submit: vi.fn() }),
		toast: { success: vi.fn(), error: vi.fn() },
		SidebarHeader: {
			name: 'SidebarHeader',
			props: ['title', 'subtitle', 'menuItems'],
			template: `<div><slot name="prefix" /></div>`,
		},
	}
})

vi.mock('@/stores/session', () => ({
	sessionStore: () => ({
		logout: { submit: vi.fn() },
		branding: { data: null },
		isLoggedIn: true,
	}),
}))

vi.mock('@/stores/user', () => ({
	usersStore: () => ({ userResource: { data: { is_moderator: false } } }),
}))

vi.mock('@/stores/settings', () => ({
	useSettings: () => ({ settings: { data: null } }),
}))

vi.mock('@/composables/useSettingsHash', () => ({ pushSettingsHash: vi.fn() }))
vi.mock('@/utils/openExternal', () => ({ openExternal: vi.fn() }))
vi.mock('@/utils/dialogs', () => ({ createDialog: vi.fn() }))
vi.mock('@/components/Icons/LMSLogo.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/Settings/Settings.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/utils', () => ({ convertToTitleCase: (s: string) => s }))
vi.mock('@/utils/safeUrl', () => ({ safeUrl: (s: string) => s }))

vi.stubGlobal('__', (text: string) => text)

import UserDropdown from '@/components/Sidebar/UserDropdown.vue'
import { setThemePreference, themePreference } from '@/utils/theme'

function build() {
	setActivePinia(createPinia())
	return mount(UserDropdown, { global: { mocks: { __: (t: string) => t } } })
}

function themeMenu(wrapper: ReturnType<typeof build>) {
	const options = wrapper
		.findComponent({ name: 'SidebarHeader' })
		.props('menuItems')
	const group = options[0].options as any[]
	return group.find((option) => option.label === 'Theme')
}

describe('UserDropdown theme menu', () => {
	beforeEach(() => {
		setThemePreference('system')
	})

	afterEach(() => {
		setThemePreference('system')
	})

	it('offers Light, Dark and System', () => {
		const menu = themeMenu(build())
		expect(menu.submenu.map((item: any) => item.label)).toEqual([
			'Light',
			'Dark',
			'System',
		])
	})

	it('marks the current preference selected', () => {
		setThemePreference('dark')
		const menu = themeMenu(build())
		const selected = menu.submenu.filter((item: any) => item.selected)
		expect(selected.map((item: any) => item.label)).toEqual(['Dark'])
	})

	it('draws a check beside the selected theme only', () => {
		setThemePreference('light')
		const menu = themeMenu(build())
		const checks = menu.submenu.map((item: any) =>
			item.slots.suffix({ selected: item.selected })
		)
		expect(checks.map(Boolean)).toEqual([true, false, false])
	})

	it('sets the preference when a theme is picked', () => {
		const menu = themeMenu(build())
		menu.submenu.find((item: any) => item.label === 'Light').onClick()
		expect(themePreference.value).toBe('light')

		menu.submenu.find((item: any) => item.label === 'System').onClick()
		expect(themePreference.value).toBe('system')
	})
})
