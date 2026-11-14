import { describe, expect, it, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({
	isLoggedIn: false,
	settingsData: undefined as Record<string, unknown> | undefined,
	routerPush: vi.fn(),
}))

vi.mock('frappe-ui', () => ({
	call: vi.fn(async () => ({ needs_setup: false })),
}))
vi.mock('@/stores/session', () => ({
	sessionStore: () => ({
		get isLoggedIn() {
			return state.isLoggedIn
		},
	}),
}))
vi.mock('@/stores/user', () => ({
	usersStore: () => ({
		userResource: { promise: Promise.resolve(), data: null },
	}),
}))
vi.mock('@/stores/settings', () => ({
	useSettings: () => ({
		settings: {
			promise: Promise.resolve(),
			get data() {
				return state.settingsData
			},
		},
	}),
}))

import { guardNavigation } from '@/router'

const homeRoute = { name: 'Home', path: '/' } as any

beforeEach(() => {
	state.isLoggedIn = false
	state.settingsData = { allow_guest_access: 1, show_guest_landing: 1 }
	state.routerPush.mockClear()
	Object.defineProperty(window, 'location', {
		value: { href: '' },
		writable: true,
		configurable: true,
	})
})

describe('guest landing guard', () => {
	it('lets a guest reach / when show_guest_landing is on, without a redirect', async () => {
		const next = vi.fn()
		await guardNavigation(homeRoute, {}, next)

		expect(next).toHaveBeenCalledWith()
	})

	it('sends a guest from / to Courses when show_guest_landing is off', async () => {
		state.settingsData = { allow_guest_access: 1, show_guest_landing: 0 }
		const next = vi.fn()
		await guardNavigation(homeRoute, {}, next)

		expect(next).toHaveBeenCalledWith({ name: 'Courses' })
	})

	it('sends a guest to login when guest access is off', async () => {
		state.settingsData = { allow_guest_access: 0, show_guest_landing: 1 }
		const next = vi.fn()
		await guardNavigation(homeRoute, {}, next)

		expect(window.location.href).toBe('/login')
		expect(next).not.toHaveBeenCalled()
	})

	it('falls back to login when the settings request fails, instead of showing a blank page', async () => {
		state.settingsData = undefined
		const next = vi.fn()
		await guardNavigation(homeRoute, {}, next)

		expect(window.location.href).toBe('/login')
	})

	it('a logged-in user at / is not sent to Landing or Courses', async () => {
		state.isLoggedIn = true
		const next = vi.fn()
		await guardNavigation(homeRoute, {}, next)

		expect(next).toHaveBeenCalledWith()
		expect(window.location.href).toBe('')
	})
})
