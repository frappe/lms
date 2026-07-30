<template>
	<!-- A list page, declared. The page says what it filters and what a row
	     looks like; everything below owns how that reads at each breakpoint.
	     Shaped after helpdesk's ListViewBuilder.vue, which likewise takes the
	     columns, the row options and the footer counts as configuration. -->
	<LayoutHeader>
		<template #left-header>
			<Breadcrumbs :items="breadcrumbs" />
		</template>
		<template #right-header>
			<slot name="actions" />
		</template>
	</LayoutHeader>

	<ListPageBody>
		<ListPageHeader :title="title">
			<template v-if="$slots.title" #title><slot name="title" /></template>
			<template v-if="$slots.tabs" #tabs><slot name="tabs" /></template>
			<template v-if="$slots.filters" #filters
				><slot name="filters"
			/></template>
			<template v-if="$slots.toggles" #toggles
				><slot name="toggles"
			/></template>
		</ListPageHeader>

		<SkeletonLoader
			v-if="loading && !rows.length"
			:variant="skeletonVariant"
			:count="8"
			class="min-h-0 flex-1 overflow-y-auto px-5 pb-5"
		/>
		<!-- The cards own the scroll box at every width, which is what leaves the
		     header above and the footer below them both in place. -->
		<div
			v-else-if="rows.length && layout === 'grid'"
			class="min-h-0 flex-1 overflow-y-auto px-5 pb-5"
		>
			<div
				class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
			>
				<slot
					v-for="row in rows"
					:key="String(row[rowKey])"
					name="card"
					:row="row"
				/>
			</div>
		</div>
		<ResponsiveListView
			v-else-if="rows.length"
			:columns="columns"
			:rows="rows"
			:row-key="rowKey"
			:options="listOptions"
			page-scroll
			class="px-5"
		>
			<template v-if="$slots.cell" #cell="cellProps">
				<slot name="cell" v-bind="cellProps" />
			</template>
			<template
				v-if="$slots['selection-actions']"
				#selection-actions="bannerProps"
			>
				<slot name="selection-actions" v-bind="bannerProps" />
			</template>
		</ResponsiveListView>
		<div v-else class="flex-1">
			<EmptyStateLayout :name="emptyName" :icon="emptyIcon" />
		</div>

		<!-- Every list page ends the same way, so Load More lives down here with
		     the counts rather than as a lone button under the last row. -->
		<template #footer>
			<ListFooter
				v-model="pageLength"
				class="border-t px-3 py-2 sm:px-5"
				:options="{
					rowCount: rows.length,
					totalCount,
					pageLengthOptions,
				}"
			>
				<template #right>
					<div class="flex items-center">
						<Button
							v-if="showLoadMore"
							:label="__('Load More')"
							@click="emit('loadMore')"
						/>
						<div v-if="showLoadMore" class="mx-3 h-[80%] border-s" />
						<div class="flex items-center gap-1 text-base text-ink-gray-5">
							<div>{{ rows.length }}</div>
							<!-- Two of these lists are served by endpoints with no
							     count sibling, so the total is genuinely unknown
							     rather than zero. Say the loaded count only. -->
							<template v-if="totalCount !== null">
								<div>{{ __('of') }}</div>
								<div>{{ totalCount }}</div>
							</template>
						</div>
					</div>
				</template>
			</ListFooter>
		</template>
	</ListPageBody>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Breadcrumbs, Button, ListFooter } from 'frappe-ui'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import LayoutHeader from '@/components/Layouts/LayoutHeader.vue'
import ListPageBody from '@/components/Layouts/ListPageBody.vue'
import ListPageHeader from '@/components/Layouts/ListPageHeader.vue'
import ResponsiveListView from '@/components/ResponsiveListView.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import type {
	Breadcrumb,
	ListColumn,
	ListPageLayout,
	ListRow,
	ListViewOptions,
} from '@/types'

const props = withDefaults(
	defineProps<{
		breadcrumbs: Breadcrumb[]
		rows: ListRow[]
		title?: string
		/** How many rows exist behind the filters; null when no count exists. */
		totalCount?: number | null
		/** `grid` hands each row to the #card slot; `list` draws #columns. */
		layout?: ListPageLayout
		rowKey?: string
		columns?: ListColumn[]
		listOptions?: ListViewOptions
		loading?: boolean
		hasNextPage?: boolean
		pageLengthOptions?: number[]
		/** What the empty state calls these rows, e.g. "Courses". */
		emptyName?: string
		emptyIcon?: string
	}>(),
	{
		title: '',
		totalCount: null,
		layout: 'grid',
		rowKey: 'name',
		columns: () => [],
		listOptions: undefined,
		loading: false,
		hasNextPage: false,
		// 24 divides evenly by the 1-, 2-, 3- and 4-column grid, so the last row
		// of cards is never a stub. 60 and 120 keep that property.
		pageLengthOptions: () => [24, 60, 120],
		emptyName: '',
		emptyIcon: 'lucide-graduation-cap',
	}
)

const emit = defineEmits<{ loadMore: [] }>()

const pageLength = defineModel<number>('pageLength', { default: 24 })

const skeletonVariant = computed(() =>
	props.layout === 'grid' ? 'cards' : 'list'
)

// createListResource starts out claiming a next page and only learns better
// once a response lands, so asking for page two mid-first-fetch appends onto
// data that does not exist yet and wedges the list on its skeleton.
const showLoadMore = computed(() => !props.loading && props.hasNextPage)
</script>
