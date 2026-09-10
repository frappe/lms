/**
 * The badge cell of the settings table.
 *
 * A badge column takes whatever list the row gives it, a Raven workspace
 * member is in as many channels as a rule put them in, and the badges are flex
 * items whose automatic minimum size is their own label, so they never shrink.
 * Unbounded, they painted straight out of the cell and gave the settings dialog
 * a horizontal scrollbar.
 *
 * What is pinned here: that the cell draws a bounded number of badges, that the
 * rest are counted rather than dropped, that the count survives the clip that
 * bounds the badges, and that a screen reader can find out what the count
 * stands for.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { BadgeColumn, SettingsListRow } from '@/types'

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
		template: `<div data-testid="dropdown" />`,
	},
	Switch: {
		props: ['modelValue', 'ariaLabel'],
		template: `<button data-testid="switch" :aria-label="ariaLabel" />`,
	},
}))

vi.mock('frappe-ui/list', () => ({
	List: { template: `<div data-testid="list" v-bind="$attrs"><slot /></div>` },
	ListHeader: { template: `<div data-testid="header"><slot /></div>` },
	ListHeaderCell: { template: `<div data-testid="header-cell"><slot /></div>` },
	ListRows: {
		props: ['items', 'rowKey'],
		template: `<div><template v-for="item in items" :key="item.name"><slot :item="item" /></template></div>`,
	},
	ListRow: {
		template: `<div data-testid="row" @click="$emit('click')"><slot /></div>`,
	},
	ListCell: { template: `<div data-testid="cell"><slot /></div>` },
}))

const translate = (text: string) => text

vi.stubGlobal('__', translate)

// frappe patches String.prototype.format, which `__('{0}').format(x)` relies on.
;(String.prototype as any).format ??= function (...args: string[]) {
	return args.reduce((out, arg, i) => out.replace(`{${i}}`, arg), String(this))
}

import SettingsTable from '@/components/Layouts/SettingsTable.vue'

const channelsColumn = (over: Partial<BadgeColumn> = {}): BadgeColumn => ({
	key: 'channels',
	label: 'Channels',
	type: 'badge',
	badges: (row: SettingsListRow) =>
		(row.channels as string[]).map((channel) => ({
			label: `#${channel}`,
			theme: 'blue' as const,
		})),
	...over,
})

const rowIn = (count: number): SettingsListRow => ({
	name: 'ada@example.com',
	channels: Array.from({ length: count }, (_, i) => `channel-${i + 1}`),
})

const build = (count: number, over: Partial<BadgeColumn> = {}) =>
	mount(SettingsTable, {
		props: { columns: [channelsColumn(over)], rows: [rowIn(count)] },
		global: { mocks: { __: translate } },
	})

const labels = (wrapper: ReturnType<typeof build>) =>
	wrapper.findAll('[data-testid="badge"]').map((badge) => badge.text())

describe('SettingsTable: badge cell', () => {
	it('draws three badges and counts the rest', () => {
		const wrapper = build(10)

		expect(labels(wrapper)).toEqual(['#channel-1', '#channel-2', '#channel-3'])
		expect(wrapper.get('[data-testid="cell"]').text()).toContain('+7')
	})

	it('lets a wide column ask for more of them', () => {
		const wrapper = build(10, { maxBadges: 6 })

		expect(labels(wrapper)).toHaveLength(6)
		expect(wrapper.get('[data-testid="cell"]').text()).toContain('+4')
	})

	it('adds no indicator when every badge is drawn', () => {
		const wrapper = build(3)

		expect(labels(wrapper)).toHaveLength(3)
		expect(wrapper.get('[data-testid="cell"]').text()).not.toContain('+')
	})

	it('keeps the badges on one line that cannot widen the cell', () => {
		// jsdom computes no layout, so there is no width here to assert on: what
		// makes the clamp true is the class set, and each of these is load-
		// bearing. `min-w-0` lets the container shrink below its content (a flex
		// item's default minimum is its content size), `overflow-hidden` stops
		// what is left from painting outside the cell and pushing a scrollbar
		// onto the dialog, and the absence of `flex-wrap` keeps the row height
		// independent of how many badges the row has. `shrink-0` on each badge
		// makes the surplus fall off the end rather than every badge being
		// squeezed into an unreadable sliver.
		const wrapper = build(10)
		const badges = wrapper.get('[data-testid="cell"]').element
			.children[0] as HTMLElement
		const classes = badges.className.split(' ')

		expect(classes).toContain('flex')
		expect(classes).toContain('min-w-0')
		expect(classes).toContain('overflow-hidden')
		expect(classes.some((c) => c.startsWith('flex-wrap'))).toBe(false)
		for (const badge of wrapper.findAll('[data-testid="badge"]'))
			expect(badge.classes()).toContain('shrink-0')
	})

	it('keeps the count outside the clip that bounds the badges', () => {
		// The indicator sits beside the clipping container, not inside it, so
		// the clip can never be what removes it, a cell that hides badges and
		// says nothing about it is the failure this whole cell exists to avoid.
		const cell = build(10).get('[data-testid="cell"]').element
		const indicator = cell.children[1] as HTMLElement

		expect(indicator.textContent?.trim()).toBe('+7')
		expect(indicator.className.split(' ')).toContain('shrink-0')
	})

	it('says what the count stands for, for a screen reader', () => {
		// `+7` names nothing on its own, and a title is not reachable from the
		// keyboard, the row is already a button, so a tooltip trigger inside it
		// would nest one control in another. The names are text instead.
		const wrapper = build(5)
		const cell = wrapper.get('[data-testid="cell"]').element
		const indicator = cell.children[1] as HTMLElement
		const summary = cell.children[2] as HTMLElement

		expect(indicator.getAttribute('aria-hidden')).toBe('true')
		expect(summary.className.split(' ')).toContain('sr-only')
		expect(summary.textContent).toContain('#channel-4')
		expect(summary.textContent).toContain('#channel-5')
		expect(summary.textContent).not.toContain('#channel-3')
	})
})
