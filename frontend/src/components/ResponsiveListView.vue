<template>
	<ListView
		ref="listView"
		v-bind="$attrs"
		:class="layoutClass"
		:columns="shrinkableColumns"
		:rows="rows"
		:row-key="rowKey"
		:options="listOptions"
	>
		<template #default>
			<template v-if="!isMobile">
				<ListHeader>
					<ListHeaderItem
						v-for="column in shrinkableColumns"
						:key="column.key"
						:item="column"
					>
						<template #prefix="{ item }">
							<span
								v-if="item.icon"
								:class="[item.icon, 'h-4 w-4']"
								aria-hidden="true"
							/>
						</template>
					</ListHeaderItem>
				</ListHeader>
				<ListRows />
			</template>

			<ul
				v-else
				ref="cardList"
				role="list"
				tabindex="-1"
				class="flex list-none flex-col"
			>
				<li
					v-for="row in rows"
					:key="String(row[rowKey])"
					class="border-b border-outline-gray-1 last:border-b-0"
					:class="isRowInteractive ? 'active:bg-surface-gray-2' : ''"
				>
					<div class="flex items-start gap-3">
						<div
							v-if="selectionEnabled"
							class="py-3"
							:data-list-select="String(row[rowKey])"
						>
							<Checkbox
								size="md"
								:model-value="isRowSelected(row)"
								:aria-label="selectionLabel(row)"
								@update:model-value="setRowSelected(row, $event)"
							/>
						</div>
						<component
							:is="cardTag"
							v-bind="cardBindings(row)"
							data-list-card
							class="block min-w-0 flex-1 py-3 text-start"
							@click="onCardClick(row)"
						>
							<div
								class="truncate text-p-base-medium text-ink-gray-9 [&>*]:truncate"
							>
								<slot
									name="cell"
									:column="titleColumn"
									:row="row"
									:value="row[titleColumn.key]"
								>
									{{ row[titleColumn.key] }}
								</slot>
							</div>
							<div
								v-if="detailColumns.length"
								class="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-p-sm text-ink-gray-6"
							>
								<template
									v-for="(column, index) in detailColumns"
									:key="column.key"
								>
									<span v-if="index" aria-hidden="true">·</span>
									<span class="min-w-0 truncate [&>*]:truncate">
										<span class="sr-only">{{ column.label }}: </span>
										<slot
											name="cell"
											:column="column"
											:row="row"
											:value="row[column.key]"
										>
											{{ row[column.key] }}
										</slot>
									</span>
								</template>
							</div>
						</component>
						<div
							v-if="actionColumns.length"
							class="flex shrink-0 items-center gap-2 py-3"
						>
							<template v-for="column in actionColumns" :key="column.key">
								<slot
									name="cell"
									:column="column"
									:row="row"
									:value="row[column.key]"
								/>
							</template>
						</div>
					</div>
				</li>
			</ul>

			<Teleport
				v-if="bannerRendered"
				:to="bannerTarget"
				:disabled="!bannerTarget"
			>
				<ListSelectBanner :class="bannerClass">
					<template #actions="bannerProps">
						<slot name="selection-actions" v-bind="bannerProps" />
					</template>
				</ListSelectBanner>
			</Teleport>
		</template>
		<template v-if="$slots.cell" #cell="{ column, row, item, align }">
			<ListRowItem :column="column" :row="row" :item="item" :align="align">
				<div class="min-w-0 truncate">
					<slot name="cell" :column="column" :row="row" :value="item" />
				</div>
			</ListRowItem>
		</template>
	</ListView>

	<div v-if="isMobile && selectionEnabled" :class="MOBILE_DOCK_CLASS">
		<span class="sr-only" role="status">{{ selectionAnnouncement }}</span>
		<div
			ref="bannerDock"
			:class="MOBILE_BANNER_FLOW_CLASS"
			:role="hasSelection ? 'region' : undefined"
			:aria-label="hasSelection ? __('Selected rows') : undefined"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useSlots, watch } from 'vue'
import {
	Checkbox,
	ListHeader,
	ListHeaderItem,
	ListRowItem,
	ListRows,
	ListSelectBanner,
	ListView,
} from 'frappe-ui'
import type { ListColumn, ListRow, ListViewOptions } from '@/types'
import { useScreenSize } from '@/utils/composables'

// The phone banner is a second root node, so nothing is left for Vue to inherit
// an attribute onto automatically; the list takes what a page passes, exactly
// as it did while it was the only root.
defineOptions({ inheritAttrs: false })

