import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { reactive } from 'vue'

vi.stubGlobal('__', (text: string) => text)

const { createResourceMock, passthrough } = vi.hoisted(() => {
	// @/utils pulls in plyr, which touches matchMedia at import time.
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
	return {
		createResourceMock: vi.fn(),
		passthrough: {
			inheritAttrs: false,
			template: `<div><slot name="icon" /><slot /></div>`,
		},
	}
})

vi.mock('@/stores/settings', () => ({ useSettings: () => ({}) }))
vi.mock('@/stores/user', () => ({ usersStore: () => ({ userResource: {} }) }))
vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ user: {}, brand: {} }),
}))

// frappe-ui's ESM build does not resolve under vitest, so every export the two
// components under test reach for is stubbed by hand.
vi.mock('frappe-ui', () => ({
	createResource: createResourceMock,
	call: vi.fn(),
	usePageMeta: vi.fn(),
	toast: { success: vi.fn(), error: vi.fn() },
	Dialog: {
		name: 'Dialog',
		props: ['open', 'title', 'size'],
		emits: ['update:open'],
		template: `<div v-if="open" role="dialog"><slot name="title" /><slot /><slot name="actions" /></div>`,
	},
	Button: {
		inheritAttrs: false,
		template: `<button v-bind="$attrs"><slot name="icon" /><slot /></button>`,
	},
	FormControl: {
		props: ['modelValue', 'label', 'type', 'required'],
		emits: ['update:modelValue'],
		template: `<label>{{ label }}<input :value="modelValue" /></label>`,
	},
	Badge: passthrough,
	TabButtons: passthrough,
	Tooltip: passthrough,
}))

const { stub } = vi.hoisted(() => ({
	stub: () => ({ default: { render: () => null } }),
}))
vi.mock('@/components/Controls/Link.vue', stub)
vi.mock('@/components/Controls/Uploader.vue', stub)
vi.mock('@/components/RichTextEditor.vue', stub)
vi.mock('@/components/Layouts/PageHeader.vue', stub)
// Rendered rather than nulled: the form's Save carries its data-testid on this
// component, so a null stub takes the button out of the DOM entirely.
vi.mock('@/components/HeaderButton.vue', () => ({
	default: {
		props: ['label'],
		emits: ['click'],
		template: `<button @click="$emit('click', $event)">{{ label }}</button>`,
	},
}))
vi.mock('@/components/Modals/EditCoverImage.vue', stub)
vi.mock('@/components/UserAvatar.vue', stub)
vi.mock('@/components/NoPermission.vue', stub)
vi.mock('@/pages/NotFound.vue', stub)

// The REAL route table, not a copy: a reimplemented table would only prove that
// vue-router nests what you tell it to nest.
import { routes } from '@/routes'
// Imported statically as well as through the table's lazy `() => import(...)`,
// for the same reason chapterRoute.test.ts does it: a cold transform started by
// a navigation overruns the timeout under a parallel suite run.
import ProfileEditForm from '@/pages/Forms/ProfileEditForm.vue'
import Profile from '@/pages/Profile.vue'

const USERNAME = 'johndoe'

const profileResource = reactive({
	data: null as Record<string, unknown> | null,
	loading: false,
	fetched: true,
	error: null,
	reload: vi.fn(),
})

createResourceMock.mockImplementation(() =>
	reactive({ loading: false, submit: vi.fn(), reload: vi.fn(), data: null })
)

const makeRouter = (): Router =>
	createRouter({ history: createMemoryHistory(), routes })

const mountForm = (router: Router, username: string) =>
	mount(ProfileEditForm, {
		props: { username: USERNAME, profile: profileResource },
		global: {
			plugins: [router],
			provide: {
				$user: { data: { name: 'john@example.com', username } },
			},
			stubs: { teleport: true },
			mocks: { __: (text: string) => text },
		},
	})

// The route components are lazy imports, so a navigation started by a close
// resolves a real module load — flushPromises only drains microtasks and would
// return while the navigation is still pending. Wait for the router instead.
const nextNavigation = (router: Router): Promise<void> =>
	new Promise((resolve) => {
		const off = router.afterEach(() => {
			off()
			resolve()
		})
	})

enableAutoUnmount(afterEach)

