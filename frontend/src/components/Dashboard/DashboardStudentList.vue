<template>
	<ChartCard
		data-slot="dashboard-students"
		class="flex flex-1 flex-col lg:min-h-0"
		role="region"
		:aria-label="__('Students')"
	>
		<div ref="toolbar" class="flex scroll-mt-4 items-center gap-2 pb-3">
			<TextInput
				v-model="search"
				type="text"
				:debounce="300"
				:placeholder="__('Search by name or email')"
				:aria-label="__('Search students')"
				class="min-w-0 flex-1 sm:max-w-xs"
			>
				<template #prefix>
					<span
						class="lucide-search size-4 text-ink-gray-5"
						aria-hidden="true"
					/>
				</template>
			</TextInput>
			<div
				v-if="filterChoices?.length"
				class="ms-auto flex min-w-0 items-center gap-1 overflow-x-auto"
			>
				<Dropdown :options="choiceOptions" align="end">
					<Button variant="subtle" icon-right="lucide-chevron-down">
						<span class="truncate">{{ filterLabel }}</span>
					</Button>
					<template #item-suffix="{ item }">
						<span
							class="size-4 text-ink-gray-7"
							:class="{ 'lucide-check': item.selected }"
							aria-hidden="true"
						/>
					</template>
				</Dropdown>
				<Button
					variant="ghost"
					icon="lucide-x"
					:aria-label="__('Clear filter')"
					@click="emit('clearFilter')"
				/>
			</div>
			<Button
				v-else-if="filterLabel"
				class="ms-auto max-w-[50%]"
				variant="subtle"
				@click="emit('clearFilter')"
			>
				<span class="sr-only">{{ __('Clear filter') }}</span>
				<span class="truncate">{{ filterLabel }}</span>
				<template #suffix>
					<span class="lucide-x size-4" aria-hidden="true" />
				</template>
			</Button>
		</div>
		<template v-if="showList">
			<ResponsiveListView
				v-if="isMobile"
				:key="listKey"
				:columns="columns"
				:rows="shownRows"
				:row-key="rowKey"
				:options="shownOptions"
				class="border-t border-outline-gray-1"
			>
				<template #cell="{ column, row }">
					<CellSkeleton
						v-if="skeleton"
						:first="column.key === columns[0]?.key"
						:blank="!column.label"
					/>
					<slot
						v-else
						name="cell"
						:column-key="column.key"
						:row="row"
						:compact="true"
					/>
				</template>
				<template #selection-actions="{ selections, unselectAll }">
					<slot
						name="selection-actions"
						:selections="selections"
						:unselect-all="unselectAll"
					/>
				</template>
			</ResponsiveListView>
			<ListView
				v-else
				:key="listKey"
				:class="['!w-full lg:h-full', selectedCount ? 'pb-16' : '']"
				:columns="columns"
				:rows="shownRows"
				:row-key="rowKey"
				:options="shownOptions"
				@update:selections="onSelections"
			>
				<ListHeader class="shrink-0">
					<ListHeaderItem
						v-for="column in columns"
						:key="column.key"
						:item="column"
					/>
				</ListHeader>
				<ListRows>
					<ListRow
						v-for="row in shownRows"
						:key="String(row[rowKey])"
						v-slot="{ column, item }"
						:row="row"
						:class="{ 'pointer-events-none [&_input]:invisible': skeleton }"
						:aria-hidden="skeleton || undefined"
					>
						<ListRowItem :column="column" :row="row" :item="item">
							<CellSkeleton
								v-if="skeleton"
								:first="column.key === columns[0]?.key"
								:blank="!column.label"
							/>
							<div v-else class="min-w-0 flex-1 truncate">
								<slot
									name="cell"
									:column-key="column.key"
									:row="row"
									:compact="false"
								/>
							</div>
						</ListRowItem>
					</ListRow>
				</ListRows>
				<Teleport defer :to="`#${bannerDockId}`">
					<ListSelectBanner>
						<template #actions="{ selections, unselectAll }">
							<slot
								name="selection-actions"
								:selections="selections"
								:unselect-all="unselectAll"
							/>
						</template>
					</ListSelectBanner>
				</Teleport>
			</ListView>
			<div v-if="!isMobile" :id="bannerDockId" class="sticky bottom-0 z-20" />
		</template>
		<div v-else-if="error" class="flex min-h-[200px] flex-1">
			<LoadError compact :error="error" @retry="emit('retry')" />
		</div>
		<div v-else class="min-h-[200px] flex-1">
			<EmptyStateLayout
				name="Students"
				icon="lucide-users"
				:title="emptyTitle"
				:description="emptyDescription"
			>
				<Button
					v-if="search.trim()"
					:label="__('Clear search')"
					@click="search = ''"
				/>
			</EmptyStateLayout>
		</div>
		<ListFooter
			v-if="total"
			v-model="pageLength"
			class="mt-auto flex-wrap items-center border-t border-outline-gray-1 pt-3"
			:options="{ pageLengthOptions: PAGE_LENGTH_OPTIONS }"
		>
			<template #right>
				<div class="flex items-center gap-3">
					<span class="text-sm tabular-nums text-ink-gray-6">
						{{ rangeText }}
					</span>
					<div class="flex gap-2">
						<Button
							:label="__('Previous')"
							:disabled="!hasPreviousPage"
							@click="emit('page', start - pageLength)"
						/>
						<Button
							:label="__('Next')"
							:disabled="!hasNextPage"
							@click="emit('page', start + pageLength)"
						/>
					</div>
				</div>
			</template>
		</ListFooter>
	</ChartCard>
