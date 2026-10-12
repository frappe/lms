// Guards a first visit, with no user_id cookie yet, being taken for a signed-in
// user and asking get_user_info, which 403s for guests. Came with 933bc5826
// closing that endpoint to guests. Added on fix-1 with the missing-cookie check.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { reloadUser } = vi.hoisted(() => ({ reloadUser: vi.fn() }))

vi.mock('frappe-ui', () => ({
	createResource: () => ({ reload: vi.fn(), reset: vi.fn(), data: null }),
}))
vi.mock('@/stores/user', () => ({
	usersStore: () => ({ userResource: { reload: reloadUser, reset: vi.fn() } }),
}))

import { sessionStore } from '@/stores/session'

const setCookie = (value: string) => {
	Object.defineProperty(document, 'cookie', { value, configurable: true })
}

beforeEach(() => {
	setActivePinia(createPinia())
	reloadUser.mockClear()
})

afterEach(() => {
	setCookie('')
})

describe('sessionStore', () => {
	it('treats a visit with no user_id cookie as a guest', () => {
		setCookie('')

		const session = sessionStore()

		expect(session.isLoggedIn).toBe(false)
		expect(reloadUser).not.toHaveBeenCalled()
	})

	it('treats the Guest cookie as a guest', () => {
		setCookie('user_id=Guest')

		sessionStore()

		expect(reloadUser).not.toHaveBeenCalled()
	})

	it('loads the user for a signed-in session', () => {
		setCookie('user_id=learner%40example.com')

		const session = sessionStore()

		expect(session.isLoggedIn).toBe(true)
		expect(reloadUser).toHaveBeenCalled()
	})
})