describe('the profile edit route', () => {
	beforeEach(() => {
		Object.defineProperty(window, 'innerWidth', {
			value: 1024,
			writable: true,
			configurable: true,
		})
		profileResource.data = {
			name: 'john@example.com',
			username: USERNAME,
			first_name: 'John',
			last_name: 'Doe',
			user_image: '/files/john.png',
			headline: 'Learner',
			language: 'en',
		}
		profileResource.reload.mockClear()
	})

	// resolve(), not push(): matching is synchronous and does not pull in the
	// lazy page components, several of which are expensive to transform for an
	// assertion that is purely about the route table.
	it('resolves /user/X/edit to the form nested under the profile', () => {
		const resolved = makeRouter().resolve(`/user/${USERNAME}/edit`)
		expect(resolved.name).toBe('ProfileEditForm')
		expect(resolved.matched.map((r) => r.name)).toEqual([
			'Profile',
			'ProfileEditForm',
		])
		expect(resolved.params.username).toBe(USERNAME)
	})

	it('points that route at the profile edit form itself', async () => {
		type LazyRecord = {
			name?: unknown
			children?: LazyRecord[]
			component?: () => Promise<unknown>
		}
		const record = (routes as LazyRecord[])
			.find((route) => route.name === 'Profile')
			?.children?.find((child) => child.name === 'ProfileEditForm')
		expect(record?.component).toBeTypeOf('function')
		await expect(record!.component!()).resolves.toMatchObject({
			default: ProfileEditForm,
		})
	})

	it('leaves the existing profile tab routes alone', () => {
		const router = makeRouter()
		expect(router.resolve(`/user/${USERNAME}`).name).toBe('ProfileAbout')
		expect(router.resolve(`/user/${USERNAME}/certificates`).name).toBe(
			'ProfileCertificates'
		)
		expect(router.resolve(`/user/${USERNAME}/roles`).name).toBe('ProfileRoles')
	})

	// The Edit Profile button's `isSessionUser()` gate cannot guard a URL, so
	// somebody else's /user/X/edit has to be refused by the page itself.
	it('refuses the form to anyone but the profile owner', async () => {
		const router = makeRouter()
		await router.push(`/user/${USERNAME}/edit`)
		const wrapper = mountForm(router, 'someoneelse')
		await flushPromises()

		expect(wrapper.find('[data-testid="profile-fields"]').exists()).toBe(false)
		expect(wrapper.find('[data-testid="profile-save"]').exists()).toBe(false)
		expect(wrapper.text()).toContain('You can only edit your own profile.')
	})

	it('shows the fields to the profile owner', async () => {
		const router = makeRouter()
		await router.push(`/user/${USERNAME}/edit`)
		const wrapper = mountForm(router, USERNAME)
		await flushPromises()

		expect(wrapper.find('[data-testid="profile-fields"]').exists()).toBe(true)
		expect(wrapper.find('[data-testid="profile-save"]').exists()).toBe(true)
	})

	// Cold deep link: nothing opened this form, so there is no history entry of
	// ours to pop and no in-memory profile handed over from a click. The form
	// seeds itself from the resource the parent route already owns — the modal's
	// seeding watcher had no `immediate`, which on this path left it blank.
	it('stands up on a cold deep link and closes onto the profile', async () => {
		const router = makeRouter()
		await router.push(`/user/${USERNAME}/edit`)
		const wrapper = mountForm(router, USERNAME)
		await flushPromises()

		const fields = wrapper.get('[data-testid="profile-fields"]')
		expect(fields.findAll('input').map((input) => input.element.value)).toEqual(
			expect.arrayContaining(['John', 'Doe'])
		)

		const navigated = nextNavigation(router)
		wrapper.findComponent({ name: 'Dialog' }).vm.$emit('update:open', false)
		await navigated
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('ProfileAbout')
		expect(router.currentRoute.value.params.username).toBe(USERNAME)
	})

	// The tab strip drives the child route off `activeTab`, and `edit` matches no
	// tab segment — so without the guard the profile page pushes the About tab
	// over the form the moment it mounts, and the deep link above never renders.
	it('does not let the profile page bounce the form back to a tab', async () => {
		const router = makeRouter()
		await router.push(`/user/${USERNAME}/edit`)
		mount(Profile, {
			props: { username: USERNAME },
			shallow: true,
			global: {
				plugins: [router],
				provide: { $user: { data: { name: 'john@example.com' } } },
				mocks: { __: (text: string) => text },
			},
		})
		await flushPromises()

		expect(router.currentRoute.value.name).toBe('ProfileEditForm')
	})

	it('resumes syncing the tab once the form is left', async () => {
		const router = makeRouter()
		await router.push(`/user/${USERNAME}/edit`)
		mount(Profile, {
			props: { username: USERNAME },
			shallow: true,
			global: {
				plugins: [router],
				provide: { $user: { data: { name: 'john@example.com' } } },
				mocks: { __: (text: string) => text },
			},
		})
		await flushPromises()

		await router.replace(`/user/${USERNAME}/certificates`)
		await flushPromises()

		expect(router.currentRoute.value.name).toBe('ProfileAbout')
	})
})
