<template>
	<List
		:columns="tracks"
		class="-mx-3 list-row-px-3 flex min-h-0 flex-col [--list-row-height:3.5rem]"
	>
		<div
			role="presentation"
			class="min-h-0 flex-1 overflow-y-auto"
			:style="scrollerStyle"
		>
			<ListHeader class="sticky top-0 z-10 bg-surface-elevation-1">
				<ListHeaderCell
					v-for="column in columns"
					:key="column.key"
					class="text-p-sm"
				>
					{{ column.label }}
				</ListHeaderCell>
			</ListHeader>
			<div role="rowgroup">
				<ListRows :items="rows" :row-key="rowKey" v-slot="{ item: row }">
					<ListRow
						class="dark:sm:hover:bg-surface-gray-2 [outline-offset:-3px]"
						@click="emit('rowClick', row)"
					>
						<ListCell
							v-for="column in columns"
							:key="column.key"
							:class="
								column.type === 'text' ? 'text-p-base text-ink-gray-6' : ''
							"
							@click="stopWhenInteractive(column, $event)"
						>
							<slot name="cell" :column="column" :row="row">
								<template v-if="column.type === 'stacked'">
									<Avatar
										v-if="column.avatar"
										v-bind="column.avatar(row)"
										size="xl"
										class="me-3 shrink-0"
									/>
									<span v-else-if="column.leading" class="me-3 shrink-0">
										<slot name="leading" :column="column" :row="row" />
									</span>
									<div class="flex min-w-0 flex-col">
										<span class="truncate text-p-base text-ink-gray-8">
											{{ column.primary(row) }}
										</span>
										<span
											v-if="column.secondary"
											class="truncate text-p-sm text-ink-gray-5"
										>
											{{ column.secondary(row) }}
										</span>
									</div>
									<Badge
										v-if="rowStatus?.(row)"
										theme="orange"
										class="ms-2 shrink-0"
									>
										{{ rowStatus(row) }}
									</Badge>
								</template>

								<template v-else-if="column.type === 'text'">
									<Avatar
										v-if="column.avatar"
										v-bind="column.avatar(row)"
										size="lg"
										class="me-3 shrink-0"
									/>
									<span class="truncate">{{ column.value(row) }}</span>
								</template>

								<template v-else-if="column.type === 'badge'">
									<div class="flex min-w-0 items-center gap-2 overflow-hidden">
										<Badge
											v-for="badge in visibleBadges(column, row)"
											:key="badge.label"
											:theme="badge.theme || 'gray'"
											class="shrink-0"
										>
											{{ badge.label }}
										</Badge>
									</div>
									<template v-if="hiddenBadges(column, row).length">
										<span
											class="ms-2 inline-flex h-5 shrink-0 items-center rounded-full bg-surface-gray-3 px-1.5 text-xs-medium text-ink-gray-7"
											:title="hiddenBadgeSummary(column, row)"
											aria-hidden="true"
										>
											+{{ hiddenBadges(column, row).length }}
										</span>
										<span class="sr-only">
											{{ hiddenBadgeSummary(column, row) }}
										</span>
									</template>
								</template>

								<Switch
									v-else-if="column.type === 'switch'"
									size="sm"
									:model-value="column.checked(row)"
									:disabled="column.disabled ? column.disabled(row) : false"
									@update:model-value="(value: boolean) => column.onChange(row, value)"
								>
									<template #label>
										<span class="sr-only">{{ column.ariaLabel(row) }}</span>
									</template>
								</Switch>

								<Dropdown
									v-else-if="
										column.type === 'actions' && column.options(row).length
									"
									:options="column.options(row)"
									:button="{
										icon: 'lucide-more-horizontal',
										variant: 'ghost',
										label: column.ariaLabel
											? column.ariaLabel(row)
											: __('More options'),
									}"
									placement="right"
								/>
							</slot>
						</ListCell>
					</ListRow>
				</ListRows>
			</div>
		</div>
	</List>

	<div v-if="hasNextPage" class="mt-4 flex shrink-0 justify-center">
		<Button @click="emit('loadMore')">
			<template #prefix>
				<span class="lucide-refresh-cw size-3" />
			</template>
			{{ __('Load More') }}
		</Button>
	</div>
</template>

