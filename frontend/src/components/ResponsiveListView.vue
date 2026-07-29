<template>
	<!-- One frappe-ui list at every width. The desk row and the phone card are
	     two shapes of the same list, so they are drawn inside the same ListView:
	     it owns the selection, which is what lets a phone select rows and reach
	     the page's #selection-actions banner exactly as a desk does. -->
	<ListView
		ref="listView"
		:class="layoutClass"
		:columns="shrinkableColumns"
		:rows="rows"
		:row-key="rowKey"
		:options="options"
	>
		<template #default>
			<!-- Wide: the ordinary header row and rows, identical on every list page
			     in this app, so they are written here once instead of per page. -->
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

			<!-- Narrow: one card per row, built from the same column metadata and fed
			     by the same #cell slot, so the two shapes cannot drift. A phone cannot
			     show a row of columns without either clipping them or making the page
			     scroll sideways, so the columns stack instead. -->
			<ul v-else class="flex list-none flex-col gap-2">
				<li
					v-for="row in rows"
					:key="String(row[rowKey])"
					class="flex items-start rounded-lg border border-outline-gray-1 bg-surface-base"
					:class="isRowInteractive ? 'hover:bg-surface-gray-1' : ''"
				>
					<!-- Outside the card element on purpose: the card may be a link or a
					     button, and a checkbox nested in either is not operable. -->
					<div v-if="selectionEnabled" class="p-3 pe-0">
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
						class="block min-w-0 flex-1 p-3 text-start"
						@click="onCardClick(row, $event)"
					>
						<div class="text-p-base-medium text-ink-gray-9">
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
							v-for="column in detailColumns"
							:key="column.key"
							class="mt-1 flex items-baseline gap-2 text-p-sm text-ink-gray-5"
						>
							<span class="shrink-0">{{ column.label }}</span>
							<span class="min-w-0 flex-1 text-ink-gray-7">
								<slot
									name="cell"
									:column="column"
									:row="row"
									:value="row[column.key]"
								>
									{{ row[column.key] }}
								</slot>
							</span>
						</div>
					</component>
				</li>
			</ul>

			<ListSelectBanner
				v-if="$slots['selection-actions']"
				:class="isMobile ? MOBILE_BANNER_CLASS : undefined"
			>
				<template #actions="bannerProps">
					<slot name="selection-actions" v-bind="bannerProps" />
				</template>
			</ListSelectBanner>
		</template>
		<!-- Only claimed when the page draws its own cells; left alone, frappe-ui
		     falls back to ListRowItem, which truncates and tooltips for free.
		     Claimed, the page's cell gets the same truncation, so a page never
		     has to remember it. -->
		<template v-if="$slots.cell" #cell="{ column, row, item, align }">
			<ListRowItem :column="column" :row="row" :item="item" :align="align">
				<div class="min-w-0 truncate">
					<slot name="cell" :column="column" :row="row" :value="item" />
				</div>
			</ListRowItem>
		</template>
	</ListView>
</template>

<script setup lang="ts">
import { computed, ref, useSlots } from 'vue'
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

/**
 * The part of frappe-ui's ListView instance the cards drive. It describes
 * frappe-ui rather than a list page, so it stays local to this component.
 */
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
		/**
		 * This list is the scrolling body of its page, so it owns the scroll
		 * box and the page's header and footer stay put around it.
		 */
		pageScroll?: boolean
	}>(),
	{ options: undefined, titleKey: undefined, pageScroll: false }
)

const slots = useSlots()
const { isMobile } = useScreenSize()

// `!w-full` beats frappe-ui's own `w-max` on this element. Left at max-content
// the grid sizes to its widest column and the list scrolls sideways on any
// screen narrower than the sum of its columns; a list page should narrow its
// columns instead, which is what the minmax tracks below make possible.
const SCROLLING_BODY_CLASS = 'min-h-0 flex-1 !w-full overflow-y-auto pb-5'

// frappe-ui sizes the selection banner for a desk (596px), which is wider than
// a phone; unpinning that lets it wrap inside the viewport instead.
const MOBILE_BANNER_CLASS =
	'!min-w-0 max-w-[calc(100vw-2rem)] flex-wrap gap-y-2'

const layoutClass = computed(() =>
	props.pageScroll ? SCROLLING_BODY_CLASS : '!w-full'
)

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

const isRowInteractive = computed(
	() =>
		Boolean(props.options?.onRowClick) || Boolean(props.options?.getRowRoute)
)

const cardTag = computed(() => {
	if (props.options?.getRowRoute) return 'router-link'
	return props.options?.onRowClick ? 'button' : 'div'
})

function cardBindings(row: ListRow): Record<string, unknown> {
	if (props.options?.getRowRoute) return { to: props.options.getRowRoute(row) }
	return props.options?.onRowClick ? { type: 'button' } : {}
}

const titleColumn = computed<ListColumn>(() => {
	const found = props.titleKey
		? props.columns.find((column) => column.key === props.titleKey)
		: null
	return found ?? props.columns[0] ?? { label: '', key: '' }
})

const detailColumns = computed(() =>
	props.columns.filter((column) => column.key !== titleColumn.value.key)
)

const listView = ref<ListViewSelection | null>(null)

/**
 * A card offers selection only where the page asked for it and gave the banner
 * something to hold: a checkbox that leads to no actions is a dead end. Which
 * slots a page fills is fixed at compile time, so this only has to re-read the
 * options.
 */
const selectionEnabled = computed(
	() =>
		props.options?.selectable === true && Boolean(slots['selection-actions'])
)

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

function toggleRowSelection(row: ListRow) {
	listView.value?.toggleRow(row[props.rowKey])
}

// frappe-ui's Checkbox reports the same value twice per click, so this sets the
// state that was asked for rather than flipping the current one.
function setRowSelected(row: ListRow, selected: unknown) {
	if (isRowSelected(row) === Boolean(selected)) return
	toggleRowSelection(row)
}

function onCardClick(row: ListRow, event: MouseEvent) {
	// Once a selection is open the card is a selection target, the way a phone
	// mail list behaves: navigating away mid-selection would drop it, and a
	// router-link would do exactly that if it were left to follow its route.
	if (selectionEnabled.value && selections.value.size) {
		event.preventDefault()
		toggleRowSelection(row)
		return
	}
	props.options?.onRowClick?.(row)
}

/**
 * A phone card has no column header to sit under, so the checkbox names the row
 * it selects.
 */
function selectionLabel(row: ListRow): string {
	const title = row[titleColumn.value.key]
	const name =
		typeof title === 'string' || typeof title === 'number'
			? String(title)
			: String(row[props.rowKey])
	return __('Select {0}').format(name)
}
</script>
