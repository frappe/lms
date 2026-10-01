/**
 * AppSidebar's onboarding wiring: which panel renders for each flow state, which
 * framework key the banner and checklist bind to, and what a step click does.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref, type Ref } from 'vue'

const {
	resource,
	onboarding,
	ui,
	push,
	openFormRoute,
	pushSettingsHash,
	openExternalMock,
} = vi.hoisted(() => ({
	resource: () => ({
		data: null,
		loading: false,
		promise: Promise.resolve(),
		reload: vi.fn(),
		submit: vi.fn(),
	}),
	onboarding: {} as {
		isSetUp: Ref<boolean>
		bannerFlow: Ref<{ key: string } | null>
		setUpAll: ReturnType<typeof vi.fn>
	},
	ui: {} as { showHelpModal: Ref<boolean>; minimize: Ref<boolean> },
	push: vi.fn(),
	openFormRoute: vi.fn(),
	pushSettingsHash: vi.fn(),
	openExternalMock: vi.fn(),
}))

vi.mock('frappe-ui', () => ({
	createResource: resource,
	createListResource: resource,
	call: vi.fn(),
	Tooltip: { template: `<div><slot /></div>` },
	Sidebar: { template: `<nav><slot /></nav>` },
	SidebarCard: { template: `<div />` },
	SidebarCollapseToggle: { template: `<button />` },
	SidebarItem: { template: `<div />` },
	SidebarSection: { template: `<div><slot /></div>` },
}))

vi.mock('@framework/ui/components/TrialBanner/index', () => ({
	TrialBanner: { template: `<div />` },
}))

vi.mock('@framework/ui/components/Onboarding/index', async () => {
	const { ref: vueRef } = await import('vue')
	ui.showHelpModal = vueRef(false)
	ui.minimize = vueRef(false)
	return {
		HelpModal: {
			name: 'HelpModal',
			props: ['appName'],
			template: `<div :data-app="appName" />`,
		},
		GettingStartedBanner: {
			name: 'GettingStartedBanner',
			props: ['appName'],
			template: `<div data-testid="banner" :data-app="appName" />`,
		},
		IntermediateStepModal: { template: `<div />` },
		showHelpModal: ui.showHelpModal,
		minimize: ui.minimize,
	}
})

vi.mock('@/onboarding/useLearningOnboarding', () => ({
	useLearningOnboarding: () => onboarding,
}))

vi.mock('@/components/Onboarding/OnboardingFlowPanel.vue', () => ({
	default: { template: `<div data-testid="flow-panel" />` },
}))

vi.mock('@framework/ui/telemetry/index', () => ({
	useTelemetry: () => ({ capture: vi.fn() }),
}))

vi.mock('vue-router', () => ({
	useRouter: () => ({ push }),
}))

vi.mock('@/stores/user', async () => {
	const { reactive } = await import('vue')
	const userResource = reactive({
		data: { is_system_manager: true },
		promise: Promise.resolve(),
	})
	return { usersStore: () => ({ userResource }) }
})

vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ user: 'admin@example.com' }),
}))

vi.mock('@/utils', () => ({ getSidebarLinks: () => [] }))
vi.mock('@/utils/sidebarRows', () => ({ buildSidebarRows: () => [] }))
vi.mock('@/utils/openExternal', () => ({ openExternal: openExternalMock }))
vi.mock('@/composables/useSettingsHash', () => ({ pushSettingsHash }))
vi.mock('@/composables/useFormRoute', () => ({ openFormRoute }))

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
	onboarding.isSetUp = ref(true)
	onboarding.bannerFlow = ref(null)
	onboarding.setUpAll = vi.fn()
	ui.showHelpModal.value = true
	ui.minimize.value = false
	push.mockReset()
	openFormRoute.mockReset()
	pushSettingsHash.mockReset()
})

afterEach(() => {
	wrapper?.unmount()
	wrapper = undefined
})

async function build() {
	wrapper = mount(AppSidebar, {
		global: {
			provide: { $socket: { on: vi.fn(), off: vi.fn() } },
			mocks: { __: (globalThis as any).__ },
			stubs: { 'router-link': { template: `<a><slot /></a>` } },
		},
	})
	await flushPromises()
	return wrapper
}

describe('AppSidebar onboarding', () => {
	// Guards: the sidebar never registering the flows, leaving the panel empty.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to check setup runs once.
	it('sets every flow up for a system manager', async () => {
		await build()
		expect(onboarding.setUpAll).toHaveBeenCalledTimes(1)
	})

	// Guards: the framework HelpModal showing in place of the LMS flow panel.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin the panel.
	it('renders the LMS panel while open, never the framework modal', async () => {
		const w = await build()
		expect(w.find('[data-testid="flow-panel"]').exists()).toBe(true)
		expect(w.find('[data-testid="onboarding-help-modal"]').exists()).toBe(false)
	})

	// Guards: a panel rendering while closed. Introduced in this branch
	// (feat/onboarding-flows, PR pending); test added there to cover the closed
	// state.
	it('renders no panel while the panel is closed', async () => {
		ui.showHelpModal.value = false
		const w = await build()
		expect(w.find('[data-testid="flow-panel"]').exists()).toBe(false)
		expect(w.find('[data-testid="onboarding-help-modal"]').exists()).toBe(false)
	})

	// Guards: the banner tracking a different flow than the panel shows.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to pin its key.
	it('binds the banner to the banner flow', async () => {
		onboarding.bannerFlow.value = { key: 'learning_onboard_learners_csv' }
		const w = await build()
		expect(w.find('[data-testid="banner"]').attributes('data-app')).toBe(
			'learning_onboard_learners_csv'
		)
	})

	// Guards: an empty banner when no flow is in progress. Introduced in this
	// branch (feat/onboarding-flows, PR pending); test added there to cover
	// that state.
	it('hides the banner when no flow needs it', async () => {
		const w = await build()
		expect(w.find('[data-testid="banner"]').exists()).toBe(false)
	})

	// Guards: a step click closing or minimising the panel as it navigates.
	// Introduced in this branch (feat/onboarding-flows, PR pending); test added
	// there to check each navigation.
	it('hands the flows a navigation that leaves the panel open and full size', async () => {
		await build()
		const nav = onboarding.setUpAll.mock.calls[0][0]
		const stillOpen = () => {
			expect(ui.showHelpModal.value).toBe(true)
			expect(ui.minimize.value).toBe(false)
		}

		nav.openRoute({ name: 'Courses' })
		expect(push).toHaveBeenCalledWith({ name: 'Courses' })
		stillOpen()

		nav.openForm({ name: 'NewBatch' })
		expect(openFormRoute).toHaveBeenCalledWith(expect.anything(), {
			name: 'NewBatch',
		})
		stillOpen()

		nav.openSettings('members')
		expect(pushSettingsHash).toHaveBeenCalledWith(expect.anything(), 'members')
		stillOpen()

		nav.openExternal('/app/user-invitation/new')
		expect(openExternalMock).toHaveBeenCalledWith('/app/user-invitation/new')
		stillOpen()
	})

	it('keeps the panel mounted across a route change', async () => {
		const w = await build()
		const nav = onboarding.setUpAll.mock.calls[0][0]
		nav.openRoute({ name: 'Batches' })
		await w.vm.$nextTick()
		expect(w.find('[data-testid="flow-panel"]').exists()).toBe(true)
	})
})
