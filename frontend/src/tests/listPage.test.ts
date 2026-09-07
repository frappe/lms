/**
 * The list-page component family.
 *
 * Every list page in the app declares what it filters and what a row looks
 * like; ListPage / PageBody / ToggleFilter / ResponsiveListView own how
 * that reads at each breakpoint. The invariants worth pinning down are the ones
 * a page can no longer see for itself: that a phone leaves the scrolling to the
 * page rather than a box inside it, that the footer holds the bottom edge while
 * the filters above the rows never pin, that one click on a boolean filter
 * causes exactly one reload, and that the desk row and the phone card are fed
 * by the same #cell slot.
 */
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'

const { mobile } = vi.hoisted(() => ({ mobile: { value: false } }))

vi.mock('@/utils/composables', async () => {
	const { computed } = await import('vue')
	return {
		MOBILE_BREAKPOINT: 640,
		useScreenSize: () => ({ isMobile: computed(() => mobile.value) }),
	}
})

vi.mock('frappe-ui', () => {
	const passthrough = (tag: string, testid?: string) => ({
		inheritAttrs: false,
		template: `<${tag} v-bind="$attrs"${
			testid ? ` data-testid="${testid}"` : ''
		}><slot /></${tag}>`,
	})
	return {
		Breadcrumbs: { template: '<nav data-testid="breadcrumbs" />' },
		Button: passthrough('button'),
		ListFooter: {
			props: ['modelValue', 'options'],
			template: `<div data-testid="footer">
				<slot name="right" />
			</div>`,
		},
		// Reproduces the quirk that costs a page a duplicate request: onChange
		// assigns the model and then re-emits, so one click notifies twice with
		// the same value before the prop has round-tripped.
		// Faithful to frappe-ui's Checkbox in the one structural respect the
		// filters rely on: an <input> plus a <label for> pointing at it, so the
		// label is part of the hit area. A stub that rendered only the input
		// would let a label-association assertion pass vacuously.
		Checkbox: defineComponent({
			props: {
				modelValue: Boolean,
				label: String,
				description: String,
				size: String,
			},
			emits: ['update:modelValue'],
			methods: {
				onChange() {
					this.$emit('update:modelValue', !this.modelValue)
					this.$emit('update:modelValue', !this.modelValue)
				},
			},
			template: `<div>
				<input
					type="checkbox"
					data-testid="checkbox"
					id="cb"
					:aria-label="label"
					:checked="modelValue"
					@change="onChange"
				/>
				<label data-testid="checkbox-label" for="cb" @click="onChange">
					{{ label }}
				</label>
			</div>`,
		}),
		Tooltip: {
			props: ['text'],
			template: '<div :data-tooltip="text"><slot /></div>',
		},
		ListView: {
			name: 'ListView',
			props: ['columns', 'rows', 'rowKey', 'options'],
			template: '<div data-testid="listview"><slot /></div>',
		},
		ListHeader: passthrough('div', 'list-header'),
		ListHeaderItem: {
			props: ['item'],
			template:
				'<div><slot name="prefix" :item="item" />{{ item.label }}</div>',
		},
		ListRows: { template: '<div data-testid="list-rows" />' },
		ListRowItem: { template: '<div><slot /></div>' },
		ListSelectBanner: { template: '<div><slot name="actions" /></div>' },
	}
})

const stub = (template: string) => ({ default: { template } })
vi.mock('@/components/SkeletonLoader.vue', () =>
	stub('<div data-testid="skeleton" />')
)
vi.mock('@/components/Layouts/EmptyStateLayout.vue', () =>
	stub('<div data-testid="empty" />')
)

vi.stubGlobal('__', (s: string) => s)

const ROWS = [
	{ name: 'a', title: 'Alpha', modified: '01 Jan 2026' },
	{ name: 'b', title: 'Beta', modified: '02 Jan 2026' },
]

const COLUMNS = [
	{ label: 'Title', key: 'title', width: 2, icon: 'lucide-file-text' },
	{ label: 'Updated On', key: 'modified', width: 1, icon: 'lucide-clock' },
]

async function mountListPage(props: Record<string, unknown> = {}, slots = {}) {
	const { default: ListPage } = await import(
		'@/components/Layouts/ListPage.vue'
	)
	const wrapper = mount(ListPage, {
		props: { breadcrumbs: [{ label: 'Courses' }], rows: ROWS, ...props },
		slots,
		global: {
			mocks: { __: (s: string) => s },
			stubs: {
				'router-link': { template: '<a><slot /></a>' },
				// PageBody's mobile filter sheet teleports to body; without this
				// its contents leave the wrapper and are unfindable.
				teleport: true,
			},
		},
	})
	await nextTick()
	return wrapper
}

