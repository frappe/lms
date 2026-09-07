<template>
	<PageHeader :breadcrumbs="breadcrumbs">
		<template #actions>
			<slot name="actions" />
		</template>
	</PageHeader>

	<PageBody :title="title" :selecting="selecting">
		<template v-if="$slots.name" #name><slot name="name" /></template>
		<template v-if="$slots.filters" #filters><slot name="filters" /></template>

		<span class="sr-only" role="status">{{ loadingAnnouncement }}</span>

		<SkeletonLoader
			v-if="loading && !rows.length"
			:variant="skeletonVariant"
			:count="8"
			class="px-5 pb-5"
		/>
		<div v-else-if="rows.length && layout === 'grid'" class="px-5 pb-5">
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
			ref="listView"
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

		<template #footer>
			<ListFooter
				v-model="pageLength"
				class="flex-wrap border-t px-5 py-2"
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
							<template v-if="totalCount !== null">
								<div>{{ __('of') }}</div>
								<div>{{ totalCount }}</div>
							</template>
						</div>
					</div>
				</template>
			</ListFooter>
		</template>
	</PageBody>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button, ListFooter } from 'frappe-ui'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import PageHeader from '@/components/Layouts/PageHeader.vue'
import PageBody from '@/components/Layouts/PageBody.vue'
import ResponsiveListView from '@/components/ResponsiveListView.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import { useLoadingAnnouncement } from '@/utils/a11y'
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

// On a phone the bulk-action banner docks against the same bottom edge the
// footer holds, and the banner is what the reader is working with, so the
// footer gives the edge up for as long as the selection lasts rather than
// being covered by it — the page size and Load More are still there, at the
// end of the rows, and come back the moment the selection is cleared.
const listView = ref<InstanceType<typeof ResponsiveListView> | null>(null)

const selecting = computed(() => Boolean(listView.value?.selections.size))

const pageLength = defineModel<number>('pageLength', { default: 24 })

const skeletonVariant = computed(() =>
	props.layout === 'grid' ? 'cards' : 'list'
)

// The skeleton above is `aria-hidden`, and on this page it IS the body, so
// without this a reader lands on a document with nothing in it and no sign that
// anything is on its way. The `role="status"` span is a sibling of the whole
// v-if chain rather than part of it, so it is mounted for the life of the page
// and every message lands in a region that was already there.
//
// It is the only thing here that speaks, so a load says one thing once:
// PageHeader's breadcrumbs and PageBody's h1 are plain content, `usePageMeta`
// writes document.title but no screen reader announces an SPA title change, and
// ResponsiveListView's own `role="status"` lives in the `rows.length` branch and
// holds nothing until a selection opens.
//
// It watches the whole flag rather than the skeleton's `loading && !rows.length`
// because a filter or a search keeps the old rows on screen while it refetches:
// no skeleton, but the list underneath is replaced, and "24 results loaded" is
// the canonical status message. The rows still being readable is exactly why
// that case gets no "Loading…" — an announcement with nothing on screen to
// pair it with is the opposite of the parity a status message is for.
const loadedMessage = () => {
	// Says the same thing as the empty state it stands beside, deliberately:
	// wording that diverged would read as a second, different event. Note that a
	// failed first fetch also lands here, since the resource leaves `rows` empty
	// and only records the failure on `error` — a signal this component is not
	// given.
	if (!props.rows.length) return __('No {0} Found').format(props.emptyName)
	// Counted rather than named. `emptyName` is a plural noun passed untranslated
	// ("Courses"), so a translated frame around it reads half-English, and there
	// is no singular of it to reach for when the count is one.
	if (props.rows.length === 1) return __('1 result loaded')
	return __('{0} results loaded').format(props.rows.length)
}

const loadingAnnouncement = useLoadingAnnouncement(
	() => props.loading,
	loadedMessage,
	() => (props.rows.length ? '' : __('Loading…'))
)

// createListResource starts out claiming a next page and only learns better
// once a response lands, so asking for page two mid-first-fetch appends onto
// data that does not exist yet and wedges the list on its skeleton.
const showLoadMore = computed(() => !props.loading && props.hasNextPage)
</script>
