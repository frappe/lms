<template>
	<SettingsLayout
		:title="title"
		:description="description"
		:show-back="showBack"
		flush
		@back="emit('back')"
	>
		<template #header-actions>
			<slot name="header-actions" />
			<Button
				v-if="showNew && !isEmptyContentShown"
				variant="solid"
				:disabled="disabled"
				@click="emit('new')"
			>
				<template #prefix>
					<span class="lucide-plus size-4" />
				</template>
				{{ newLabel || __('New') }}
			</Button>
		</template>

		<template
			v-if="(searchable && !isEmptyContentShown) || $slots['header-bottom']"
			#header-bottom
		>
			<div class="flex items-center gap-2">
				<FormControl
					v-if="searchable && !isEmptyContentShown"
					v-model="search"
					type="text"
					class="w-1/3"
					:debounce="300"
					:aria-label="searchPlaceholder"
					:placeholder="searchPlaceholder"
				>
					<template #prefix>
						<span class="lucide-search size-4 text-ink-gray-5" />
					</template>
				</FormControl>
				<div class="ms-auto flex items-center gap-2">
					<slot name="header-bottom" />
				</div>
			</div>
		</template>

		<slot name="banner" />

		<div
			class="flex h-full min-h-0 flex-col"
			:class="{ 'pointer-events-none opacity-50': disabled }"
		>
			<div
				v-if="loading && !rows.length"
				class="flex flex-1 items-center justify-center py-20"
			>
				<LoadingIndicator class="size-5 text-ink-gray-5" />
			</div>

			<template v-else-if="rows.length">
				<SettingsTable
					:columns="columns"
					:rows="rows"
					:visible-rows="VISIBLE_ROWS"
					:row-key="rowKey"
					:row-status="rowStatus"
					:has-next-page="hasNextPage"
					@row-click="emit('rowClick', $event)"
					@load-more="emit('loadMore')"
				>
					<template v-if="$slots.cell" #cell="cellProps">
						<slot name="cell" v-bind="cellProps" />
					</template>
					<template v-if="$slots.leading" #leading="leadingProps">
						<slot name="leading" v-bind="leadingProps" />
					</template>
				</SettingsTable>
			</template>

			<EmptyStateLayout
				v-else-if="search || filtered"
				:name="emptyName"
				:title="__('No results')"
				:description="
					search
						? __('No {0} match {1}').format(emptyName.toLowerCase(), search)
						: __('No {0} match this filter').format(emptyName.toLowerCase())
				"
				:icon="emptyIcon"
			/>
			<component
				:is="emptyContent.component"
				v-else-if="emptyContent"
				@pick="onEmptyContentPick"
			/>
			<EmptyStateLayout
				v-else
				:name="emptyName"
				:description="__('Add one to get started')"
				:icon="emptyIcon"
			/>
		</div>
	</SettingsLayout>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import { Button, FormControl, LoadingIndicator } from 'frappe-ui'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import SettingsLayout from '@/components/Layouts/settings/desktop/SettingsLayout.vue'
import SettingsTable from '@/components/Layouts/settings/desktop/SettingsTable.vue'
import type { SettingsListColumn, SettingsListRow } from '@/types'

const props = withDefaults(
	defineProps<{
		title: string
		columns: SettingsListColumn[]
		rows: SettingsListRow[]
		description?: string
		rowKey?: string
		/** Passed to SettingsTable: rows to draw as not live. */
		rowStatus?: (row: SettingsListRow) => string | null
		loading?: boolean
		hasNextPage?: boolean
		searchable?: boolean
		/**
		 * A filter other than the search box is narrowing `rows`. Without it, a
		 * panel filtered to nothing falsely falls back to "Add one to get started".
		 */
		filtered?: boolean
		showNew?: boolean
		newLabel?: string
		showBack?: boolean
		emptyName?: string
		emptyIcon?: string
		/**
		 * Replaces the plain "Add one to get started" empty state with a page's
		 * own content, for one that has something better to offer a first-time
		 * visitor than a caption -- Email Accounts' provider picker is the only
		 * caller. Only draws in place of the true-empty state, never the
		 * search/filter "no results" one.
		 */
		emptyContent?: { component: Component }
		/** Greys out the rows and disables New, for the `#banner` slot to explain. */
		disabled?: boolean
	}>(),
	{
		description: '',
		rowKey: 'name',
		rowStatus: undefined,
		loading: false,
		hasNextPage: false,
		searchable: false,
		filtered: false,
		showNew: true,
		newLabel: '',
		showBack: false,
		emptyName: '',
		emptyIcon: 'lucide-graduation-cap',
		disabled: false,
	}
)

const emit = defineEmits<{
	/**
	 * A hint carries the value clicking a card in `emptyContent` should open
	 * the create form pre-selected on; the header's New button emits with none.
	 */
	new: [hint?: string]
	back: []
	loadMore: []
	rowClick: [row: SettingsListRow]
}>()

// `emptyContent`'s component is the one caller of `pick`; funnelling it into
// `new` reuses the exact channel the header's own New button already opens
// the create form through, rather than teaching this list a second one.
const onEmptyContentPick = (hint: string): void => emit('new', hint)

const search = defineModel<string>('search', { default: '' })

// Mirrors the template's own `v-else-if` chain: true exactly when the
// `emptyContent` branch is the one that will draw. Drives hiding New and the
// search box, so they can never disagree with what's on screen.
const isEmptyContentShown = computed(
	() =>
		!(props.loading && !props.rows.length) &&
		!props.rows.length &&
		!(search.value || props.filtered) &&
		Boolean(props.emptyContent)
)

/**
 * Twelve rows fit; row thirteen is reached by scrolling. A definite region
 * size keeps the header pinned and the panel from shifting on Load More.
 */
const VISIBLE_ROWS = 12

const searchPlaceholder = computed(() => __('Search'))
</script>
