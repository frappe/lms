/**
 * Settings > Raven must not call into raven_integration to find out whether
 * raven_integration is installed. Frappe answers a method of an uninstalled app
 * with AppNotInstalledError (HTTP 417), and frappe-ui logs the whole server
 * traceback and rethrows before any `onError` can matter: an uncatchable console
 * dump plus an unhandled rejection every time the panel opens. LMS answers the
 * install question instead (lms.raven_provider.get_raven_setup).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import RavenSettings from '@/components/Settings/Raven/RavenSettings.vue'
import type { RavenSetupState } from '@/types'

const LMS_SETUP = 'lms.raven_provider.get_raven_setup'

const state = vi.hoisted(() => ({
	setup: null as RavenSetupState | null,
	requested: [] as string[],
}))

vi.mock('frappe-ui', () => ({
	// Close enough to the real resource for the gate: `auto` fetches on creation,
	// and every fetch/reload is recorded.
	createResource: (options: { url: string; auto?: boolean }) => {
		const resource = {
			url: options.url,
			data: null as RavenSetupState | null,
			loading: false,
			fetched: false,
			fetch() {
				state.requested.push(options.url)
				resource.fetched = true
				if (options.url === LMS_SETUP) resource.data = state.setup
			},
			reload() {
				resource.fetch()
			},
			submit() {},
		}
		if (options.auto) resource.fetch()
		return resource
	},
	Button: {
		props: ['variant', 'loading'],
		emits: ['click'],
		template: `<button @click="$emit('click')"><slot name="prefix" /><slot /></button>`,
	},
	toast: { error: vi.fn() },
}))

vi.mock('@/components/Layouts/SettingsLayout.vue', () => ({
	default: {
		name: 'SettingsLayout',
		props: ['title', 'description'],
		template: `<div class="settings-layout"><slot name="header-actions" /><slot /></div>`,
	},
}))

vi.mock('@/components/Settings/Raven/RavenNotInstalledBanner.vue', () => ({
	default: {
		name: 'RavenNotInstalledBanner',
		props: ['missing'],
		template: `<div data-testid="not-installed">{{ missing }}</div>`,
	},
}))

vi.mock('@/components/Settings/Raven/WorkspaceList.vue', () => ({
	default: {
		name: 'WorkspaceList',
		template: `<div data-testid="workspace-list" />`,
	},
}))

vi.mock('@/components/Settings/Raven/ChannelsView.vue', () => ({
	default: { name: 'ChannelsView', template: `<div class="channels-view" />` },
}))

vi.stubGlobal('__', (s: string) => s)

function mountPanel() {
	return mount(RavenSettings, {
		props: { label: 'Raven', description: 'Sync membership' },
		global: { mocks: { __: (s: string) => s } },
	})
}

beforeEach(() => {
	state.requested = []
	state.setup = null
})

describe('Settings > Raven setup gate', () => {
	it('asks LMS for the setup state, never the app that may be missing', () => {
		state.setup = { raven: false, raven_integration: false, enabled: false }

		mountPanel()

		expect(state.requested).toEqual([LMS_SETUP])
		expect(
			state.requested.some((url) => url.startsWith('raven_integration.'))
		).toBe(false)
	})

	it('reports raven_integration as missing without calling it', () => {
		state.setup = { raven: true, raven_integration: false, enabled: false }

		const wrapper = mountPanel()

		expect(wrapper.get('[data-testid="not-installed"]').text()).toBe(
			'raven_integration'
		)
	})

	it('reports Raven itself as missing', () => {
		state.setup = { raven: false, raven_integration: true, enabled: false }

		const wrapper = mountPanel()

		expect(wrapper.get('[data-testid="not-installed"]').text()).toBe('raven')
	})

	it('manages workspaces once both apps are installed and enabled', () => {
		state.setup = { raven: true, raven_integration: true, enabled: true }

		const wrapper = mountPanel()

		expect(wrapper.find('[data-testid="not-installed"]').exists()).toBe(false)
		expect(wrapper.find('[data-testid="workspace-list"]').exists()).toBe(true)
	})
})
