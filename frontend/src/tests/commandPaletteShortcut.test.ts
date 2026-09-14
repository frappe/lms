/**
 * Held Ctrl/⌘+K auto-repeats the keydown. Each repeat used to re-toggle the
 * palette, so a held shortcut opened it then closed it before key-up.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
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
	call: vi.fn(),
	Button: { template: `<button><slot /></button>` },
	Tooltip: { template: `<div><slot /></div>` },
}))

vi.mock('frappe-ui/frappe', () => ({
	TrialBanner: { template: `<div />` },
	HelpModal: { template: `<div />` },
	GettingStartedBanner: { template: `<div />` },
	IntermediateStepModal: { template: `<div />` },
	useOnboarding: () => ({
		setUp: vi.fn(),
		isOnboardingStepsCompleted: false,
	}),
	showHelpModal: { value: false },
	minimize: { value: false },
	useTelemetry: () => ({ capture: vi.fn() }),
}))

vi.mock('vue-router', () => ({
	useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ user: 'raiza@example.com' }),
}))

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
vi.mock('@/components/Icons/CollapseSidebar.vue', () => ({
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

import { useSettings } from '@/stores/settings'
import AppSidebar from '@/components/Sidebar/AppSidebar.vue'

function press(init: KeyboardEventInit = {}) {
	document.body.dispatchEvent(
		new KeyboardEvent('keydown', {
			key: 'k',
			ctrlKey: true,
			bubbles: true,
			cancelable: true,
			...init,
		}),
	)
}

beforeEach(() => {
	setActivePinia(createPinia())
})

function build() {
	return mount(AppSidebar, {
		global: {
			provide: { $socket: { on: vi.fn(), off: vi.fn() } },
			mocks: { __: (globalThis as any).__ },
			stubs: { 'router-link': { template: `<a><slot /></a>` } },
		},
	})
}

describe('the command palette shortcut', () => {
	it('opens on Ctrl+K', () => {
		build()
		const settings = useSettings()

		press()

		expect(settings.isCommandPaletteOpen).toBe(true)
	})

	it('ignores an autorepeat keydown from a held Ctrl+K', () => {
		build()
		const settings = useSettings()

		press()
		press({ repeat: true })

		expect(settings.isCommandPaletteOpen).toBe(true)
	})
})
