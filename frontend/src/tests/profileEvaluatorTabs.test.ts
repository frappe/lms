/**
 * Slots and Schedule show only on Batch Evaluator profiles; a deep link falls back to About.
 * Regression from #1823, which showed them on any Moderator profile. Added on
 * feat/evaluator-availability-redesign (no PR yet) with the Profile.vue fix.
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
vi.mock('@/utils', () => ({
	convertToTitleCase: (s: string) => s.charAt(0).toUpperCase() + s.slice(1),
}))
vi.mock('@/utils/composables', () => ({
	useScreenSize: () => ({ isMobile: false }),
}))
vi.mock('frappe-ui', () => ({
	createResource: createResourceMock,
	call: vi.fn(),
	usePageMeta: vi.fn(),
	toast: { success: vi.fn(), error: vi.fn() },
	Button: passthrough,
	TabButtons: {
		props: ['options'],
		template:
			'<div data-testid="tabs">{{ options.map((o) => o.value).join(",") }}</div>',
	},
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

// @ts-expect-error a JS SFC has no generated types (TS7016), as in announcementForm.test.ts.
import Profile from '@/pages/Profile.vue'

const mounted: string[] = []

const tab = (name: string) =>
	defineComponent({
		mounted: () => mounted.push(name),
		template: `<div data-testid="tab">${name}</div>`,
	})

type SessionUser = Record<string, unknown>

const MODERATOR: SessionUser = {
	name: 'mod@example.com',
	username: 'mod',
	is_moderator: true,
}
const EVALUATOR: SessionUser = {
	name: 'eve@example.com',
	username: 'eve',
	is_evaluator: true,
}
const STUDENT: SessionUser = { name: 'stu@example.com', username: 'stu' }

const setup = (viewer: SessionUser, username: string, roles: string[]) => {
	const profile = reactive({
		data: { username, full_name: username, roles } as Record<string, unknown>,
		fetched: true,
		reload: vi.fn(),
	})
	createResourceMock.mockImplementation((config: { url: string }) => {
		if (config.url === 'lms.lms.api.get_profile_details') return profile
		if (config.url === 'frappe.client.get_value') {
			const lookup = reactive({ data: null, reload: vi.fn(), submit: vi.fn() })
			lookup.submit.mockImplementation(
				(_params: unknown, temp: { onSuccess?: (d: unknown) => void }) =>
					temp?.onSuccess?.({ name: `${username}@example.com` })
			)
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
				children: [
					{ path: '', name: 'ProfileAbout', component: tab('about') },
					{
						path: 'certificates',
						name: 'ProfileCertificates',
						component: tab('certificates'),
					},
					{ path: 'roles', name: 'ProfileRoles', component: tab('roles') },
					{ path: 'slots', name: 'ProfileEvaluator', component: tab('slots') },
					{
						path: 'schedule',
						name: 'ProfileEvaluationSchedule',
						component: tab('schedule'),
					},
				],
			},
		],
	})
	return { router, viewer }
}

const open = async (ctx: ReturnType<typeof setup>, path: string) => {
	await ctx.router.push(path)
	const replace = vi.spyOn(ctx.router, 'replace')
	const push = vi.spyOn(ctx.router, 'push')
	const wrapper = mount(
		{ template: '<router-view />' },
		{
			global: {
				plugins: [ctx.router],
				provide: { $user: { data: ctx.viewer } },
				mocks: { __: (text: string) => text },
			},
		}
	)
	await flushPromises()
	return { wrapper, replace, push }
}

enableAutoUnmount(afterEach)
afterEach(() => {
	mounted.length = 0
})

const cases: Array<{
	who: string
	viewer: SessionUser
	username: string
	roles: string[]
	shown: boolean
}> = [
	{
		who: 'an evaluator on their own profile',
		viewer: EVALUATOR,
		username: 'eve',
		roles: ['Batch Evaluator', 'LMS Student'],
		shown: true,
	},
	{
		who: 'a moderator on an evaluator profile',
		viewer: MODERATOR,
		username: 'eve',
		roles: ['Batch Evaluator'],
		shown: true,
	},
	{
		who: 'a moderator on a moderator who cannot evaluate',
		viewer: MODERATOR,
		username: 'max',
		roles: ['Moderator'],
		shown: false,
	},
	{
		who: 'a moderator on their own profile without the evaluator role',
		viewer: MODERATOR,
		username: 'mod',
		roles: ['Moderator'],
		shown: false,
	},
	{
		who: 'an evaluator on another evaluator profile',
		viewer: EVALUATOR,
		username: 'ola',
		roles: ['Batch Evaluator'],
		shown: false,
	},
	{
		who: 'a student on their own profile',
		viewer: STUDENT,
		username: 'stu',
		roles: ['LMS Student'],
		shown: false,
	},
]

describe('Profile evaluator tabs', () => {
	it.each(cases)(
		'$who: tabs shown is $shown',
		async ({ viewer, username, roles, shown }) => {
			const { wrapper } = await open(
				setup(viewer, username, roles),
				`/user/${username}`
			)
			const tabs = wrapper.find('[data-testid="tabs"]').text().split(',')

			expect(tabs.includes('Slots')).toBe(shown)
			expect(tabs.includes('Schedule')).toBe(shown)
		}
	)

	it.each(
		cases.flatMap((row) =>
			['slots', 'schedule'].map((segment) => ({ ...row, segment }))
		)
	)(
		'$who: /$segment stays only when the tabs are shown ($shown)',
		async ({ viewer, username, roles, shown, segment }) => {
			const ctx = setup(viewer, username, roles)
			const { wrapper, replace, push } = await open(
				ctx,
				`/user/${username}/${segment}`
			)
			const route = ctx.router.currentRoute.value

			if (shown) {
				expect(route.path).toBe(`/user/${username}/${segment}`)
				expect(wrapper.find('[data-testid="tab"]').text()).toBe(segment)
				return
			}
			expect(route.name).toBe('ProfileAbout')
			expect(wrapper.find('[data-testid="tab"]').text()).toBe('about')
			expect(replace).toHaveBeenCalledWith({ name: 'ProfileAbout' })
			expect(push).not.toHaveBeenCalled()
			expect(mounted).not.toContain(segment)
		}
	)
})
