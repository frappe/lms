/**
 * The list-page component family.
 *
 * Every list page in the app declares what it filters and what a row looks
 * like; ListPage / ListPageHeader / ToggleFilter / ResponsiveListView own how
 * that reads at each breakpoint. The invariants worth pinning down are the ones
 * a page can no longer see for itself: that the controls strip pins under the
 * app header on a phone and nowhere else, that one click on a boolean filter
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
		Checkbox: defineComponent({
			props: { modelValue: Boolean, label: String },
			emits: ['update:modelValue'],
			methods: {
				onChange() {
					this.$emit('update:modelValue', !this.modelValue)
					this.$emit('update:modelValue', !this.modelValue)
				},
			},
			template: `<input
				type="checkbox"
				data-testid="checkbox"
				:aria-label="label"
				@change="onChange"
			/>`,
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
			stubs: { 'router-link': { template: '<a><slot /></a>' } },
		},
	})
	await nextTick()
	return wrapper
}

// LayoutHeader's own `<header>` is legitimately `sticky top-0` and stays that
// way. What must never come back is a second pinned box inside the page body:
// that was a strip re-pinned at a measured offset, and any drift between the
// measurement and the header's real height showed as a band of content
// scrolling between the two.
const pinnedInsideBody = (wrapper: any) =>
	wrapper
		.findAll('*')
		.filter(
			(node: any) =>
				node.element.tagName !== 'HEADER' && node.classes().includes('sticky')
		)

const scrollers = (wrapper: any) =>
	wrapper
		.findAll('*')
		.filter((node: any) => node.classes().includes('overflow-y-auto'))

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

describe('ListPageHeader', () => {
	// The title and filters used to scroll away on a phone while a measured
	// sticky offset re-pinned the filters under the app header. Nothing scrolls
	// but the rows now, so there is no offset left to get wrong — these pin that
	// down by the two properties that make it true.
	it.each([true, false])(
		'keeps the header block out of the scroll, at isMobile=%s',
		async (isMobile) => {
			mobile.value = isMobile
			const wrapper = await mountListPage({ title: 'All Courses' })

			// The page title's parent is the header block itself. Anchoring on the
			// rendered DOM rather than the component keeps this honest: it is the
			// element the browser lays out that has to hold still.
			const block = wrapper.get('h1').element.parentElement
			const classes = block?.className.split(/\s+/) ?? []

			// It cannot be squeezed away by a long list, and it neither pins nor
			// scrolls on its own — the three ways the old strip went wrong.
			expect(classes).toContain('shrink-0')
			expect(classes).not.toContain('sticky')
			expect(classes.filter((name) => name.startsWith('overflow'))).toEqual([])
			expect(pinnedInsideBody(wrapper)).toHaveLength(0)
		}
	)

	it.each([true, false])(
		'leaves the rows the only thing that scrolls, at isMobile=%s',
		async (isMobile) => {
			mobile.value = isMobile
			const wrapper = await mountListPage({ title: 'All Courses' })

			expect(scrollers(wrapper)).toHaveLength(1)
		}
	)

	// The skeleton is a separate branch from the rows, and it used to be the one
	// that forgot to bound itself, pushing the footer off the screen while a
	// page loaded.
	it('bounds the loading state the same way it bounds the rows', async () => {
		mobile.value = true
		const wrapper = await mountListPage({ rows: [], loading: true })

		expect(wrapper.find('[data-testid="skeleton"]').exists()).toBe(true)
		expect(scrollers(wrapper)).toHaveLength(1)
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

	it('is a checkbox on a desk and a chip on a phone, from one declaration', async () => {
		mobile.value = false
		const desk = await mountToggle()
		expect(desk.wrapper.find('[data-testid="checkbox"]').exists()).toBe(true)
		expect(desk.wrapper.find('button[aria-pressed]').exists()).toBe(false)

		mobile.value = true
		const phone = await mountToggle()
		expect(phone.wrapper.find('button[aria-pressed]').exists()).toBe(true)
		expect(phone.wrapper.find('[data-testid="checkbox"]').exists()).toBe(false)
	})

	// The desk label sits next to a tooltip carrying the rest of the meaning; a
	// phone has no hover, so the chip has to say the whole thing in its name
	// rather than hide it behind a second control.
	it('names the chip for a phone, and falls back to the desk label', async () => {
		mobile.value = true
		const named = await mountToggle()
		expect(named.wrapper.find('button[aria-pressed]').text()).toBe(
			'Certification available'
		)

		const bare = await mountToggle({ mobileLabel: '' })
		expect(bare.wrapper.find('button[aria-pressed]').text()).toBe(
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

	it('reloads the list once per tap on the chip', async () => {
		mobile.value = true
		const { wrapper, value, reloads } = await mountToggle()

		await wrapper.find('button[aria-pressed]').trigger('click')
		await nextTick()

		expect(value.value).toBe(true)
		expect(reloads).toHaveBeenCalledTimes(1)
		expect(wrapper.find('button').attributes('aria-pressed')).toBe('true')
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

	it('stacks each row into a card built from the same columns on a phone', async () => {
		mobile.value = true
		const wrapper = await mountList()

		const cards = wrapper.findAll('li')
		expect(cards).toHaveLength(2)
		// The first column heads the card; the rest become labelled lines.
		expect(cards[0].text()).toContain('Alpha')
		expect(cards[0].text()).toContain('Updated On')
		expect(cards[0].text()).toContain('01 Jan 2026')
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