// Two things legitimately pin: PageHeader's own `<header>`, and the footer,
// which holds the bottom edge so the page size and Load More stay put. What
// must never come back is a pinned strip *above* the rows. That was the
// filters re-pinned at a measured offset, and any drift between the
// measurement and the app header's real height showed as a band of content
// scrolling between the two.
const pinnedAboveRows = (wrapper: any) => {
	const footer = wrapper.get('[data-testid="footer"]').element
	return wrapper
		.findAll('*')
		.filter(
			(node: any) =>
				node.element.tagName !== 'HEADER' &&
				!node.element.contains(footer) &&
				node.classes().includes('sticky')
		)
}

// Below `sm` the page itself is the scroller, so a scroll box inside the body
// is the thing that must not exist: it leaves the page with no scroll range,
// and a browser only retracts its URL bar when the root scroller moves.
const mobileScrollers = (wrapper: any) =>
	wrapper
		.findAll('*')
		.filter((node: any) => node.classes().includes('overflow-y-auto'))

// Above it the desk arrangement returns: exactly one box scrolls the rows so
// the header and footer around it hold their place.
const deskScrollers = (wrapper: any) =>
	wrapper
		.findAll('*')
		.filter((node: any) => node.classes().includes('sm:overflow-y-auto'))

// Anchored to the strip itself rather than walked up from the <h1>: the
// heading now shares a row wrapper with the mobile Filters button.
const headerBlock = (wrapper: any) =>
	wrapper.get('[data-testid="page-header-block"]').element

describe('ListPage', () => {
	it('hands every row to the page card slot', async () => {
		mobile.value = false
		const wrapper = await mountListPage(
			{},
			{ card: '<article class="card">{{ params.row.title }}</article>' }
		)
		expect(wrapper.findAll('article.card')).toHaveLength(2)
	})

	it('shows the empty state instead of a grid when nothing matched', async () => {
		const wrapper = await mountListPage({ rows: [] }, { card: '<article />' })
		expect(wrapper.find('[data-testid="empty"]').exists()).toBe(true)
		expect(wrapper.findAll('article')).toHaveLength(0)
	})

	it('shows the skeleton only while a first page is still loading', async () => {
		const wrapper = await mountListPage({ rows: [], loading: true })
		expect(wrapper.find('[data-testid="skeleton"]').exists()).toBe(true)
		expect(wrapper.find('[data-testid="empty"]').exists()).toBe(false)
	})

	it('gives every page the same footer, and asks for the next page from it', async () => {
		const wrapper = await mountListPage({ hasNextPage: true })
		expect(wrapper.find('[data-testid="footer"]').exists()).toBe(true)
		await wrapper.find('[data-testid="footer"] button').trigger('click')
		expect(wrapper.emitted('loadMore')).toHaveLength(1)
	})

	it('says only the loaded count when the list has no total to compare against', async () => {
		const withTotal = await mountListPage({ totalCount: 40 })
		expect(withTotal.find('[data-testid="footer"]').text()).toContain('of')

		const withoutTotal = await mountListPage({})
		expect(withoutTotal.find('[data-testid="footer"]').text()).not.toContain(
			'of'
		)
	})
})