</template>
<script setup lang="ts">
import { Button, Dropdown, TextInput } from 'frappe-ui'
import type { DropdownOption } from 'frappe-ui'
import { ChartCard } from 'frappe-ui/charts'
import {
	ListFooter,
	ListHeader,
	ListHeaderItem,
	ListRow,
	ListRowItem,
	ListRows,
	ListSelectBanner,
	ListView,
} from 'frappe-ui/experimental'
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
import CellSkeleton from '@/components/Dashboard/CellSkeleton.vue'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import LoadError from '@/components/LoadError.vue'
import ResponsiveListView from '@/components/ResponsiveListView.vue'
import { useScreenSize } from '@/utils/composables'
import type {
	ListColumn,
	ListRow as ListRowData,
	FilterChoice,
	ListViewOptions,
} from '@/types'

const PAGE_LENGTH_OPTIONS = [20, 50, 100]

const props = defineProps<{
	rows: ListRowData[]
	total: number
	loading: boolean
	// A first load that failed, shown in place of the empty state.
	error?: unknown
	columns: ListColumn[]
	rowKey: string
	// A new key is a new list, so a selection never carries rows that are no
	// longer on screen.
	listKey: string
	start: number
	listOptions: ListViewOptions
	emptyDescription: string
	// The filter applied from a card, the funnel or the attendance chart.
	filterLabel: string | null
	// Filters the applied one can be swapped for in place, and the applied one.
	filterChoices?: FilterChoice[]
	filterValue?: string | null
}>()

const emit = defineEmits<{
	page: [offset: number]
	clearFilter: []
	chooseFilter: [value: string]
	retry: []
}>()

defineSlots<{
	cell(props: {
		columnKey: string
		row: ListRowData
		compact: boolean
	}): unknown
	'selection-actions'(props: {
		selections: ReadonlySet<unknown>
		unselectAll: () => void
	}): unknown
}>()

const search = defineModel<string>('search', { required: true })
const pageLength = defineModel<number>('pageLength', { required: true })

const { isMobile } = useScreenSize()
// frappe-ui pins the banner to the bottom of the list, which on a long page is
// off screen. Teleported into a sticky dock it rides the bottom of the viewport.
const bannerDockId = `students-banner-${useId()}`
const selectedCount = ref<number>(0)

watch(
	() => props.listKey,
	() => (selectedCount.value = 0)
)

const emptyTitle = computed<string>(() =>
	search.value.trim()
		? __("No students match '{0}'").format(search.value.trim())
		: __('No students match these filters')
)

const showList = computed<boolean>(() => props.rows.length > 0 || props.loading)

// The first load has no rows yet: placeholder rows keep the table's shape.
const skeleton = computed<boolean>(() => props.loading && !props.rows.length)
const shownRows = computed<ListRowData[]>(() =>
	skeleton.value
		? Array.from({ length: 8 }, (_, index) => ({
				[props.rowKey]: `skeleton-${index}`,
		  }))
		: props.rows
)
const shownOptions = computed<ListViewOptions>(() =>
	skeleton.value
		? { ...props.listOptions, onRowClick: undefined }
		: props.listOptions
)
const hasPreviousPage = computed<boolean>(() => props.start > 0)
const hasNextPage = computed<boolean>(
	() => props.start + props.rows.length < props.total
)
const rangeText = computed<string>(() =>
	__('{0}–{1} of {2}').format(
		String(props.start + 1),
		String(props.start + props.rows.length),
		props.total.toLocaleString()
	)
)

// Below `lg` the table sits under the cards and charts, so a filter applied up
// there would change rows nobody can see: bring the table into view.
const toolbar = useTemplateRef<HTMLElement>('toolbar')
watch(
	() => props.filterLabel,
	async (label) => {
		if (!label || window.matchMedia?.('(min-width: 1024px)').matches !== false)
			return
		await nextTick()
		toolbar.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
	}
)

// The filters the applied one can be swapped for, the applied one checked.
const choiceOptions = computed<DropdownOption[]>(() =>
	(props.filterChoices ?? []).map((choice) => ({
		label: choice.label,
		selected: choice.value === props.filterValue,
		onClick: () => emit('chooseFilter', choice.value),
	}))
)

const onSelections = (selections: ReadonlySet<unknown>): void => {
	selectedCount.value = selections.size
}
</script>
