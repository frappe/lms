/**
 * UserDropdown.vue: apps resource guest session handling (#2761).
 *
 * LMS frontend calls `frappe.apps.get_apps` which is not whitelisted for guests
 * and returns 403. This test verifies that `frappe.apps.get_apps` resource is only
 * automatically requested when the user is a system user.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type ResourceOpts = {
	url: string
	auto?: boolean
	cache?: string
	transform?: (data: unknown) => unknown
}

const resources: ResourceOpts[] = []

vi.mock('frappe-ui', () => ({
	createResource: (opts: ResourceOpts) => {
		resources.push(opts)
		return {
			...opts,
			data: null,
			loading: false,
			fetch: vi.fn(),
			reload: vi.fn(),
		}
	},
	call: vi.fn(),
	Dropdown: { template: '<div><slot /></div>' },
	toast: vi.fn(),
}))

vi.mock('vue-router', () => ({
	useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/stores/session', () => ({
	sessionStore: () => ({
		logout: vi.fn(),
		branding: { data: {} },
		isLoggedIn: { value: false },
	}),
}))

vi.mock('@/stores/user', () => ({
	usersStore: () => ({
		userResource: { data: {} },
	}),
}))

vi.mock('@/stores/settings', () => ({
	useSettings: () => ({
		isSettingsOpen: false,
	}),
}))

vi.mock('@/utils/theme', () => ({
	theme: { value: 'light' },
	themePreference: { value: 'system' },
	toggleTheme: vi.fn(),
	setThemePreference: vi.fn(),
}))

vi.mock('@/utils/dialogs', () => ({
	createDialog: vi.fn(),
}))

vi.mock('@/components/Settings/Settings.vue', () => ({
	default: { template: '<div />' },
}))

describe('UserDropdown apps resource', () => {
	const originalCookie = document.cookie

	beforeEach(() => {
		resources.length = 0
		vi.resetModules()
	})

	afterEach(() => {
		document.cookie = originalCookie
	})

	it('does not auto-fetch frappe.apps.get_apps for guest users', async () => {
		document.cookie = 'system_user=no; user_id=Guest'
		await import('@/components/Sidebar/UserDropdown.vue')

		const appsResource = resources.find((r) => r.url === 'frappe.apps.get_apps')
		expect(appsResource).toBeDefined()
		expect(appsResource?.auto).toBe(false)
	})
})