describe('PageBody', () => {
	// On a desk the header holds because it sits outside the box that scrolls
	// the rows. On a phone the page is the scroller and it travels with it, so
	// it must not try to pin itself there. PageHeader is already `sticky
	// top-0` in that scroller, so a second one lands underneath it, and the
	// offset that would clear it is the app header's own content height: the
	// measured offset that drifted and opened a band the last time.
	it.each([true, false])(
		'never pins the header block inside the page, at isMobile=%s',
		async (isMobile) => {
			mobile.value = isMobile
			const wrapper = await mountListPage({ title: 'All Courses' })

			// The page title's parent is the header block itself. Anchoring on the
			// rendered DOM rather than the component keeps this honest: it is the
			// element the browser lays out.
			const classes = headerBlock(wrapper).className.split(/\s+/)

			// It cannot be squeezed away by a long list, and it neither pins nor
			// scrolls on its own: the three ways the old strip went wrong.
			expect(classes).toContain('shrink-0')
			expect(classes).not.toContain('sticky')
			expect(
				classes.filter((name: string) => name.startsWith('overflow'))
			).toEqual([])
			expect(pinnedAboveRows(wrapper)).toHaveLength(0)
		}
	)

	// The counts and Load More are how you work a long list, so they hold the
	// bottom edge while the rows pass underneath. On a desk being the last child
	// of a bounded column does that; on a phone the page scrolls, so it takes
	// `sticky` and a background of its own.
	it('keeps the footer against the bottom edge while the rows scroll', async () => {
		mobile.value = true
		const wrapper = await mountListPage({ title: 'All Courses' })
		const footer = wrapper.get('[data-testid="footer"]').element.parentElement!
		const classes = footer.className.split(/\s+/)

		expect(classes).toContain('sticky')
		expect(classes).toContain('bottom-0')
		expect(classes).toContain('sm:static')
		expect(classes).toContain('bg-surface-elevation-1')
		expect(classes).toContain('shrink-0')
		expect(classes).toContain('mt-auto')
		expect(classes).toContain('sm:mt-0')
	})

	it.each([true, false])(
		'leaves the page itself the scroller on a phone, at isMobile=%s',
		async (isMobile) => {
			mobile.value = isMobile
			const wrapper = await mountListPage({ title: 'All Courses' })

			// Nothing inside the page may scroll below `sm`, or the page has no
			// scroll range and the URL bar never retracts.
			expect(mobileScrollers(wrapper)).toHaveLength(0)
			// Above it, exactly one box scrolls the rows.
			expect(deskScrollers(wrapper)).toHaveLength(1)
		}
	)

	// The skeleton is a separate branch from the rows, and it used to be the one
	// that forgot to bound itself, pushing the footer off the screen while a
	// page loaded.
	it('bounds the loading state the same way it bounds the rows', async () => {
		mobile.value = true
		const wrapper = await mountListPage({ rows: [], loading: true })

		expect(wrapper.find('[data-testid="skeleton"]').exists()).toBe(true)
		expect(mobileScrollers(wrapper)).toHaveLength(0)
		expect(deskScrollers(wrapper)).toHaveLength(1)
	})

	// On a phone the filters run the full width and the rows begin straight
	// under them, so without a rule the two blocks read as one. On a desk the
	// scroll box's own edge already separates them.
	it('rules the filters off from the rows only on a phone', async () => {
		mobile.value = true
		const wrapper = await mountListPage({ title: 'All Courses' })
		const classes = headerBlock(wrapper).className.split(/\s+/)

		expect(classes).toContain('border-b')
		expect(classes).toContain('sm:border-b-0')
	})
})

describe('ToggleFilter', () => {
	async function mountToggle(props: Record<string, unknown> = {}) {
		const { default: ToggleFilter } = await import(
			'@/components/Controls/ToggleFilter.vue'
		)
		const value = ref(false)
		const reloads = vi.fn()
		const wrapper = mount(
			defineComponent({
				setup: () => () =>
					h(ToggleFilter, {
						modelValue: value.value,
						label: 'Certification',
						mobileLabel: 'Certification available',
						tooltip: 'Only show courses that offer a certificate',
						...props,
						'onUpdate:modelValue': (next: boolean) => {
							value.value = next
							reloads()
						},
					}),
			})
		)
		return { wrapper, value, reloads }
	}

	it('is a checkbox at every width, from one declaration', async () => {
		mobile.value = false
		const desk = await mountToggle()
		expect(desk.wrapper.find('[data-testid="checkbox"]').exists()).toBe(true)

		// The chip is gone: filters live in a sheet now (PageBody), so the phone
		// has room for the desk idiom and gets the better hit area with it.
		mobile.value = true
		const phone = await mountToggle()
		expect(phone.wrapper.find('[data-testid="checkbox"]').exists()).toBe(true)
		expect(phone.wrapper.find('button[aria-pressed]').exists()).toBe(false)
	})

	// The label is part of the control's hit area, not decoration beside it —
	// frappe-ui renders <input> plus <label for>, and the stub mirrors that.
	it('toggles from a click on the label, not just the box', async () => {
		mobile.value = true
		const { wrapper, value, reloads } = await mountToggle()

		const input = wrapper.find('[data-testid="checkbox"]')
		const label = wrapper.find('[data-testid="checkbox-label"]')
		expect(label.attributes('for')).toBe(input.attributes('id'))

		await label.trigger('click')
		await nextTick()

		expect(value.value).toBe(true)
		expect(reloads).toHaveBeenCalledTimes(1)
	})

	// The desk label sits next to a tooltip carrying the rest of the meaning; a
	// phone has no hover, so the sheet's label has to say the whole thing.
	it('names the filter for a phone, and falls back to the desk label', async () => {
		mobile.value = true
		const named = await mountToggle()
		expect(named.wrapper.find('[data-testid="checkbox-label"]').text()).toBe(
			'Certification available'
		)

		const bare = await mountToggle({ mobileLabel: '' })
		expect(bare.wrapper.find('[data-testid="checkbox-label"]').text()).toBe(
			'Certification'
		)

		// The desk keeps the short noun; the long name is the phone's alone.
		mobile.value = false
		const desk = await mountToggle()
		expect(
			desk.wrapper.find('[data-testid="checkbox"]').attributes('aria-label')
		).toBe('Certification')
	})

	it('reloads the list once per click even though the checkbox reports twice', async () => {
		mobile.value = false
		const { wrapper, value, reloads } = await mountToggle()

		await wrapper.find('[data-testid="checkbox"]').trigger('change')
		await nextTick()

		expect(value.value).toBe(true)
		expect(reloads).toHaveBeenCalledTimes(1)
	})
})

