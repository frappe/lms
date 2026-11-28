import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

type FakeResource = {
	url: string
	data: unknown
	error: unknown
	loading: boolean
	fetched?: boolean
	reload: () => Promise<void>
}

const { resources } = vi.hoisted(() => ({
	resources: [] as FakeResource[],
}))

vi.stubGlobal('__', (text: string) => text)
if (!('format' in String.prototype)) {
	// eslint-disable-next-line no-extend-native
	Object.defineProperty(String.prototype, 'format', {
		value: function (...args: string[]) {
			return this.replace(/\{(\d+)\}/g, (_: string, i: number) => args[i] ?? '')
		},
	})
}

vi.mock('frappe-ui', () => ({
	createResource: (options: { url: string }) => {
		const resource = reactive({
			url: options.url,
			data: null,
			error: null,
			loading: true,
			reload() {
				resource.loading = true
				return Promise.resolve()
			},
		}) as FakeResource
		resources.push(resource)
		return resource
	},
	call: vi.fn(),
	toast: { success: vi.fn() },
	usePageMeta: vi.fn(),
	Avatar: { template: '<span />' },
	Badge: { template: '<span><slot /></span>' },
	Button: { template: '<button><slot /></button>' },
	Dropdown: { template: '<div><slot /></div>' },
	HoverCard: { template: '<div><slot name="trigger" /></div>' },
	TabButtons: { template: '<div />' },
}))
vi.mock('@/utils', () => ({
	convertToTitleCase: (text: string) => text,
	decodeEntities: (text: string) => text,
}))
vi.mock('@/components/Profile/ProfileSocialLinks.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/utils/composables', () => ({
	useScreenSize: () => ({ isMobile: false }),
}))
vi.mock('@/components/Profile/ProfileCover.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/Profile/ProfileAvatar.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/Profile/ChangePasswordDialog.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ brand: {}, branding: {}, user: {} }),
}))
vi.mock('@/components/Layouts/pages/PageHeader.vue', () => ({
	default: { template: '<header />' },
}))
vi.mock('@/components/Settings/Members/members', () => ({
	ROLE_ROWS: [{ key: 'is_student', role: 'LMS Student' }],
	noRoles: () => ({ is_student: false }),
}))
vi.mock('@/components/Controls/RoleSwitches.vue', () => ({
	default: { template: '<div data-testid="role-switches" />' },
}))

const resource = (url: string) => {
	const found = resources.find((r) => r.url === url)
	if (!found) throw new Error(`no resource for ${url}`)
	return found
}

const land = async (url: string, data: unknown) => {
	const r = resource(url)
	r.data = data
	r.loading = false
	r.fetched = true
	await nextTick()
}

const refetch = async (url: string) => {
	resource(url).loading = true
	await nextTick()
}

const global = {
	mocks: { __: (text: string) => text },
	provide: {
		$user: { data: { name: 'me' } },
		$dayjs: () => ({ format: () => '' }),
	},
	stubs: { RouterLink: RouterLinkStub, 'router-link': RouterLinkStub },
}

beforeEach(() => {
	resources.length = 0
})

describe('ProfileCertificates skeleton', () => {
	const URL = 'lms.lms.api.get_user_certificates'
	const mountTab = async () => {
		const { default: Tab } = await import('@/pages/ProfileCertificates.vue')
		return mount(Tab, {
			props: { profile: { data: { username: 'ann' } } },
			global,
		})
	}

	it('shows card skeletons, not the empty sentence, until certificates land', async () => {
		const wrapper = await mountTab()
		expect(wrapper.find('[data-testid="certificates-skeleton"]').exists()).toBe(
			true
		)
		expect(wrapper.text()).not.toContain('not received any certificates')

		await land(URL, [{ name: 'c1', course: 'x', course_title: 'Course X' }])
		expect(wrapper.find('[data-testid="certificates-skeleton"]').exists()).toBe(
			false
		)
		expect(wrapper.text()).toContain('Course X')

		await refetch(URL)
		expect(wrapper.find('[data-testid="certificates-skeleton"]').exists()).toBe(
			false
		)
	})

	it('is aria-hidden', async () => {
		const wrapper = await mountTab()
		const cards = wrapper.findAll('[data-testid="certificates-skeleton"] > *')
		expect(cards.length).toBeGreaterThan(0)
		cards.forEach((card) => expect(card.attributes('aria-hidden')).toBe('true'))
	})
})

describe('ProfileRoles skeleton', () => {
	const URL = 'lms.lms.utils.get_roles'

	it('holds the switches back until the roles land', async () => {
		const { default: Tab } = await import('@/pages/ProfileRoles.vue')
		const wrapper = mount(Tab, {
			props: { profile: { data: { name: 'ann@example.com' } } },
			global,
		})
		expect(wrapper.find('[data-testid="roles-skeleton"]').exists()).toBe(true)
		expect(wrapper.find('[data-testid="role-switches"]').exists()).toBe(false)

		await land(URL, { is_student: true })
		expect(wrapper.find('[data-testid="roles-skeleton"]').exists()).toBe(false)
		expect(wrapper.find('[data-testid="role-switches"]').exists()).toBe(true)

		await refetch(URL)
		expect(wrapper.find('[data-testid="roles-skeleton"]').exists()).toBe(false)
	})
})

describe('Profile skeleton', () => {
	const URL = 'lms.lms.api.get_profile_details'

	it('stands in for the whole profile until it lands', async () => {
		const { default: Profile } = await import('@/pages/Profile.vue')
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [
				{
					path: '/user/:username',
					component: Profile,
					props: true,
					children: [
						{
							path: '',
							name: 'ProfileAbout',
							component: { template: '<div data-testid="tab" />' },
						},
					],
				},
			],
		})
		await router.push('/user/ann')
		const wrapper = mount(
			{ template: '<router-view />' },
			{ global: { ...global, stubs: {}, plugins: [router] } }
		)
		await flushPromises()
		expect(wrapper.find('[data-testid="profile-skeleton"]').exists()).toBe(true)
		expect(wrapper.find('h1').exists()).toBe(false)

		await land(URL, { username: 'ann', full_name: 'Ann', name: 'ann@x.com' })
		await flushPromises()
		expect(wrapper.find('[data-testid="profile-skeleton"]').exists()).toBe(
			false
		)
		expect(wrapper.find('h1').text()).toBe('Ann')
		expect(wrapper.find('[data-testid="tab"]').exists()).toBe(true)

		await refetch(URL)
		expect(wrapper.find('[data-testid="profile-skeleton"]').exists()).toBe(
			false
		)
	})
})
