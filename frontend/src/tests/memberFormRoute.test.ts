import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import {
	createMemoryHistory,
	createRouter,
	RouterView,
	type Router,
} from 'vue-router'
import { defineComponent, h, reactive } from 'vue'

vi.stubGlobal('__', (text: string) => text)
enableAutoUnmount(afterEach)

// Stubbed so tests control call/resource responses without a network.
const { callMock, createResourceMock, toastMock } = vi.hoisted(() => {
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
	return {
		callMock: vi.fn(),
		createResourceMock: vi.fn(),
		toastMock: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
	}
})

// HeaderButton wraps frappe-ui's Button in a Tooltip below the mobile
// breakpoint, and the hand-written frappe-ui mock here has no Tooltip. Stub it
// down to the bare button so the fallthrough attrs the assertions use
// (data-testid, the click handler) still land where they did before.
vi.mock('@/components/HeaderButton.vue', () => ({
	default: {
		inheritAttrs: false,
		template: `<button v-bind="$attrs" />`,
	},
}))

vi.mock('frappe-ui', () => ({
	call: callMock,
	createResource: createResourceMock,
	toast: toastMock,
	Dialog: {
		name: 'Dialog',
		props: ['open', 'title', 'size'],
		emits: ['update:open'],
		template: `<div v-if="open" role="dialog"><h2>{{ title }}</h2><slot /><slot name="actions" /></div>`,
	},
	Button: {
		inheritAttrs: false,
		template: `<button v-bind="$attrs"><slot name="icon" /><slot /></button>`,
	},
	FormControl: {
		props: [
			'modelValue',
			'label',
			'type',
			'placeholder',
			'required',
			'disabled',
		],
		emits: ['update:modelValue'],
		template: `<label :data-testid="'field-' + label">{{ label }}
			<input :value="modelValue" :disabled="disabled" @input="$emit('update:modelValue', $event.target.value)" />
		</label>`,
	},
}))

vi.mock(
	'@framework/ui/components/Onboarding/index',
	async (importOriginal) => ({
		...(await importOriginal<
			typeof import('@framework/ui/components/Onboarding/index')
		>()),
		useOnboarding: () => ({ updateOnboardingStep: vi.fn() }),
	})
)
vi.mock('@framework/ui/telemetry/index', async (importOriginal) => ({
	...(await importOriginal<typeof import('@framework/ui/telemetry/index')>()),
	useTelemetry: () => ({ capture: vi.fn() }),
}))

// @/utils is the barrel that pulls in plyr; only cleanError is used here.
vi.mock('@/utils', () => ({ cleanError: (msg: string) => msg }))

vi.mock('@/components/Controls/BooleanSwitch.vue', () => ({
	default: {
		props: ['modelValue', 'label', 'size'],
		emits: ['update:modelValue'],
		template: `<button :data-testid="'role-' + label" :data-on="String(modelValue)" @click="$emit('update:modelValue', !modelValue)">{{ label }}</button>`,
	},
}))

import MemberForm from '@/pages/Forms/MemberForm.vue'
import { openFormRoute } from '@/composables/useFormRoute'
import { membersRevision } from '@/stores/members'

const MEMBER = 'jane@doe.com'

// One shared resource object per mount, standing in for the get_member lookup
// the page owns. `data` starts null, the way a fetch that has not landed does —
// and is a single row, not a page of search hits.
const lookup = reactive({
	data: null as Record<string, unknown> | null,
	loading: false,
	fetch: vi.fn(),
})
createResourceMock.mockImplementation(() => lookup)

const moderator = { name: 'mod@example.com', is_moderator: true }
const outsider = { name: 'someone@example.com' }

const FormRoute = { path: '/settings/users/:memberID', component: MemberForm }

const makeRouter = (): Router =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/', name: 'Home', component: { template: '<div>HOME</div>' } },
			{
				path: '/you',
				name: 'MobileYou',
				component: { template: '<div>YOU</div>' },
			},
			{ ...FormRoute, name: 'MemberForm', props: true },
		],
	})

