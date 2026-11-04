/**
 * get_profile_details sends another user's email to no one. The moderator-only
 * tabs act on it, so Profile.vue reads it from User under the moderator's own
 * DocPerms, and nobody else asks.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, reactive } from 'vue'

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
	Tooltip: passthrough,
}))

const { stub } = vi.hoisted(() => ({
	stub: () => ({ default: { render: () => null } }),
}))
vi.mock('@/components/Layouts/PageHeader.vue', stub)
vi.mock('@/components/HeaderButton.vue', stub)
vi.mock('@/components/UserAvatar.vue', stub)
vi.mock('@/components/NoPermission.vue', stub)
vi.mock('@/pages/NotFound.vue', stub)
vi.mock('@/components/Modals/EditCoverImage.vue', stub)

// @ts-expect-error a JS SFC has no generated types (TS7016), as in announcementForm.test.ts.
import Profile from '@/pages/Profile.vue'

const Tab = defineComponent({
	props: ['profile'],
	template: '<div data-testid="tab">{{ profile.data.name }}</div>',
})

const setup = (sessionUser: Record<string, unknown>) => {
	const profile = reactive({
		data: { username: 'ola', full_name: 'Ola Other' } as Record<
			string,
			unknown
		>,
		fetched: true,
		reload: vi.fn(),
	})
	const lookup = reactive({
		submit: vi.fn(),
		reload: vi.fn(),
		data: null,
	})
	// Like frappe-ui: the resource's own handlers, then the per-call ones.
	const respond = (config: any, temp: any, data: Record<string, unknown>) => {
		config.onSuccess?.(data)
		temp?.onSuccess?.(data)
	}
	const pending: Array<() => void> = []
	createResourceMock.mockImplementation((config: any) => {
		if (config.url === 'lms.lms.api.get_profile_details') return profile
		if (config.url === 'frappe.client.get_value') {
			lookup.submit.mockImplementation((params: any, temp: any) => {
				const email = `${params.filters.username}@example.com`
				const settle = () => respond(config, temp, { name: email })
				if (deferLookups) pending.push(settle)
				else settle()
			})
			return lookup
		}
		return reactive({ submit: vi.fn(), reload: vi.fn(), data: null })
	})
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: '/user/:username',
				component: Profile,
				props: true,
				children: [{ path: '', name: 'ProfileAbout', component: Tab }],
			},
		],
	})
	return { profile, lookup, router, sessionUser, pending }
}

let deferLookups = false

const mountProfile = async (ctx: ReturnType<typeof setup>) => {
	await ctx.router.push('/user/ola')
	const wrapper = mount(
		{ template: '<router-view />' },
		{
			global: {
				plugins: [ctx.router],
				provide: { $user: { data: ctx.sessionUser } },
				mocks: { __: (text: string) => text },
			},
		}
	)
	await flushPromises()
	return wrapper
}

enableAutoUnmount(afterEach)
afterEach(() => {
	deferLookups = false
})

describe('Profile email for moderator-only tabs', () => {
	it('a moderator reads the email from User and the tabs get it', async () => {
		const ctx = setup({
			name: 'mod@example.com',
			username: 'mod',
			is_moderator: true,
		})
		const wrapper = await mountProfile(ctx)

		expect(ctx.lookup.submit.mock.calls[0][0]).toEqual({
			doctype: 'User',
			filters: { username: 'ola' },
			fieldname: 'name',
		})
		expect(wrapper.find('[data-testid="tab"]').text()).toBe('ola@example.com')
	})

	it('nobody else asks, and the tabs render without it', async () => {
		const ctx = setup({ name: 'sam@example.com', username: 'sam' })
		const wrapper = await mountProfile(ctx)

		expect(ctx.lookup.submit).not.toHaveBeenCalled()
		expect(wrapper.find('[data-testid="tab"]').exists()).toBe(true)
		expect(ctx.profile.data.name).toBeUndefined()
	})

	it('drops a lookup that resolves after moving to another profile', async () => {
		deferLookups = true
		const ctx = setup({
			name: 'mod@example.com',
			username: 'mod',
			is_moderator: true,
		})
		await mountProfile(ctx)
		expect(ctx.pending).toHaveLength(1)

		ctx.profile.data = { username: 'bea', full_name: 'Bea Other' }
		await flushPromises()
		expect(ctx.pending).toHaveLength(2)

		const [olaLookup, beaLookup] = ctx.pending
		olaLookup()
		await flushPromises()
		expect(ctx.profile.data.name).toBeUndefined()

		beaLookup()
		await flushPromises()
		expect(ctx.profile.data.name).toBe('bea@example.com')
	})
})