// The part of frappe-ui's ListView instance the cards drive.
interface ListViewSelection {
	selections: ReadonlySet<unknown>
	toggleRow: (rowKey: unknown) => void
}

const props = withDefaults(
	defineProps<{
		columns: ListColumn[]
		rows: ListRow[]
		rowKey: string
		options?: ListViewOptions
		/** Column shown as the card heading. Defaults to the first column. */
		titleKey?: string
		pageScroll?: boolean
	}>(),
	{ options: undefined, titleKey: undefined, pageScroll: false }
)

const slots = useSlots()
const { isMobile } = useScreenSize()

// `!w-full` beats frappe-ui's `w-max`, which would size the grid to its widest
// column and scroll the list sideways; the minmax tracks below narrow the
// columns instead. The list never scrolls on its own — the page's body owns the
// one scroll box, so the filters above these rows travel with them.
const PAGE_BODY_CLASS = '!w-full pb-5'

// frappe-ui sizes the selection banner for a desk (596px). The class lands on
// the banner's inner pill: ListSelectBanner sets `inheritAttrs: false` and
// binds `$attrs.class` there, never on the outer positioned box.
const MOBILE_BANNER_CLASS =
	'!min-w-0 max-w-[calc(100vw-2rem)] flex-wrap gap-y-2'

// The phone's banner is teleported out of the list because frappe-ui pins it
// `absolute … bottom-6` against ListView's root, which is as tall as every row
// there is — landing it hundreds of pixels below the screen. Outside that box
// the dock is `sticky bottom-0` against the page's own scroller. A Teleport
// moves the element, not the component, so the banner stays a child of ListView
// and injects the real list from it.
const MOBILE_DOCK_CLASS = 'sticky bottom-0 z-20'

// The banner still has to be told to sit in the dock's flow, or it hangs out of
// a zero-height box over the rows. Written from out here, on the child, because
// `$attrs.class` reaches only the pill. The spacing goes with it: left on the
// dock it would hold dead space open under every unselected list.
const MOBILE_BANNER_FLOW_CLASS = '[&>*]:!static [&>*]:pb-4 [&>*]:pt-2'

const layoutClass = computed(() =>
	props.pageScroll ? PAGE_BODY_CLASS : '!w-full'
)

/* frappe-ui writes its own default wording in English at the source, so the
   count is spelled out here and handed to ListView, which is where the banner
   reads it from at either width. `ListViewOptions` does not carry
   `selectionText` and no page sets one today, but this defers to a caller's
   rather than overwriting it: a page that starts naming its own selection is
   exactly the case the phone banner used to get wrong. */
const listOptions = computed(() => ({
	...props.options,
	selectionText: props.options?.selectionText ?? selectionText,
}))

/**
 * An `fr` track will not shrink below its own content, so one long column
 * label pushes the whole grid wider than the page. `minmax(0, …)` lets the
 * track shrink and hands the overflow to the cell's `truncate` instead.
 */
const shrinkableColumns = computed<ListColumn[]>(() =>
	props.columns.map((column) => ({
		...column,
		width:
			typeof column.width === 'number'
				? `minmax(0, ${column.width}fr)`
				: column.width,
	}))
)

const titleColumn = computed<ListColumn>(() => {
	const found = props.titleKey
		? props.columns.find((column) => column.key === props.titleKey)
		: null
	return found ?? props.columns[0] ?? { label: '', key: '' }
})

// `hideOnMobile` is honoured here and nowhere else; the desk row keeps every
// column.
const detailColumns = computed(() =>
	props.columns.filter(
		(column) =>
			column.key !== titleColumn.value.key &&
			column.kind !== 'actions' &&
			!column.hideOnMobile
	)
)

const actionColumns = computed(() =>
	props.columns.filter(
		(column) =>
			column.key !== titleColumn.value.key && column.kind === 'actions'
	)
)

const listView = ref<ListViewSelection | null>(null)
const cardList = ref<HTMLElement | null>(null)

const selectionEnabled = computed(
	() =>
		props.options?.selectable === true && Boolean(slots['selection-actions'])
)

const bannerRendered = computed(() =>
	isMobile.value ? selectionEnabled.value : Boolean(slots['selection-actions'])
)

const bannerDock = ref<HTMLElement | null>(null)
const mounted = ref(false)
onMounted(() => (mounted.value = true))

/**
 * Null until the dock is standing, which is one render after this banner's
 * first. Null disables the Teleport, so the banner draws in place for that
 * render — empty, since frappe-ui hides it while nothing is selected.
 */
const bannerTarget = computed(() =>
	isMobile.value && mounted.value ? bannerDock.value : null
)

