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
	createDocumentResource: () => ({ doc: {} }),
}))

vi.mock('@/stores/settings', () => ({ useSettings: () => ({}) }))
vi.mock('@/components/Settings/SettingDetails.vue', () => ({
	default: { template: `<div />` },
}))
vi.mock('@/components/Settings/settingsStructure.js', () => ({
	settingsStructure: [
		{
			label: 'Configuration',
			items: [
				{
					label: 'Email Template',
					template: { template: `<div />` },
				},
			],
		},
	],
}))

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
