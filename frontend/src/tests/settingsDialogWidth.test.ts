/**
 * The settings dialog's content column must not grow with its content.
 *
 * frappe-ui's SettingsContent and SettingsPanel are flex items in a row, so
 * without `min-w-0` they take their content's widest line as their minimum.
 * A long line in Email Template's code editor then pushed the panel, its
 * fields and the header Save past the dialog's clipped right edge. jsdom
 * computes no layout, so this pins the declaration that prevents it.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const { slot } = vi.hoisted(() => ({
	slot: (testid: string) => ({
		template: `<div data-testid="${testid}"><slot /></div>`,
	}),
}))

vi.mock('frappe-ui', () => ({
	Button: { template: `<button />` },
	Dialog: { Close: { template: `<div><slot /></div>` } },
	SettingsDialog: slot('dialog'),
	SettingsSidebar: slot('sidebar'),
	SettingsNavGroup: slot('nav-group'),
	SettingsNavItem: slot('nav-item'),
	SettingsContent: slot('content'),
	SettingsPanel: slot('panel'),
	createDocumentResource: () => ({ doc: null }),
}))

vi.mock('vue-router', () => ({ useRouter: () => ({}) }))
vi.mock('@/stores/settings', () => ({ useSettings: () => ({}) }))
vi.mock('@/composables/useDirtyGuard', () => ({
	confirmDiscard: vi.fn(),
	installDirtyGuard: () => () => {},
}))
vi.mock('@/components/Settings/DiscardChangesDialog.vue', () => ({
	default: { template: `<div />` },
}))
vi.mock(
	'@/components/Layouts/settings/desktop/SettingsFieldsPanel.vue',
	() => ({
		default: { template: `<div />` },
	})
)
vi.mock('@/components/Layouts/settings/desktop/SettingsListPanel.vue', () => ({
	default: { template: `<div />` },
}))
vi.mock('@/components/Settings/settings', () => ({ settingsTree: [] }))
vi.mock('@/composables/useSettingsHash', async () => {
	const { ref } = await import('vue')
	return {
		useSettingsHash: () => ({
			items: ref([
				{
					slug: 'email-template',
					label: 'Email Template',
					page: { kind: 'list' },
				},
			]),
			isOpen: ref(true),
			activeTab: ref(null),
			activeRecord: ref(null),
			selectTab: vi.fn(),
			selectRecord: vi.fn(),
			replaceRecord: vi.fn(),
			close: vi.fn(),
		}),
	}
})

import Settings from '@/components/Settings/Settings.vue'

describe('Settings dialog width', () => {
	it('lets the content column and each panel shrink below their content', () => {
		const wrapper = mount(Settings, {
			global: { mocks: { __: (text: string) => text } },
		})

		// Control: the sidebar is a fixed-width column and is left alone.
		expect(wrapper.get('[data-testid="sidebar"]').classes()).not.toContain(
			'min-w-0'
		)
		expect(wrapper.get('[data-testid="content"]').classes()).toContain(
			'min-w-0'
		)
		expect(wrapper.get('[data-testid="panel"]').classes()).toContain('min-w-0')
	})
})