const mountForm = async (
	router: Router,
	user: Record<string, unknown> | null = moderator
) => {
	const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
		global: {
			plugins: [router],
			provide: { $user: { data: user } },
			stubs: { teleport: true },
			// vi.stubGlobal alone doesn't reach a compiled template's `_ctx.__`
			// access — it has to be on the instance too (see FormShell.test.ts).
			mocks: { __: (text: string) => text },
		},
	})
	await flushPromises()
	return wrapper
}

const fields = (wrapper: ReturnType<typeof mount>) =>
	wrapper.find('[data-testid="member-fields"]')

const save = (wrapper: ReturnType<typeof mount>) =>
	wrapper.find('[data-testid="member-save"]')

describe('the member form route', () => {
	beforeEach(() => {
		Object.defineProperty(window, 'innerWidth', {
			value: 1024,
			writable: true,
			configurable: true,
		})
		lookup.data = null
		lookup.fetch.mockClear()
		callMock.mockReset()
		createResourceMock.mockClear()
		toastMock.success.mockClear()
		toastMock.error.mockClear()
	})

	// Members.vue's Add button carried no gate of its own; the gate was on the
	// settings surface around it, and a URL goes through neither.
	describe('the permission gate', () => {
		it('refuses a non-moderator', async () => {
			const router = makeRouter()
			await router.push('/settings/users/new')
			const wrapper = await mountForm(router, outsider)

			expect(fields(wrapper).exists()).toBe(false)
			expect(save(wrapper).exists()).toBe(false)
			expect(toastMock.warning).toHaveBeenLastCalledWith(
				expect.stringContaining('You are not permitted to manage members.')
			)
		})

		it('refuses a signed-out visitor', async () => {
			const router = makeRouter()
			await router.push('/settings/users/new')
			const wrapper = await mountForm(router, null)

			expect(fields(wrapper).exists()).toBe(false)
			expect(save(wrapper).exists()).toBe(false)
		})

		it('shows the fields to a moderator', async () => {
			const router = makeRouter()
			await router.push('/settings/users/new')
			const wrapper = await mountForm(router)

			expect(fields(wrapper).exists()).toBe(true)
			expect(save(wrapper).exists()).toBe(true)
		})

		// A refused page must not go on to ask the server for the row either.
		it('does not fetch the member it refuses to show', async () => {
			const router = makeRouter()
			await router.push(`/settings/users/${MEMBER}`)
			await mountForm(router, outsider)

			expect(lookup.fetch).not.toHaveBeenCalled()
		})
	})

	// Cold deep link: nothing opened this form, so no settings surface is
	// mounted, there is no in-memory member row handed over from a click, and
	// there is no history entry of ours to pop.
	describe('a cold deep link', () => {
		it('stands the add form up with no settings page mounted', async () => {
			const router = makeRouter()
			await router.push('/settings/users/new')
			const wrapper = await mountForm(router)

			expect(fields(wrapper).exists()).toBe(true)
			// Add mode asks for nothing: there is no member to load yet.
			expect(lookup.fetch).not.toHaveBeenCalled()
			expect(wrapper.text()).toContain('New Member')
		})

		it('closes onto the account page it can reach by URL', async () => {
			// The You page: settings has no address at all now, and this is the
			// nearest surviving surface a phone can be dropped on.
			const router = makeRouter()
			await router.push('/settings/users/new')
			const wrapper = await mountForm(router)

			wrapper.findComponent({ name: 'Dialog' }).vm.$emit('update:open', false)
			await flushPromises()

			expect(router.currentRoute.value.name).toBe('MobileYou')
		})

		it('fetches the edit form its own row and seeds the switches', async () => {
			const router = makeRouter()
			await router.push(`/settings/users/${MEMBER}`)
			const wrapper = await mountForm(router)

			expect(lookup.fetch).toHaveBeenCalled()
			// get_member, not the get_members search: that one hides disabled users
			// and pages, so a member it happened not to return left this form with
			// Save disabled forever and nothing on screen explaining it.
			expect(createResourceMock.mock.calls[0][0].url).toBe(
				'lms.lms.api.get_member'
			)
			expect(createResourceMock.mock.calls[0][0].makeParams()).toEqual({
				member: MEMBER,
			})

			// Nothing has landed: saving now would diff against an all-off snapshot
			// and strip every role the member holds.
			expect(save(wrapper).attributes('disabled')).toBeDefined()

			lookup.data = { name: MEMBER, roles: ['LMS Student', 'Course Creator'] }
			await flushPromises()

			expect(save(wrapper).attributes('disabled')).toBeUndefined()
			expect(
				wrapper.find('[data-testid="role-Student"]').attributes('data-on')
			).toBe('true')
			expect(
				wrapper
					.find('[data-testid="role-Course Creator"]')
					.attributes('data-on')
			).toBe('true')
			expect(
				wrapper.find('[data-testid="role-Moderator"]').attributes('data-on')
			).toBe('false')
			// The email is the route param, not something the parent handed over.
			expect(
				(
					wrapper.find('[data-testid="field-Email"] input')
						.element as HTMLInputElement
				).value
			).toBe(MEMBER)
		})

		// The emits are gone with the modal, so the list is refreshed by bumping
		// a module-level signal. Deliberately NOT the parent's resource by cache
		// key: Members.vue's resource closes over component-local refs, and
		// frappe-ui hands back the first instance for a cache key without
		// rebinding them, so a remounted panel would render empty forever.
		it('announces the change even with no settings surface mounted', async () => {
			const router = makeRouter()
			await router.push('/settings/users/new')
			const wrapper = await mountForm(router)
			callMock.mockResolvedValue({ name: MEMBER })

			await wrapper
				.find('[data-testid="field-Email"] input')
				.setValue('  jane@doe.com  ')
			await wrapper.find('[data-testid="role-Student"]').trigger('click')
			await save(wrapper).trigger('click')
			await flushPromises()

			expect(callMock).toHaveBeenCalledWith('lms.lms.api.add_member', {
				email: MEMBER,
				first_name: undefined,
				last_name: undefined,
			})
			expect(callMock).toHaveBeenCalledWith('lms.lms.api.save_role', {
				user: MEMBER,
				role: 'LMS Student',
				value: 1,
			})
			expect(toastMock.success).toHaveBeenCalled()
			expect(router.currentRoute.value.name).toBe('MobileYou')
		})

		it('bumps the signal a mounted list watches', async () => {
			const before = membersRevision.value
			const router = makeRouter()
			await router.push('/settings/users/new')
			const wrapper = await mountForm(router)
			callMock.mockResolvedValue({ name: MEMBER })

			await wrapper.find('[data-testid="field-Email"] input').setValue(MEMBER)
			await save(wrapper).trigger('click')
			await flushPromises()

			expect(membersRevision.value).toBeGreaterThan(before)
		})
	})

	// Opened from Members.vue instead. On desktop the settings dialog is still
	// floating above whatever page the URL points at, so closing has to pop back
	// to that page rather than replace it with the phone settings screen.
	it('pops back to where it was opened from', async () => {
		const router = makeRouter()
		await router.push('/')
		await openFormRoute(router, {
			name: 'MemberForm',
			params: { memberID: 'new' },
		})
		const wrapper = await mountForm(router)

		wrapper.findComponent({ name: 'Dialog' }).vm.$emit('update:open', false)
		await flushPromises()

		expect(router.currentRoute.value.name).toBe('Home')
	})

	// Edit mode only writes the roles that changed, exactly as the modal did.
	it('saves only the roles the edit actually toggled', async () => {
		const router = makeRouter()
		await router.push(`/settings/users/${MEMBER}`)
		const wrapper = await mountForm(router)

		lookup.data = { name: MEMBER, roles: ['LMS Student'] }
		await flushPromises()

		await wrapper.find('[data-testid="role-Moderator"]').trigger('click')
		callMock.mockResolvedValue(true)
		await save(wrapper).trigger('click')
		await flushPromises()

		expect(callMock).toHaveBeenCalledTimes(1)
		expect(callMock).toHaveBeenCalledWith('lms.lms.api.save_role', {
			user: MEMBER,
			role: 'Moderator',
			value: 1,
		})
	})
})