<script setup lang="ts">
// The rows of a settings list, without the page around them. Split out of
// SettingsList so a table inside a page (Raven workspace's Channels tab)
// shares the same header, grid and cells as one that's the whole page.
//
// Header and rows share one scroller: a scrollbar narrows the rows' content
// box ~15px versus a header outside it, offsetting every fixed column after.
// `-mx-3` cancels `list-row-px-3` so the first column aligns with the title.
//
// Load More stays OUTSIDE the List. `List` is a `role="table"`, which owns only
// rows and rowgroups, and a `role="presentation"` scroller does not launder a
// button placed inside it. With `visibleRows` capping the scroller it would also
// sit below the fold.
//
// Dark hover is re-toned because frappe-ui's `surface-gray-1` equals
// `surface-elevation-1`, the only surface here, so hovering did nothing.
// It wins on source order, not specificity; reordering variants undoes it.
//
// `outline-offset: -3px` draws the focus ring inside the row: the scroller's
// `overflow-y: auto` computes `overflow-x` to `auto` too, and a ring at the
// default offset loses its left/right strokes to the clip.
//
// An `actions` column renders its trigger only where the row has an action;
// a trigger opening an empty menu answers nothing.
import { computed } from 'vue'
import { Avatar, Badge, Button, Dropdown, Switch } from 'frappe-ui'
import {
	List,
	ListCell,
	ListHeader,
	ListHeaderCell,
	ListRow,
	ListRows,
} from 'frappe-ui/list'
import type {
	BadgeColumn,
	SettingsListBadge,
	SettingsListColumn,
	SettingsListRow,
} from '@/types'

const props = withDefaults(
	defineProps<{
		columns: SettingsListColumn[]
		rows: SettingsListRow[]
		rowKey?: string
		hasNextPage?: boolean
		/** A word for a row that is not syncing, badged beside its name. Null when it is. */
		rowStatus?: (row: SettingsListRow) => string | null
		/**
		 * Fixes the scrolling area to this many rows instead of filling the page.
		 * Opt-in: a panel that IS its page should use the height it has; only a
		 * table sharing a page with other things above it wants a fixed window.
		 */
		visibleRows?: number
	}>(),
	{
		rowKey: 'name',
		hasNextPage: false,
		rowStatus: undefined,
		visibleRows: undefined,
	}
)

// A ceiling, not a fixed height: a hard height clips on a short viewport.
// Inline style because the row height is a custom property, and a Tailwind
// class assembled from a prop is invisible to the JIT scan. `2rem` is the header.
const scrollerStyle = computed(() =>
	props.visibleRows
		? {
				maxHeight: `calc(var(--list-row-height) * ${props.visibleRows} + 2rem)`,
		  }
		: undefined
)

const emit = defineEmits<{
	rowClick: [row: SettingsListRow]
	loadMore: []
}>()

const tracks = computed(() =>
	props.columns.map((column) => {
		if (column.width) return column.width
		return column.type === 'actions' ? '2.25rem' : 'minmax(0, 1fr)'
	})
)

// Badges are bounded by counting, not clipping: flex items' automatic
// minimum size is their own label, so they refuse to shrink and paint out
// of the cell. Clipping would slice text; wrapping would vary row height.
const DEFAULT_MAX_BADGES = 3

const badgeLimit = (column: BadgeColumn): number =>
	column.maxBadges ?? DEFAULT_MAX_BADGES

const visibleBadges = (
	column: BadgeColumn,
	row: SettingsListRow
): SettingsListBadge[] => column.badges(row).slice(0, badgeLimit(column))

const hiddenBadges = (
	column: BadgeColumn,
	row: SettingsListRow
): SettingsListBadge[] => column.badges(row).slice(badgeLimit(column))

// What the `+N` stands for, as text: a bare number tells a screen reader
// nothing, `title` is not reachable from the keyboard, and the row is already a
// button, so a tooltip trigger inside it would nest one control in another.
const hiddenBadgeSummary = (
	column: BadgeColumn,
	row: SettingsListRow
): string => {
	const hidden = hiddenBadges(column, row)
	return __('and {0} more: {1}').format(
		String(hidden.length),
		hidden.map((badge) => badge.label).join(', ')
	)
}

// A cell the user operates is not also a cell that opens the row.
const stopWhenInteractive = (column: SettingsListColumn, event: Event) => {
	if (column.type === 'switch' || column.type === 'actions')
		event.stopPropagation()
}
</script>
