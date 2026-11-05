import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { reactive } from 'vue'

vi.stubGlobal('__', (text: string) => text)

const { createResourceMock, passthrough } = vi.hoisted(() => ({
	createResourceMock: vi.fn(),
	passthrough: { template: '<div><slot /></div>' },
}))

vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ user: {}, brand: {} }),
}))
vi.mock('@/utils', () => ({ convertToTitleCase: (s: string) => s }))
vi.mock('@/utils/composables', () => ({
	useScreenSize: () => ({ isMobile: false }),
}))
vi.mock('frappe-ui', () => ({
	createResource: createResourceMock,
	call: vi.fn(),
	usePageMeta: vi.fn(),
	toast: { success: vi.fn(), error: vi.fn() },
	Button: passthrough,
	TabButtons: passthrough,
}))

const { stub } = vi.hoisted(() => ({
	stub: () => ({ default: { render: () => null } }),
}))
vi.mock('@/components/Layouts/pages/PageHeader.vue', stub)
vi.mock('@/components/HeaderButton.vue', stub)
vi.mock('@/components/UserAvatar.vue', stub)
vi.mock('@/components/NoPermission.vue', stub)
vi.mock('@/pages/NotFound.vue', stub)
vi.mock('@/components/Profile/ProfileAvatar.vue', stub)
vi.mock('@/components/Profile/ProfileCover.vue', stub)
vi.mock('@/components/Profile/ProfileSocialLinks.vue', stub)

// @ts-expect-error a JS SFC has no generated types
import Profile from '@/pages/Profile.vue'

enableAutoUnmount(afterEach)

describe('Profile email display', () => {
	it('displays registered email for session user', async () => {
		const profile = reactive({
			data: {
				username: 'student1',
				full_name: 'Student One',
				name: 'student@example.com',
			},
			fetched: true,
			reload: vi.fn(),
		})

		createResourceMock.mockImplementation((opts: { url: string }) => {
			if (opts.url === 'lms.lms.api.get_profile_details') return profile
			return { submit: vi.fn(), data: null }
		})

		const router = createRouter({
			history: createMemoryHistory(),
			routes: [
				{
					path: '/user/:username',
					component: Profile,
					props: true,
					children: [
						{ path: '', name: 'ProfileAbout', component: { template: '<div />' } },
					],
				},
			],
		})
		await router.push('/user/student1')
		await router.isReady()

		const wrapper = mount(Profile, {
			props: { username: 'student1' },
			global: {
				plugins: [router],
				mocks: {
					__: (t: string) => t,
				},
				provide: {
					$user: {
						data: {
							username: 'student1',
							email: 'student@example.com',
						},
					},
				},
			},
		})

		const emailEl = wrapper.find('[data-testid="profile-email"]')
		expect(emailEl.exists()).toBe(true)
		expect(emailEl.text()).toContain('student@example.com')
	})
})
