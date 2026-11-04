<template>
	<SettingsLayout
		:title="title"
		:description="description"
		:show-back="showBack"
		@back="emit('back')"
	>
		<template #header-actions>
			<slot name="header-actions" />
			<Button v-if="showNew" variant="solid" @click="emit('new')">
				<template #prefix>
					<span class="lucide-plus size-4" />
				</template>
				{{ newLabel || __('New') }}
			</Button>
		</template>

		<template v-if="searchable || $slots['header-bottom']" #header-bottom>
			<div class="flex items-center justify-between gap-2">
				<FormControl
					v-if="searchable"
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
				<slot name="header-bottom" />
			</div>
		</template>

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
		<EmptyStateLayout
			v-else
			:name="emptyName"
			:description="__('Add one to get started')"
			:icon="emptyIcon"
		/>
	</SettingsLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button, FormControl, LoadingIndicator } from 'frappe-ui'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import SettingsLayout from '@/components/Layouts/SettingsLayout.vue'
import SettingsTable from '@/components/Layouts/SettingsTable.vue'
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
		searchLabel?: string
		/**
		 * A filter other than the search box is narrowing `rows`. Without it a panel
		 * filtered down to nothing falls back to "Add one to get started", which is
		 * false: there are rows, none of them match.
		 */
		filtered?: boolean
		showNew?: boolean
		newLabel?: string
		showBack?: boolean
		emptyName?: string
		emptyIcon?: string
	}>(),
	{
		description: '',
		rowKey: 'name',
		rowStatus: undefined,
		loading: false,
		hasNextPage: false,
		searchable: false,
		searchLabel: '',
		filtered: false,
		showNew: true,
		newLabel: '',
		showBack: false,
		emptyName: '',
		emptyIcon: 'lucide-graduation-cap',
	}
)

const emit = defineEmits<{
	new: []
	back: []
	loadMore: []
	rowClick: [row: SettingsListRow]
}>()

const search = defineModel<string>('search', { default: '' })

const searchPlaceholder = computed(() => props.searchLabel || __('Search'))
</script>