// The banner is sized for a desk in frappe-ui; only the phone's copy is
// unpinned, so the class travels with the width rather than the element.
const bannerClass = computed(() =>
	isMobile.value ? MOBILE_BANNER_CLASS : undefined
)

// A row's own checkbox. The attribute is written on the box around it because
// frappe-ui's Checkbox inherits attributes onto its root as well as onto the
// input, and it is the input that takes focus.
const SELECT_BOX = '[data-list-select] input'

const NO_SELECTION: ReadonlySet<unknown> = new Set()

// ListView owns the selection. Reading it back off the instance rather than
// keeping a copy is what stops a card and the banner from ever disagreeing,
// and it is live: a copy would still hold the old value on the second of the
// two events one checkbox click sends.
const selections = computed<ReadonlySet<unknown>>(
	() => listView.value?.selections ?? NO_SELECTION
)

function isRowSelected(row: ListRow): boolean {
	return selections.value.has(row[props.rowKey])
}

// frappe-ui's own wording, translated. Read by the banner through the options
// handed to ListView, and by the announcement below.
function selectionText(count: number): string {
	return count === 1
		? __('1 row selected')
		: __('{0} rows selected').format(count)
}

// Mounted for as long as the list can be selected, rather than with the
// banner: a live region that arrives already holding its text is not reliably
// read out.
const selectionAnnouncement = computed(() =>
	selections.value.size ? selectionText(selections.value.size) : ''
)

const hasSelection = computed(() => selections.value.size > 0)

defineExpose({ selections })

const lastActedKey = ref<string | null>(null)

function toggleRowSelection(row: ListRow) {
	lastActedKey.value = String(row[props.rowKey])
	listView.value?.toggleRow(row[props.rowKey])
}

// frappe-ui's Checkbox reports the same value twice per click, so this sets the
// state that was asked for rather than flipping the current one.
function setRowSelected(row: ListRow, selected: unknown) {
	if (isRowSelected(row) === Boolean(selected)) return
	toggleRowSelection(row)
}

// The card has to change element mid-selection rather than only its ARIA:
// RouterLink renders an `<a>` and does not set `inheritAttrs: false`, so a
// `@click` bound from out here merges BEHIND its own handler, which has already
// read `defaultPrevented` as false and pushed the route by the time anything
// here could run.
const inSelectionMode = computed(
	() => selectionEnabled.value && selections.value.size > 0
)

const cardTag = computed(() => {
	if (inSelectionMode.value) return 'div'
	if (props.options?.getRowRoute) return 'router-link'
	return props.options?.onRowClick ? 'button' : 'div'
})

function cardBindings(row: ListRow): Record<string, unknown> {
	if (inSelectionMode.value) return {}
	if (props.options?.getRowRoute) return { to: props.options.getRowRoute(row) }
	return props.options?.onRowClick ? { type: 'button' } : {}
}

const isRowInteractive = computed(
	() =>
		inSelectionMode.value ||
		Boolean(props.options?.onRowClick) ||
		Boolean(props.options?.getRowRoute)
)

// A closing selection destroys whatever was focused: the banner's close button
// unmounts the banner it belongs to, and the card's element is swapped rather
// than patched, because Vue compares vnode types and `'div'` is not the
// RouterLink component. Focus would otherwise fall to `<body>`.
watch(inSelectionMode, () => {
	const focused = document.activeElement
	if (!(focused instanceof HTMLElement)) return
	const onCard = focused.matches('[data-list-card]')
	if (!onCard && !bannerDock.value?.contains(focused)) return
	const box = onCard
		? focused.closest('li')?.querySelector<HTMLElement>(SELECT_BOX)
		: selectBoxFor(lastActedKey.value)
	;(box ?? cardList.value)?.focus()
})

function selectBoxFor(rowKey: string | null): HTMLElement | null {
	const rows = Array.from(
		cardList.value?.querySelectorAll<HTMLElement>('[data-list-select]') ?? []
	)
	const row = rows.find((el) => el.dataset.listSelect === rowKey) ?? rows[0]
	return row?.querySelector<HTMLElement>('input') ?? null
}

function onCardClick(row: ListRow) {
	if (inSelectionMode.value) {
		toggleRowSelection(row)
		return
	}
	props.options?.onRowClick?.(row)
}

// A phone card has no column header to sit under, so the checkbox names its row.
function selectionLabel(row: ListRow): string {
	const title = row[titleColumn.value.key]
	const name =
		typeof title === 'string' || typeof title === 'number'
			? String(title)
			: String(row[props.rowKey])
	return __('Select {0}').format(name)
}
</script>
