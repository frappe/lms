/**
 * The settings table's scrolling window, and what is deliberately outside it.
 *
 * Three things here are geometry that jsdom cannot compute, so each is pinned
 * by the declaration that produces it rather than by a measurement: the row
 * window `visibleRows` opens, the fact that Load More is not inside it, and the
 * two class-level fixes that only show up under a pointer or a keyboard.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { SettingsListColumn, SettingsListRow } from '@/types'

vi.mock('frappe-ui', () => ({
	Avatar: { props: ['image', 'label'], template: `<span />` },
	Badge: { props: ['theme'], template: `<span><slot /></span>` },
	Button: {
		emits: ['click'],
		template: `<button data-testid="load-more" @click="$emit('click')"><slot /></button>`,
	},
	Dropdown: { props: ['options'], template: `<div />` },
	Switch: { props: ['modelValue', 'ariaLabel'], template: `<button />` },
}))

vi.mock('frappe-ui/list', () => ({
	List: { template: `<div data-testid="list" v-bind="$attrs"><slot /></div>` },
	ListHeader: {
		template: `<div data-testid="header" v-bind="$attrs"><slot /></div>`,
	},
	ListHeaderCell: { template: `<div><slot /></div>` },
	ListRows: {
		props: ['items', 'rowKey'],
		template: `<div><template v-for="item in items" :key="item.name"><slot :item="item" /></template></div>`,
	},
	ListRow: {
		template: `<div data-testid="row" v-bind="$attrs" @click="$emit('click')"><slot /></div>`,
	},
	ListCell: { template: `<div><slot /></div>` },
}))

const translate = (text: string) => text

vi.stubGlobal('__', translate)

import SettingsTable from '@/components/Layouts/SettingsTable.vue'

const columns: SettingsListColumn[] = [
	{
		key: 'name',
		label: 'Name',
		type: 'text',
		value: (row: SettingsListRow) => String(row.name),
	},
]

const rows: SettingsListRow[] = [{ name: 'ada@example.com' }]

const build = (props: Record<string, unknown> = {}) =>
	mount(SettingsTable, {
		props: { columns, rows, ...props },
		global: { mocks: { __: translate } },
	})

const scroller = (wrapper: ReturnType<typeof build>) =>
	wrapper.get('.overflow-y-auto').element as HTMLElement

describe('SettingsTable: the scrolling window', () => {
	it('opens a window of exactly the rows asked for, plus the header', () => {
		// The header shares the scroll box, so it has to be paid for or the
		// window comes up a row short of what the caller asked for. `2rem` is
		// frappe-ui's own ListHeader height (`h-8`).
		expect(scroller(build({ visibleRows: 9 })).style.maxHeight).toBe(
			'calc(var(--list-row-height) * 9 + 2rem)'
		)
	})

	it('caps nothing unless a page asks it to', () => {
		// A ceiling is a statement about one page's shape. Every settings screen
		// that is its own page must keep using the room it has, an earlier pass
		// put this in the shared table and quietly resized all of them.
		expect(scroller(build()).style.maxHeight).toBe('')
	})

	it('leaves Load More outside the table', () => {
		// Two reasons, either sufficient. `List` is a `role="table"`, which owns
		// only rows and rowgroups, the scroller being `role="presentation"` does
		// not launder a button placed inside it, it re-parents it onto the table.
		// And under `visibleRows` an inside button sits below the fold: the page
		// fetches 13 rows, the tabs show 9.
		const wrapper = build({ visibleRows: 9, hasNextPage: true })
		const button = '[data-testid="load-more"]'

		expect(wrapper.find(button).exists()).toBe(true)
		expect(wrapper.get('[data-testid="list"]').find(button).exists()).toBe(
			false
		)
	})

	it('emits loadMore from there all the same', async () => {
		const wrapper = build({ hasNextPage: true })
		await wrapper.get('[data-testid="load-more"]').trigger('click')

		expect(wrapper.emitted('loadMore')).toHaveLength(1)
	})

	it('draws no Load More without a next page', () => {
		expect(build().find('[data-testid="load-more"]').exists()).toBe(false)
	})
})

describe('SettingsTable: row states the scroller would otherwise eat', () => {
	it('pulls the focus ring inside the row', () => {
		// `overflow-y: auto` on the scroller computes `overflow-x` to `auto` too,
		// and a row is exactly as wide as the scroller's content box, so a ring
		// at the default offset loses its left and right strokes. Outlines are
		// not scrollable overflow, so nothing scrolls to bring them back.
		expect(build().get('[data-testid="row"]').classes()).toContain(
			'[outline-offset:-3px]'
		)
	})

	it('re-tones the hover wash for dark mode', () => {
		// frappe-ui washes a row to `surface-gray-1`, which in dark mode is the
		// same value as the dialog surface it is drawn on (both darkMode/gray/900),
		// so pointing at a row did nothing at all. The class is asserted rather
		// than the colour because jsdom resolves no custom properties.
		expect(build().get('[data-testid="row"]').classes()).toContain(
			'dark:sm:hover:bg-surface-gray-2'
		)
	})
})