describe('PageBody mobile filters', () => {
	// Past three or four filters the desk's strip is a wall above the content on
	// a phone. Below `sm` they collapse behind one button and open in a sheet.
	it('shows a Filters button instead of the strip on a phone', async () => {
		mobile.value = true
		const wrapper = await mountListPage({}, { filters: '<i class="f">F</i>' })

		expect(wrapper.find('[data-testid="mobile-filters-button"]').exists()).toBe(
			true
		)
	})

	it('leaves the desk showing its filter strip, with no button', async () => {
		mobile.value = false
		const wrapper = await mountListPage({}, { filters: '<i class="f">F</i>' })

		expect(wrapper.find('[data-testid="mobile-filters-button"]').exists()).toBe(
			false
		)
		expect(wrapper.find('.f').exists()).toBe(true)
	})

	// The slot is rendered in ONE place at a time. Two renders would mount two
	// copies of every control, both bound to the same page ref.
	it('renders each filter exactly once', async () => {
		mobile.value = true
		const wrapper = await mountListPage({}, { filters: '<i class="f">F</i>' })
		expect(wrapper.findAll('.f')).toHaveLength(0)

		await wrapper.find('[data-testid="mobile-filters-button"]').trigger('click')
		await nextTick()

		expect(wrapper.findAll('.f')).toHaveLength(1)
	})

	it('offers no Filters button when the page declares no filters', async () => {
		mobile.value = true
		const wrapper = await mountListPage({})

		expect(wrapper.find('[data-testid="mobile-filters-button"]').exists()).toBe(
			false
		)
	})
})

describe('ResponsiveListView', () => {
	async function mountList(cellSlot?: string) {
		const { default: ResponsiveListView } = await import(
			'@/components/ResponsiveListView.vue'
		)
		return mount(ResponsiveListView, {
			props: { columns: COLUMNS, rows: ROWS, rowKey: 'name' },
			slots: cellSlot ? { cell: cellSlot } : {},
			global: { stubs: { 'router-link': { template: '<a><slot /></a>' } } },
		})
	}

	it('is a frappe-ui list on a desk', async () => {
		mobile.value = false
		const wrapper = await mountList()
		expect(wrapper.find('[data-testid="listview"]').exists()).toBe(true)
		expect(wrapper.find('ul').exists()).toBe(false)
	})

	it('lets a desk column shrink so the list never scrolls sideways', async () => {
		mobile.value = false
		const wrapper = await mountList()
		// A bare `1fr` track refuses to go below its own label's width, which is
		// what pushes a six-column list off the side of a laptop screen.
		const columns = wrapper.findComponent({ name: 'ListView' }).props('columns')
		expect(columns.map((c: any) => c.width)).toEqual([
			'minmax(0, 2fr)',
			'minmax(0, 1fr)',
		])
	})

	it('stacks each row into a flat list row on a phone', async () => {
		mobile.value = true
		const wrapper = await mountList()

		const items = wrapper.findAll('li')
		expect(items).toHaveLength(2)
		// The first column is the row's title; the rest become one secondary
		// line of values. Column labels are not SHOWN per row — that is the
		// difference between a list and a stack of cards — but they are still
		// spoken, or the value is read with nothing to say what it is.
		expect(items[0].text()).toContain('Alpha')
		expect(items[0].text()).toContain('01 Jan 2026')

		expect(items[0].findAll('.sr-only').map((n) => n.text())).toContain(
			'Updated On:'
		)

		const visible = items[0].element.cloneNode(true) as HTMLElement
		visible.querySelectorAll('.sr-only').forEach((node) => node.remove())
		expect(visible.textContent).not.toContain('Updated On')
	})

	it('draws rows as a divided list, not as separate cards', async () => {
		mobile.value = true
		const wrapper = await mountList()

		const items = wrapper.findAll('li')
		expect(items[0].classes()).toContain('border-b')
		expect(items[0].classes()).toContain('last:border-b-0')
		// No card chrome: no rounding, no box.
		expect(items[0].classes()).not.toContain('rounded-lg')
		expect(items[0].classes()).not.toContain('border')
	})

	it('feeds the phone card from the same cell slot as the desk row', async () => {
		mobile.value = true
		const wrapper = await mountList(
			'<b class="cell">{{ params.column.key }}:{{ params.value }}</b>'
		)
		expect(wrapper.findAll('b.cell').length).toBe(ROWS.length * COLUMNS.length)
		expect(wrapper.text()).toContain('title:Alpha')
	})
})
