/**
 * MappingListTable.vue v2: any unmapped row — channel or workspace — renders dulled
 * with a Link button; the actions column drops the "..." menu below two entries.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, ref } from 'vue'
import MappingListTable from '@/components/Settings/Raven/MappingListTable.vue'

vi.mock('frappe-ui', () => ({
	// Undeclared @click.stop falls through as a native listener on the root
	// <button>, so triggering a DOM click fires the component's handler.
	Button: {
		props: ['variant', 'size', 'loading', 'disabled', 'ariaLabel', 'button'],
		template: `<button class="btn" :disabled="disabled" :aria-label="ariaLabel"><slot name="prefix" /><slot name="icon" /><slot />{{ button?.icon }}</button>`,
	},
	Switch: {
		props: ['modelValue', 'size', 'disabled'],
		template: `<span data-testid="switch" :data-disabled="disabled || undefined" />`,
	},
	Dropdown: {
		props: ['options', 'button', 'placement'],
		template: `<span class="dropdown"><slot /></span>`,
	},
	TextInput: {
		props: ['modelValue', 'size', 'variant', 'ariaLabel'],
		template: `<input />`,
	},
	Tooltip: { props: ['text'], template: `<span><slot /></span>` },
	Badge: {
		props: ['label', 'theme', 'variant', 'size'],
		template: `<span data-testid="badge">{{ label }}</span>`,
	},
}))

vi.mock('frappe-ui/list', () => ({
	List: { props: ['columns'], template: `<div><slot /></div>` },
	ListHeader: { template: `<div><slot /></div>` },
	ListHeaderCell: { template: `<div><slot /></div>` },
	ListRows: {
		props: ['items', 'rowKey'],
		template: `<div><template v-for="item in items" :key="item.key">
			<slot :item="item" />
		</template></div>`,
	},
	// Single root so class / @click fall through onto it.
	ListRow: { template: `<div class="row"><slot /></div>` },
	ListCell: { template: `<div class="cell"><slot /></div>` },
}))

vi.mock('@/components/Layouts/EmptyStateLayout.vue', () => ({
	default: { template: `<div data-testid="empty" />` },
}))

vi.stubGlobal('__', (s: string) => s)

const mappedChannel = () => ({
	name: 'RCM-1',
	key: 'CH-1',
	mapped: true,
	ravenId: 'CH-1',
	label: 'general',
	type: 'Public',
	rule_combinator: 'Any (OR)',
	paused: false,
	stale: false,
	record: {},
})
const unmappedChannel = () => ({
	name: null,
	key: 'CH-RAW',
	mapped: false,
	ravenId: 'CH-RAW',
	label: 'random',
	type: 'Public',
	rule_combinator: null,
	paused: false,
	stale: false,
	record: {},
})
const unmappedWorkspace = () => ({
	name: null,
	key: 'WS-RAW',
	mapped: false,
	ravenId: 'WS-RAW',
	label: 'Design HQ',
	type: 'Public',
	rule_combinator: null,
	paused: false,
	stale: false,
	record: {},
})
const staleChannel = () => ({
	name: 'RCM-2',
	key: 'CH-2',
	mapped: true,
	ravenId: 'CH-2',
	label: 'archived',
	type: 'Public',
	rule_combinator: 'Any (OR)',
	paused: false,
	stale: true,
	record: {},
})

function makeList(rows: any[], adoptOnEdit: boolean) {
	return {
		rows: computed(() => rows),
		loading: computed(() => false),
		columns: [
			{ label: 'Label', key: 'label', width: 1 },
			{ label: 'Type', key: 'type', width: '7rem' },
			{ label: 'Combine', key: 'rule_combinator', width: '8.5rem' },
			{ label: 'Enabled', key: 'enabled', width: '5.5rem' },
			{ label: '', key: 'actions', width: '2.25rem' },
		],
		adoptOnEdit,
		selectedKey: ref<string | null>(null),
		linkingKey: ref<string | null>(null),
		editingLabel: ref<string | null>(null),
		labelDraft: ref(''),
		selectRow: vi.fn(),
		linkRow: vi.fn(),
		startEdit: vi.fn(),
		cancelEdit: vi.fn(),
		saveLabel: vi.fn(),
		toggleEnabled: vi.fn(),
		typeMenu: () => [],
		combinatorMenu: () => [],
		takeActionMenu: () => [],
		askDelete: vi.fn(),
	}
}

const mountTable = (list: any, extra: Record<string, unknown> = {}) =>
	mount(MappingListTable, {
		props: {
			list,
			emptyName: 'Channels',
			emptyIcon: 'lucide-hash',
			emptyDescription: 'none',
			...extra,
		},
		global: { mocks: { __: (s: string) => s } },
	})

describe.each([
	['channel', unmappedChannel, false],
	['workspace', unmappedWorkspace, true],
] as const)('MappingListTable — dulled unmapped %s row', (_entity, unmappedRow, adoptOnEdit) => {
	it('dims the descriptive cells but not the actions cell, and disables (not hides) its controls', () => {
		const list = makeList([mappedChannel(), unmappedRow()], adoptOnEdit)
		const w = mountTable(list, { labelPrefix: '#', labelClass: 'font-mono' })

		const rows = w.findAll('.row')
		expect(rows).toHaveLength(2)

		// Mapped row: no cell is dimmed.
		const mappedCells = rows[0].findAll('.cell')
		expect(mappedCells.every((c) => !c.classes().includes('opacity-60'))).toBe(
			true
		)

		// Dulled row: label/type/combine/enabled dim, but the last (actions)
		// cell stays full-opacity so its Link button reads as a live control.
		const dulledCells = rows[1].findAll('.cell')
		expect(dulledCells.slice(0, -1).every((c) => c.classes().includes('opacity-60'))).toBe(true)
		expect(dulledCells.at(-1)!.classes()).not.toContain('opacity-60')

		// Both rows still show the Enabled switch and type/combine dropdowns —
		// the dulled row's just come back disabled, not suppressed.
		const switches = w.findAll('[data-testid="switch"]')
		expect(switches).toHaveLength(2)
		expect(switches[0].attributes('data-disabled')).toBeFalsy()
		expect(switches[1].attributes('data-disabled')).toBeTruthy()
	})

	it('has no rename control on the dulled row', () => {
		const list = makeList([unmappedRow()], adoptOnEdit)
		const w = mountTable(list)
		expect(
			w.findAll('button').some((b) => b.attributes('aria-label') === 'Rename')
		).toBe(false)
	})

	it('shows an icon-only, aria-labelled Link button in the actions column that calls linkRow', async () => {
		const list = makeList([unmappedRow()], adoptOnEdit)
		const w = mountTable(list)

		const link = w
			.findAll('button')
			.find((b) => b.attributes('aria-label') === 'Link')
		expect(link).toBeTruthy()
		// Icon-only: no visible text label, just the aria-label for screen readers.
		expect(link!.text()).toBe('')

		await link!.trigger('click')
		expect(list.linkRow).toHaveBeenCalledTimes(1)
		expect(list.linkRow.mock.calls[0][0].key).toBe(unmappedRow().key)
	})

	it('does not select the row when a dulled row body is clicked', async () => {
		const list = makeList([unmappedRow()], adoptOnEdit)
		const w = mountTable(list)
		await w.find('.row').trigger('click')
		expect(list.selectRow).not.toHaveBeenCalled()
	})
})

describe('MappingListTable — actions column: no per-row Delete on a healthy mapping', () => {
	it('a mapped channel row (no extraRowOptions) shows nothing in the actions cell', () => {
		const list = makeList([mappedChannel()], false)
		const w = mountTable(list)

		// Type + combine dropdowns are the baseline on every row; no third, since a channel
		// has no row-menu entries — deleting a healthy mapping is a Desk action now.
		expect(w.findAll('.dropdown')).toHaveLength(2)
		expect(
			w.findAll('button').some((b) => b.attributes('aria-label') === 'Delete')
		).toBe(false)
	})

	it('renders a single extraRowOption (e.g. a workspace\'s "Channels" jump) directly, not behind a Dropdown', async () => {
		const onClick = vi.fn()
		const list = makeList([mappedChannel()], false)
		const w = mountTable(list, {
			extraRowOptions: () => [{ label: 'Channels', onClick }],
		})

		// Still just the type + combine dropdowns — the single row action is a
		// direct button, not a third Dropdown.
		expect(w.findAll('.dropdown')).toHaveLength(2)
		const jump = w
			.findAll('button')
			.find((b) => b.attributes('aria-label') === 'Channels')
		expect(jump).toBeTruthy()

		await jump!.trigger('click')
		expect(onClick).toHaveBeenCalledTimes(1)
	})

	it('keeps the "..." Dropdown once there are two or more row-menu entries', () => {
		const list = makeList([mappedChannel()], false)
		const w = mountTable(list, {
			extraRowOptions: () => [
				{ label: 'Channels', onClick: vi.fn() },
				{ label: 'Something else', onClick: vi.fn() },
			],
		})
		// Type + combine dropdowns, plus the actions "..." dropdown = 3.
		expect(w.findAll('.dropdown')).toHaveLength(3)
	})
})

describe('MappingListTable — a mapped row is never dulled, regardless of adoptOnEdit', () => {
	it('selects a mapped channel row on click', async () => {
		const list = makeList([mappedChannel()], false)
		const w = mountTable(list)
		await w.find('.row').trigger('click')
		expect(list.selectRow).toHaveBeenCalledTimes(1)
	})
})

describe('MappingListTable — a stale row', () => {
	function makeStaleList(recreate: () => void, del: () => void) {
		const list = makeList([staleChannel()], false)
		list.takeActionMenu = () => [
			{ label: 'Recreate channel', icon: 'lucide-refresh-cw', onClick: recreate },
			{
				label: 'Delete mapping',
				icon: 'lucide-trash-2',
				theme: 'red',
				onClick: del,
			},
		]
		return list
	}

	it('has no "Take action" control in the label cell any more', () => {
		const list = makeStaleList(vi.fn(), vi.fn())
		const w = mountTable(list)
		expect(
			w.findAll('button').some((b) => b.text() === 'Take action')
		).toBe(false)
		// The Stale badge itself stays — only the select-style control moved.
		expect(w.find('[data-testid="badge"]').text()).toBe('Stale')
	})

	it('renders Recreate and Delete mapping directly in the actions cell, and calls each', async () => {
		const recreate = vi.fn()
		const del = vi.fn()
		const list = makeStaleList(recreate, del)
		const w = mountTable(list)

		const recreateBtn = w
			.findAll('button')
			.find((b) => b.attributes('aria-label') === 'Recreate channel')
		const deleteBtn = w
			.findAll('button')
			.find((b) => b.attributes('aria-label') === 'Delete mapping')
		expect(recreateBtn).toBeTruthy()
		expect(deleteBtn).toBeTruthy()
		expect(deleteBtn!.attributes('theme')).toBe('red')

		await recreateBtn!.trigger('click')
		await deleteBtn!.trigger('click')
		expect(recreate).toHaveBeenCalledTimes(1)
		expect(del).toHaveBeenCalledTimes(1)
	})

	it('also shows a single extraRowOption (e.g. "Channels") alongside Recreate/Delete', () => {
		const onClick = vi.fn()
		const list = makeStaleList(vi.fn(), vi.fn())
		const w = mountTable(list, {
			extraRowOptions: () => [{ label: 'Channels', onClick }],
		})
		expect(
			w.findAll('button').some((b) => b.attributes('aria-label') === 'Channels')
		).toBe(true)
	})

	it('dims the descriptive cells but not the actions cell, same as a dulled row', () => {
		const list = makeStaleList(vi.fn(), vi.fn())
		const w = mountTable(list)
		const cells = w.find('.row').findAll('.cell')
		expect(cells.slice(0, -1).every((c) => c.classes().includes('opacity-60'))).toBe(
			true
		)
		expect(cells.at(-1)!.classes()).not.toContain('opacity-60')
	})

	it('disables the type/combine/enabled controls', () => {
		const list = makeStaleList(vi.fn(), vi.fn())
		const w = mountTable(list)
		const switchEl = w.find('[data-testid="switch"]')
		expect(switchEl.attributes('data-disabled')).toBeTruthy()
	})
})
