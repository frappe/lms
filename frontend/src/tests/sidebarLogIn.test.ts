/**
 * A visitor could only log in from the logo menu, which few found. The
 * sidebar now shows them a Log in card.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const { resource } = vi.hoisted(() => ({
	resource: () => ({
		data: null,
		loading: false,
		promise: Promise.resolve(),
		reload: vi.fn(),
		submit: vi.fn(),
	}),
}))

vi.mock('frappe-ui', () => ({
	createResource: resource,
	createListResource: resource,
	ScrollArea: { template: `<div><slot /></div>` },
	call: vi.fn(),
	Tooltip: { template: `<div><slot /></div>` },
	Sidebar: { template: `<nav><slot /></nav>` },
	SidebarCard: {
		props: ['title', 'action'],
		template: `<button @click="action.onClick()">{{ title }}</button>`,
	},
	SidebarCollapseToggle: { template: `<button />` },
	SidebarItem: { template: `<div />` },
	SidebarSection: { template: `<div><slot /></div>` },
}))

vi.mock('@framework/ui/components/TrialBanner/index', () => ({
	TrialBanner: { template: `<div />` },
}))

vi.mock('@framework/ui/components/Onboarding/index', () => ({
	HelpModal: { template: `<div />` },
	GettingStartedBanner: { template: `<div />` },
	IntermediateStepModal: { template: `<div />` },
	useOnboarding: () => ({
		setUp: vi.fn(),
		isOnboardingStepsCompleted: false,
	}),
	showHelpModal: { value: false },
	minimize: { value: false },
}))

vi.mock('@framework/ui/telemetry/index', () => ({
	useTelemetry: () => ({ capture: vi.fn() }),
}))

vi.mock('vue-router', () => ({
	useRouter: () => ({ push: vi.fn() }),
}))

const { session } = vi.hoisted(() => ({ session: { loggedIn: false } }))
vi.mock('@/stores/session', async () => {
	const { ref } = await import('vue')
	return { sessionStore: () => ({ isLoggedIn: ref(session.loggedIn) }) }
})

vi.mock('@/utils', () => ({ getSidebarLinks: () => [] }))
vi.mock('@/utils/sidebarRows', () => ({ buildSidebarRows: () => [] }))
vi.mock('@/utils/openExternal', () => ({ openExternal: vi.fn() }))
vi.mock('@/composables/useSettingsHash', () => ({ pushSettingsHash: vi.fn() }))
vi.mock('@/composables/useFormRoute', () => ({ openFormRoute: vi.fn() }))

vi.mock('@/components/Icons/InviteIcon.vue', () => ({
	default: { template: `<div />` },
}))
vi.mock('@/components/Icons/LMSLogo.vue', () => ({
	default: { template: `<div />` },
}))
vi.mock('@/components/Sidebar/UserDropdown.vue', () => ({
	default: { template: `<div />` },
}))
vi.mock('@/components/Sidebar/SidebarLink.vue', () => ({
	default: { template: `<div />` },
}))
vi.mock('@/components/CommandPalette/CommandPalette.vue', () => ({
	default: { props: ['modelValue'], template: `<div />` },
}))

vi.stubGlobal('__', (message: string) => message)

import AppSidebar from '@/components/Sidebar/AppSidebar.vue'

let wrapper: VueWrapper | undefined

beforeEach(() => {
	setActivePinia(createPinia())
	window.history.replaceState({}, '', '/lms/courses?category=design')
})

afterEach(() => {
	wrapper?.unmount()
	wrapper = undefined
})

function build() {
	wrapper = mount(AppSidebar, {
		global: {
			provide: { $socket: { on: vi.fn(), off: vi.fn() } },
			mocks: { __: (globalThis as any).__ },
			stubs: { 'router-link': { template: `<a><slot /></a>` } },
		},
	})
	return wrapper
}

describe('logging in from the sidebar', () => {
	it('shows a visitor a Log in card that returns them to this page', async () => {
		session.loggedIn = false
		const assign = vi.fn()
		vi.stubGlobal('location', {
			...window.location,
			pathname: '/lms/courses',
			search: '?category=design',
			set href(value: string) {
				assign(value)
			},
		})
		const card = build().get('[data-testid="sidebar-log-in"]')
		await card.trigger('click')
		expect(assign).toHaveBeenCalledWith(
			'/login?redirect-to=%2Flms%2Fcourses%3Fcategory%3Ddesign'
		)
		vi.unstubAllGlobals()
		vi.stubGlobal('__', (message: string) => message)
	})

	it('shows no Log in card to a signed-in user', () => {
		session.loggedIn = true
		expect(build().find('[data-testid="sidebar-log-in"]').exists()).toBe(false)
	})
})
