/**
 * Selection in ResponsiveListView.
 *
 * The component draws a desk row above 640px and a card below it. Bulk actions
 * are the part of a list page that a breakpoint can silently take away: a
 * moderator on a phone still has to be able to pick rows and reach the page's
 * #selection-actions banner. What is pinned down here is that both shapes are
 * selected out of the one frappe-ui ListView, that the banner slot is handed
 * the same props at either width, and that a page which never asked to be
 * selectable gets no selection furniture on a phone.
 */
import { describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'

const { mobile } = vi.hoisted(() => ({ mobile: { value: true } }))

vi.mock('@/utils/composables', async () => {
	const { computed } = await import('vue')
	return {
		MOBILE_BREAKPOINT: 640,
		useScreenSize: () => ({ isMobile: computed(() => mobile.value) }),
	}
})

// The stubs below are trimmed copies of the frappe-ui components they stand in
// for, kept faithful on the one thing under test: where the selection lives.
// The real ones cannot be imported here: frappe-ui's ListView pulls in its
// resources plugin, which does not resolve outside a Vite app build.
vi.mock('frappe-ui', async () => {
	const { computed, defineComponent, inject, provide, reactive, watch } =
		await import('vue')

	const ListView = defineComponent({
		name: 'ListView',
		inheritAttrs: false,
		props: {
			columns: { type: Array, default: () => [] },
			rows: { type: Array, default: () => [] },
			rowKey: { type: String, required: true },
			options: { type: Object, default: () => ({}) },
		},
		emits: ['update:selections'],
		setup(props, { emit, expose }) {
			const selections = reactive(new Set())
			watch(selections, (value) => emit('update:selections', value))

			function toggleRow(rowKey: unknown) {
				if (!selections.delete(rowKey)) selections.add(rowKey)
			}

			function toggleAllRows(select: boolean) {
				if (!select) {
					selections.clear()
					return
				}
				for (const row of props.rows as Record<string, unknown>[]) {
					selections.add(row[props.rowKey])
				}
			}

			// ListSelectBanner reads the selection by injection, including when it
			// is written into the default slot the way this component writes it.
			provide(
				'list',
				computed(() => ({
					rowKey: props.rowKey,
					rows: props.rows,
					columns: props.columns,
					options: props.options,
					selections,
					allRowsSelected: selections.size === props.rows.length,
					toggleRow,
					toggleAllRows,
				}))
			)

			expose({ selections, toggleRow, toggleAllRows })
			return {}
		},
		// Both wrappers are copied verbatim from frappe-ui's ListView.vue, class
		// lists included. The inner one is the reason the cards need a scroll box
		// of their own: it clips them, and the class a caller passes lands on it
		// rather than replacing anything.
		template: `<div class="relative flex w-full flex-1 flex-col overflow-x-auto">
			<div
				class="flex w-max min-w-full flex-col overflow-y-hidden"
				data-testid="listview"
				v-bind="$attrs"
			><slot /></div>
		</div>`,
	})

	const ListSelectBanner = defineComponent({
		name: 'ListSelectBanner',
		inheritAttrs: false,
		setup() {
			const list = inject<{ value: Record<string, any> }>('list')!
			const bannerProps = computed(() => ({
				selections: list.value.selections,
				allRowsSelected: list.value.allRowsSelected,
				selectAll: () => list.value.toggleAllRows(true),
				unselectAll: () => list.value.toggleAllRows(false),
			}))
			return { list, bannerProps }
		},
		template: `<div
			v-if="list.selections.size"
			data-testid="select-banner"
			v-bind="$attrs"
		><slot name="actions" v-bind="bannerProps" /></div>`,
	})

	const Checkbox = defineComponent({
		name: 'Checkbox',
		inheritAttrs: false,
		props: { modelValue: Boolean, size: String },
		emits: ['update:modelValue'],
		setup(_props, { emit }) {
			// frappe-ui's Checkbox writes its model and then re-emits, so one change
			// reports the same value twice.
			function onChange(event: Event) {
				const next = (event.target as HTMLInputElement).checked
				emit('update:modelValue', next)
				emit('update:modelValue', next)
			}
			return { onChange }
		},
		template: `<input
			type="checkbox"
			data-testid="row-checkbox"
			v-bind="$attrs"
			:checked="modelValue"
			@change="onChange"
		/>`,
	})

	const passthrough = (testid: string) => ({
		inheritAttrs: false,
		template: `<div data-testid="${testid}" v-bind="$attrs"><slot /></div>`,
	})

	return {
		Checkbox,
		ListView,
		ListSelectBanner,
		ListHeader: passthrough('list-header'),
		ListHeaderItem: {
			props: ['item'],
			template:
				'<div><slot name="prefix" :item="item" />{{ item.label }}</div>',
		},
		ListRows: { template: '<div data-testid="list-rows" />' },
		ListRowItem: { template: '<div><slot /></div>' },
	}
})

vi.stubGlobal('__', (text: string) => text)

// frappe's translation layer patches String.prototype.format onto the page at
// runtime; every list page in this app calls it, so the tests get it too.
String.prototype.format = function (this: string, ...args: unknown[]): string {
	return this.replace(/{(\d+)}/g, (match, index) =>
		args[Number(index)] === undefined ? match : String(args[Number(index)])
	)
}

const ROWS = [
	{ name: 'a', title: 'Alpha', modified: '01 Jan 2026' },
	{ name: 'b', title: 'Beta', modified: '02 Jan 2026' },
]

const COLUMNS = [
	{ label: 'Title', key: 'title', width: 2 },
	{ label: 'Updated On', key: 'modified', width: 1 },
]

type BannerProps = {
	selections: Set<unknown>
	allRowsSelected: boolean
	selectAll: () => void
	unselectAll: () => void
}

async function mountList(options?: Record<string, unknown>, withBanner = true) {
	const { default: ResponsiveListView } = await import(
		'@/components/ResponsiveListView.vue'
	)
	const banner = ref<BannerProps | null>(null)
	const wrapper = mount(ResponsiveListView, {
		props: { columns: COLUMNS, rows: ROWS, rowKey: 'name', options },
		slots: withBanner
			? {
					'selection-actions': (props: BannerProps) => {
						banner.value = props
						return h('button', { class: 'bulk-delete' }, 'Delete')
					},
			  }
			: {},
		// `__` in a template compiles to `_ctx.__`, which resolves through the
		// instance rather than globalThis, so stubGlobal alone does not reach it.
		global: {
			mocks: { __: (text: string) => text },
			stubs: { 'router-link': { template: '<a><slot /></a>' } },
		},
	})
	await nextTick()
	return { wrapper, banner }
}

const routedOptions = {
	selectable: true,
	getRowRoute: (row: Record<string, unknown>) => `/quizzes/${row.name}`,
}

async function selectFirstRow(wrapper: VueWrapper) {
	await wrapper.findAll('[data-testid="row-checkbox"]')[0].setValue(true)
	await nextTick()
}

function clickCard(wrapper: VueWrapper, index: number) {
	const event = new MouseEvent('click', { bubbles: true, cancelable: true })
	wrapper
		.findAll('li')
		[index].element.querySelector('[data-list-card]')!
		.dispatchEvent(event)
	return event
}

describe('ResponsiveListView selection on a phone', () => {
	it('offers a named checkbox per card and opens the page banner from it', async () => {
		mobile.value = true
		const { wrapper, banner } = await mountList(routedOptions)

		const boxes = wrapper.findAll('[data-testid="row-checkbox"]')
		expect(boxes).toHaveLength(ROWS.length)
		// A bare checkbox says nothing about what it selects.
		expect(boxes[0].attributes('aria-label')).toBe('Select Alpha')
		expect(wrapper.find('[data-testid="select-banner"]').exists()).toBe(false)

		await selectFirstRow(wrapper)

		expect(wrapper.find('[data-testid="select-banner"]').exists()).toBe(true)
		expect(wrapper.find('button.bulk-delete').exists()).toBe(true)
		expect(Array.from(banner.value!.selections)).toEqual(['a'])
	})

	it('selects exactly one row per tap, though the checkbox reports twice', async () => {
		mobile.value = true
		const { wrapper, banner } = await mountList(routedOptions)

		await selectFirstRow(wrapper)

		expect(Array.from(banner.value!.selections)).toEqual(['a'])
		expect(
			(
				wrapper.findAll('[data-testid="row-checkbox"]')[0]
					.element as HTMLInputElement
			).checked
		).toBe(true)
	})

	it('hands the banner the same props a desk hands it', async () => {
		mobile.value = true
		const phone = await mountList(routedOptions)
		await selectFirstRow(phone.wrapper)

		mobile.value = false
		const desk = await mountList(routedOptions)
		const list = desk.wrapper.findComponent({ name: 'ListView' })
		list.vm.toggleRow('a')
		await nextTick()

		expect(Object.keys(phone.banner.value!).sort()).toEqual(
			Object.keys(desk.banner.value!).sort()
		)
		expect(Array.from(phone.banner.value!.selections)).toEqual(
			Array.from(desk.banner.value!.selections)
		)
		for (const props of [phone.banner.value!, desk.banner.value!]) {
			expect(props.selections).toBeInstanceOf(Set)
			expect(typeof props.unselectAll).toBe('function')
			expect(typeof props.selectAll).toBe('function')
		}
	})

	it('clears the selection from the slot, the way a page ends a bulk action', async () => {
		mobile.value = true
		const { wrapper, banner } = await mountList(routedOptions)
		await selectFirstRow(wrapper)

		banner.value!.unselectAll()
		await nextTick()

		expect(banner.value!.selections.size).toBe(0)
		expect(wrapper.find('[data-testid="select-banner"]').exists()).toBe(false)
	})

	it('selects every row when the banner asks for all of them', async () => {
		mobile.value = true
		const { wrapper, banner } = await mountList(routedOptions)
		await selectFirstRow(wrapper)

		banner.value!.selectAll()
		await nextTick()

		expect(Array.from(banner.value!.selections)).toEqual(['a', 'b'])
	})
})

describe('ResponsiveListView cards and row navigation', () => {
	it('leaves a card free to navigate while nothing is selected', async () => {
		mobile.value = true
		const { wrapper } = await mountList(routedOptions)

		expect(clickCard(wrapper, 1).defaultPrevented).toBe(false)
	})

	// A card is the row's own link; once a selection is open, following it would
	// throw the moderator off the page and drop what they had picked. It stops
	// being a link entirely rather than preventing the default: RouterLink merges
	// an outer @click BEHIND its own handler, which has already pushed the route.
	it('turns a card into a selection target while a selection is open', async () => {
		mobile.value = true
		const { wrapper, banner } = await mountList(routedOptions)
		await selectFirstRow(wrapper)

		const card = wrapper
			.findAll('li')[1]
			.element.querySelector('[data-list-card]') as HTMLElement
		expect(card.tagName).toBe('DIV')
		expect(card.getAttribute('href')).toBeNull()

		clickCard(wrapper, 1)
		await nextTick()

		expect(Array.from(banner.value!.selections)).toEqual(['a', 'b'])
	})

	it('holds back the page row handler while a selection is open', async () => {
		mobile.value = true
		const onRowClick = vi.fn()
		const { wrapper, banner } = await mountList({
			selectable: true,
			onRowClick,
		})

		clickCard(wrapper, 0)
		await nextTick()
		expect(onRowClick).toHaveBeenCalledTimes(1)

		await selectFirstRow(wrapper)
		clickCard(wrapper, 1)
		await nextTick()

		expect(onRowClick).toHaveBeenCalledTimes(1)
		expect(Array.from(banner.value!.selections)).toEqual(['a', 'b'])
	})
})

describe('ResponsiveListView without selection', () => {
	it('gives a page that never asked to be selectable no checkbox', async () => {
		mobile.value = true
		const { wrapper } = await mountList({
			getRowRoute: (row: Record<string, unknown>) => `/courses/${row.name}`,
		})

		expect(wrapper.find('[data-testid="row-checkbox"]').exists()).toBe(false)
		expect(wrapper.findAll('li')).toHaveLength(ROWS.length)
		expect(wrapper.findAll('li')[0].text()).toContain('Alpha')
	})

	it('gives a selectable page with no bulk actions no dead-end checkbox', async () => {
		mobile.value = true
		const { wrapper } = await mountList({ selectable: true }, false)

		expect(wrapper.find('[data-testid="row-checkbox"]').exists()).toBe(false)
	})

	it('keeps drawing the desk row and header above the breakpoint', async () => {
		mobile.value = false
		const { wrapper } = await mountList(routedOptions)

		expect(wrapper.find('[data-testid="list-rows"]').exists()).toBe(true)
		expect(wrapper.find('ul').exists()).toBe(false)
		expect(wrapper.find('[data-testid="row-checkbox"]').exists()).toBe(false)
	})
})

/**
 * frappe-ui hands its rows a box it has already clipped (`overflow-y-hidden`),
 * and supplies the scrolling itself in ListRows. The card shape replaces
 * ListRows, so it has to supply that scrolling too. Without it the cards past
 * the first screenful are painted and unreachable, which is what a phone with
 * 24 quizzes on it actually showed. jsdom has no layout to measure, so what is
 * pinned here is the structure that produces it; the measurement lives in the
 * handover.
 */
describe('ResponsiveListView card scrolling', () => {
	const SCROLLS = 'overflow-y-auto'

	// The cards must not scroll inside anything of their own. The page body owns
	// the single scroll box, and on a phone even that is released so the page
	// itself scrolls; a box here would take the page's scroll range away, and a
	// browser only retracts its URL bar when the root scroller moves.
	//
	// It is worth stating because frappe-ui makes it easy to get wrong twice
	// over: the box it hands these rows is `overflow-y-hidden`, and it supplies
	// the scrolling in ListRows, which the card shape replaces. Give the cards
	// nothing and they are clipped; give them a scroller and the page is.
	it('never scrolls the cards inside a box of their own', async () => {
		mobile.value = true
		const { wrapper } = await mountList(routedOptions)

		const list = wrapper.find('ul').element
		const clipped = wrapper.find('[data-testid="listview"]').element
		expect(clipped.className).toContain('overflow-y-hidden')

		for (
			let el = list.parentElement;
			el && el !== clipped;
			el = el.parentElement
		) {
			expect(el.className.includes(SCROLLS)).toBe(false)
		}
		// And nothing may bound their height either, or the clip bites instead.
		for (
			let el = list.parentElement;
			el && el !== clipped;
			el = el.parentElement
		) {
			expect(el.className.includes('min-h-0')).toBe(false)
		}
	})

	it('leaves the selection banner outside the rows, so it does not scroll away', async () => {
		mobile.value = true
		const { wrapper } = await mountList(routedOptions)
		await selectFirstRow(wrapper)

		const banner = wrapper.find('[data-testid="select-banner"]').element
		const list = wrapper.find('ul').element
		expect(banner.contains(list)).toBe(false)
	})
})
