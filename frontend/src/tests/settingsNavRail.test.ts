/**
 * The Settings nav folds to an icon rail in a narrow dialog, whose tooltips
 * open beside the icon, and never on a phone, where the nav sits on top.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, nextTick, ref } from 'vue'

const { slot } = vi.hoisted(() => ({
	slot: (name: string) => ({
		name,
		template: '<div><slot /><slot name="label" /><slot name="prefix" /></div>',
	}),
}))

vi.mock('frappe-ui', () => ({
	Button: slot('Button'),
	Dialog: { Close: slot('DialogClose') },
	SettingsContent: slot('SettingsContent'),
	SettingsDialog: slot('SettingsDialog'),
	SettingsNavGroup: slot('SettingsNavGroup'),
	SettingsNavItem: slot('SettingsNavItem'),
	SettingsPanel: slot('SettingsPanel'),
	SettingsSidebar: {
		name: 'SettingsSidebar',
		template: '<nav><slot /></nav>',
	},
	Tooltip: {
		name: 'Tooltip',
		props: ['text', 'side', 'disabled'],
		template: '<div><slot /></div>',
	},
	createDocumentResource: () => ({ doc: null }),
}))

vi.mock('@vueuse/core', async () => {
	const { ref } = await import('vue')
	return { useElementSize: () => ({ width: ref(700) }) }
})

vi.mock('vue-router', () => ({ useRouter: () => ({}) }))
vi.mock('@/stores/settings', () => ({ useSettings: () => ({}) }))
vi.mock('@/composables/useDirtyGuard', () => ({
	confirmDiscard: vi.fn(),
	installDirtyGuard: () => () => {},
}))
vi.mock('@/components/Settings/DiscardChangesDialog.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock(
	'@/components/Layouts/settings/desktop/SettingsFieldsPanel.vue',
	() => ({
		default: { template: '<div />' },
	})
)
vi.mock('@/components/Layouts/settings/desktop/SettingsListPanel.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/Settings/settings', () => ({
	isGroupVisible: () => true,
	settingsTree: [
		{
			label: 'General',
			items: [
				{
					label: 'Branding',
					slug: 'branding',
					icon: 'lucide-palette',
					page: { kind: 'custom', component: { template: '<div />' } },
				},
			],
		},
	],
}))
vi.mock('@/composables/useSettingsHash', () => ({
	useSettingsHash: (tabs: { value: { items: unknown[] }[] }) => ({
		items: computed(() => tabs.value.flatMap((tab) => tab.items)),
		isOpen: ref(true),
		activeTab: ref(null),
		activeRecord: ref(null),
		selectTab: vi.fn(),
		selectRecord: vi.fn(),
		replaceRecord: vi.fn(),
		close: vi.fn(),
	}),
}))

import Settings from '@/components/Settings/Settings.vue'

const setWindowWidth = (width: number) => {
	Object.defineProperty(window, 'innerWidth', {
		configurable: true,
		value: width,
	})
	window.dispatchEvent(new Event('resize'))
}

const mountSettings = () =>
	mount(Settings, { global: { mocks: { __: (text: string) => text } } })

afterEach(() => {
	setWindowWidth(1024)
	document.documentElement.dir = ''
})

describe('Settings nav rail', () => {
	it('opens the rail tooltips at the end of the line', () => {
		setWindowWidth(1200)
		const tooltip = mountSettings().findComponent({ name: 'Tooltip' })

		expect(tooltip.props('disabled')).toBe(false)
		expect(tooltip.props('side')).toBe('right')
	})

	it('opens them on the left in a right-to-left page', () => {
		document.documentElement.dir = 'rtl'
		setWindowWidth(1200)
		const tooltip = mountSettings().findComponent({ name: 'Tooltip' })

		expect(tooltip.props('side')).toBe('left')
	})

	it('unfolds the rail when the window narrows to a phone', async () => {
		setWindowWidth(1200)
		const wrapper = mountSettings()
		expect(wrapper.find('nav').classes()).toContain('lms-settings-nav-rail')

		setWindowWidth(500)
		await nextTick()

		expect(wrapper.find('nav').classes()).not.toContain('lms-settings-nav-rail')
		expect(wrapper.findComponent({ name: 'Tooltip' }).props('disabled')).toBe(
			true
		)
	})
})
