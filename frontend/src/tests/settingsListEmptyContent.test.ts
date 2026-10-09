/**
 * SettingsListPanel's own half of `ListPage.emptyContent`: a `pick` fired by
 * the empty-state component reaches the create form as a hint on the create
 * id ('new:<hint>'), the same channel a docname already travels by. SettingsList
 * is stubbed here -- its own contract (drawing `emptyContent` instead of the
 * caption, translating a `pick` into `new`) is settingsList.test.ts's job.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { ListPage } from '@/types/settingsSchema'

vi.mock('frappe-ui', () => ({
	Alert: { template: `<div />` },
	Select: { template: `<div />` },
	createResource: () => ({ data: null, loading: false }),
}))

vi.mock('@/composables/useDirtyGuard', () => ({ useDirtyGuard: vi.fn() }))

vi.mock(
	'@/components/Layouts/settings/desktop/SettingsFieldsPanel.vue',
	() => ({
		default: { template: `<div data-testid="fields-panel" />` },
	})
)

// A stand-in for the real component: it exposes the same `new`/`rowClick`
// contract the panel drives, nothing about how SettingsList itself renders.
vi.mock('@/components/Layouts/settings/desktop/SettingsList.vue', () => ({
	default: {
		props: ['title', 'columns', 'rows', 'emptyContent'],
		emits: ['new', 'rowClick', 'loadMore'],
		template: `<div data-testid="list">
			<button data-testid="new" @click="$emit('new')" />
			<button data-testid="new-with-hint" @click="$emit('new', 'GMail')" />
		</div>`,
	},
}))

let rows: Record<string, unknown>[] = []

vi.mock('@/composables/useSettingsListResource', () => ({
	useSettingsListResource: () => ({
		resource: {},
		search: '',
		rows,
		loading: false,
		hasNextPage: false,
		loadMore: vi.fn(),
		reload: vi.fn(),
		applyFilters: vi.fn(),
		remove: vi.fn(),
	}),
	useSettingsMethodResource: () => ({
		resource: {},
		search: '',
		rows,
		loading: false,
		hasNextPage: false,
		loadMore: vi.fn(),
		reload: vi.fn(),
		applyFilters: vi.fn(),
		remove: vi.fn(),
	}),
}))

vi.stubGlobal('__', (text: string) => text)
;(String.prototype as any).format ??= function (...args: string[]) {
	return args.reduce((out, arg, i) => out.replace(`{${i}}`, arg), String(this))
}

import SettingsListPanel from '@/components/Layouts/settings/desktop/SettingsListPanel.vue'
import SettingsList from '@/components/Layouts/settings/desktop/SettingsList.vue'

const CreateDetail = {
	props: ['name'],
	template: `<div data-testid="create-detail" :data-name="name" />`,
}

const EmptyPicker = { template: `<div data-testid="empty-picker" />` }

const page: ListPage = {
	kind: 'list',
	resource: { doctype: 'Widget', fields: ['name'] },
	columns: [
		{ key: 'name', label: 'Name', type: 'text', value: (row) => row.name },
	],
	empty: { name: 'Widgets' },
	emptyContent: { component: EmptyPicker },
	create: { detail: { kind: 'custom', component: CreateDetail } },
}

const mountPage = () =>
	mount(SettingsListPanel, {
		props: { page, title: 'Widgets' },
		global: { mocks: { __: (text: string) => text } },
	})

describe("SettingsListPanel's create-with-hint routing", () => {
	it('opens a bare create form for a plain New click', async () => {
		rows = []
		const wrapper = mountPage()

		await wrapper.get('[data-testid="new"]').trigger('click')

		expect(
			wrapper.get('[data-testid="create-detail"]').attributes('data-name')
		).toBe('new')
	})

	it('carries a picked value into the create id as a hint SettingsListPanel resolves to `create.detail`', async () => {
		rows = []
		const wrapper = mountPage()

		await wrapper.get('[data-testid="new-with-hint"]').trigger('click')

		const detail = wrapper.get('[data-testid="create-detail"]')
		expect(detail.attributes('data-name')).toBe('new:GMail')
	})

	it('forwards `page.emptyContent` down to SettingsList unchanged', () => {
		rows = []
		const wrapper = mountPage()

		expect(wrapper.getComponent(SettingsList).props('emptyContent')).toEqual(
			page.emptyContent
		)
	})
})
