/**
 * SettingsList: the one layout behind every settings panel.
 *
 * A panel declares columns and never writes cell markup, so what has to hold
 * here is that each column type reads its row through its own accessors, that
 * the cells a user operates do not also open the row, and that an empty result
 * says something different when a search caused it.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { SettingsListColumn } from '@/types'

vi.mock('frappe-ui', () => ({
	Avatar: {
		props: ['image', 'label'],
		template: `<span data-testid="avatar" :data-label="label" />`,
	},
	Badge: {
		props: ['theme'],
		template: `<span data-testid="badge" :data-theme="theme"><slot /></span>`,
	},
	Button: {
		emits: ['click'],
		template: `<button data-testid="button" @click="$emit('click')"><slot name="prefix" /><slot /></button>`,
	},
	Dropdown: {
		props: ['options'],
		template: `<div data-testid="dropdown"><button v-for="o in options" :key="o.label" :data-testid="'opt-' + o.label" @click="o.onClick()">{{ o.label }}</button></div>`,
	},
	FormControl: {
		props: ['modelValue'],
		template: `<input data-testid="search" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
	},
	LoadingIndicator: { template: `<span data-testid="spinner" />` },
	Switch: {
		props: ['modelValue', 'ariaLabel'],
		template: `<button data-testid="switch" :aria-label="ariaLabel" @click="$emit('update:modelValue', !modelValue)" />`,
	},
}))

vi.mock('frappe-ui/list', () => ({
	List: { template: `<div data-testid="list" v-bind="$attrs"><slot /></div>` },
	ListHeader: { template: `<div data-testid="header"><slot /></div>` },
	ListHeaderCell: {
		template: `<div data-testid="header-cell"><slot /></div>`,
	},
	ListRows: {
		props: ['items', 'rowKey'],
		template: `<div><template v-for="item in items" :key="item.name"><slot :item="item" /></template></div>`,
	},
	ListRow: {
		template: `<div data-testid="row" @click="$emit('click')"><slot /></div>`,
	},
	ListCell: { template: `<div data-testid="cell"><slot /></div>` },
}))

vi.mock('@/components/Layouts/SettingsLayout.vue', () => ({
	default: {
		props: ['title', 'description', 'showBack'],
		template: `<div><div data-testid="title">{{ title }}</div><slot name="header-actions" /><slot name="header-bottom" /><slot /></div>`,
	},
}))

vi.mock('@/components/Layouts/EmptyStateLayout.vue', () => ({
	default: {
		props: ['name', 'title', 'description', 'icon'],
		template: `<div data-testid="empty" :data-title="title">{{ description }}</div>`,
	},
}))

const translate = (text: string) => text

vi.stubGlobal('__', translate)

// frappe patches String.prototype.format, which is what `__('{0}').format(x)`
// relies on at every call site.
;(String.prototype as any).format ??= function (...args: string[]) {
	return args.reduce((out, arg, i) => out.replace(`{${i}}`, arg), String(this))
}

import SettingsList from '@/components/Layouts/SettingsList.vue'

const toggled: any[] = []

const columns: SettingsListColumn[] = [
	{
		key: 'account',
		label: 'Account',
		type: 'stacked',
		primary: (row) => row.account_name,
		secondary: (row) => row.account_id,
		avatar: (row) => ({ image: row.image, label: row.account_name }),
	},
	{
		key: 'amount',
		label: 'Amount',
		type: 'text',
		value: (row) => row.amount,
	},
	{
		key: 'status',
		label: 'Status',
		type: 'badge',
		badges: (row) => [{ label: row.status, theme: 'green' }],
	},
	{
		key: 'enabled',
		label: 'Enabled',
		type: 'switch',
		checked: (row) => Boolean(row.enabled),
		ariaLabel: (row) => `Enable ${row.account_name}`,
		onChange: (row, value) => toggled.push([row.name, value]),
	},
	{
		key: 'actions',
		type: 'actions',
		options: (row) => [
			{ label: 'Delete', onClick: () => toggled.push(row.name) },
		],
	},
]

const ROW = {
	name: 'zoom-1',
	account_name: 'Marketing',
	account_id: 'acc-9',
	image: '/m.png',
	amount: '$ 40',
	status: 'Paid',
	enabled: 1,
}

const build = (props: Record<string, any> = {}) =>
	mount(SettingsList, {
		props: { title: 'Zoom', columns, rows: [ROW], ...props },
		global: { mocks: { __: translate } },
	})

describe('SettingsList', () => {
	it('reads every cell through the column it was declared on', () => {
		const wrapper = build()
		const text = wrapper.text()

		expect(text).toContain('Marketing')
		expect(text).toContain('acc-9')
		expect(text).toContain('$ 40')
		expect(wrapper.get('[data-testid="badge"]').attributes('data-theme')).toBe(
			'green'
		)
		expect(wrapper.get('[data-testid="avatar"]').attributes('data-label')).toBe(
			'Marketing'
		)
		expect(wrapper.get('[data-testid="switch"]').attributes('aria-label')).toBe(
			'Enable Marketing'
		)
	})

	it('drops the second line when a stacked column has no secondary', () => {
		const oneLine = [{ ...columns[0], secondary: undefined }, columns[4]]
		const wrapper = mount(SettingsList, {
			props: { title: 'Zoom', columns: oneLine, rows: [ROW] },
			global: { mocks: { __: translate } },
		})

		expect(wrapper.text()).toContain('Marketing')
		expect(wrapper.text()).not.toContain('acc-9')
	})

	it('gives the header a cell per column', () => {
		expect(build().findAll('[data-testid="header-cell"]')).toHaveLength(5)
	})

	it('puts the header labels on the paragraph scale', () => {
		// ListHeader sets text-sm (13px/1.15) on the row and the cells inherit
		// it. text-p-sm is the same 13px at 1.5, set on the cell itself so it
		// beats inheritance whatever order the two utilities land in.
		for (const cell of build().findAll('[data-testid="header-cell"]')) {
			expect(cell.classes()).toContain('text-p-sm')
		}
	})

	it('opens the row on click', async () => {
		const wrapper = build()

		await wrapper.get('[data-testid="row"]').trigger('click')

		expect(wrapper.emitted('rowClick')?.[0]).toEqual([ROW])
	})

	it('does not open the row from the switch or the menu', async () => {
		const wrapper = build()

		await wrapper.get('[data-testid="switch"]').trigger('click')
		await wrapper.get('[data-testid="opt-Delete"]').trigger('click')

		expect(wrapper.emitted('rowClick')).toBeUndefined()
		expect(toggled.at(-1)).toBe('zoom-1')
	})

	it('writes a switch through its column', async () => {
		const wrapper = build()

		await wrapper.get('[data-testid="switch"]').trigger('click')

		expect(toggled).toContainEqual(['zoom-1', false])
	})

	it('offers Load More only when a next page exists', async () => {
		expect(build().text()).not.toContain('Load More')

		const wrapper = build({ hasNextPage: true })
		const loadMore = wrapper
			.findAll('[data-testid="button"]')
			.find((b) => b.text().includes('Load More'))!
		await loadMore.trigger('click')

		expect(wrapper.emitted('loadMore')).toHaveLength(1)
	})

	it('spins only while the first page is still coming', () => {
		expect(
			build({ rows: [], loading: true })
				.find('[data-testid="spinner"]')
				.exists()
		).toBe(true)
		// A reload behind loaded rows keeps the rows on screen rather than
		// replacing the whole list with a spinner.
		expect(
			build({ loading: true }).find('[data-testid="spinner"]').exists()
		).toBe(false)
	})

	it('tells an empty list from a search that matched nothing', () => {
		const empty = build({ rows: [], emptyName: 'Coupons' })
		expect(empty.get('[data-testid="empty"]').text()).toContain(
			'Add one to get started'
		)

		const noMatch = build({ rows: [], emptyName: 'Coupons', search: 'zzz' })
		expect(noMatch.get('[data-testid="empty"]').text()).toContain('zzz')
	})

	it('shows the search box only when the panel asks for one', () => {
		expect(build().find('[data-testid="search"]').exists()).toBe(false)
		expect(
			build({ searchable: true }).find('[data-testid="search"]').exists()
		).toBe(true)
	})
})
