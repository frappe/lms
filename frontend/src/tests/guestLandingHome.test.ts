import { describe, expect, it, vi, beforeEach } from 'vitest'
import { config, mount, flushPromises } from '@vue/test-utils'

const state = vi.hoisted(() => ({ isLoggedIn: false }))

vi.mock('frappe-ui', () => ({
	call: vi.fn(async () => ({})),
	createResource: () => ({
		data: null,
		loading: false,
		fetch: vi.fn(),
		reload: vi.fn(),
	}),
	LoadingIndicator: { template: '<span />' },
	usePageMeta: () => ({}),
}))
vi.mock('@/stores/session', () => ({
	sessionStore: () => ({
		get isLoggedIn() {
			return state.isLoggedIn
		},
		brand: {},
	}),
}))
vi.mock('@/pages/Landing/Landing.vue', () => ({
	default: { template: '<div data-test="landing">landing</div>' },
}))
vi.mock('@/pages/Home/StudentHome.vue', () => ({
	default: { template: '<div data-test="student-home">student</div>' },
}))
vi.mock('@/pages/Home/AdminHome.vue', () => ({
	default: { template: '<div data-test="admin-home">admin</div>' },
}))
vi.mock('@/pages/Home/Streak.vue', () => ({
	default: { template: '<div />' },
}))

import Home from '@/pages/Home/Home.vue'

// main.js registers __ on the app; the tests mount without it.
config.global.mocks = {
	...config.global.mocks,
	// Strings with {0} return a { format } object, as the real translate() does.
	__: (message: string) =>
		/{\d+}/.test(message) ? { format: () => message } : message,
}

beforeEach(() => {
	state.isLoggedIn = false
})

function mountHome() {
	return mount(Home, {
		global: {
			provide: {
				$user: { data: null, loading: false },
				// main.js provides $dayjs; the logged-in home reads it on mount.
				$dayjs: () => ({ format: () => '2030-01-01' }),
			},
		},
	})
}

describe('Home for guests and logged-in users', () => {
	it('a guest at / sees the landing page, not the home page', async () => {
		state.isLoggedIn = false
		const wrapper = mountHome()
		await flushPromises()

		expect(wrapper.find('[data-test="landing"]').exists()).toBe(true)
		expect(wrapper.find('[data-test="student-home"]').exists()).toBe(false)
		wrapper.unmount()
	})

	it('a logged-in user at / sees the home page, not the landing page', async () => {
		state.isLoggedIn = true
		const wrapper = mountHome()
		await flushPromises()

		expect(wrapper.find('[data-test="landing"]').exists()).toBe(false)
		wrapper.unmount()
	})
})
