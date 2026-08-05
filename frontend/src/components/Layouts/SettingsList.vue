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
			<List
				:columns="tracks"
				class="-mx-3 list-row-px-3 [--list-row-height:3.5rem]"
			>
				<ListHeader>
					<ListHeaderCell
						v-for="column in columns"
						:key="column.key"
						class="text-p-sm"
					>
						{{ column.label }}
					</ListHeaderCell>
				</ListHeader>
				<ListRows :items="rows" :row-key="rowKey" v-slot="{ item: row }">
					<ListRow @click="emit('rowClick', row)">
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
									<Badge
										v-for="badge in column.badges(row)"
										:key="badge.label"
										:theme="badge.theme || 'gray'"
										class="me-2 last:me-0"
									>
										{{ badge.label }}
									</Badge>
								</template>

								<Switch
									v-else-if="column.type === 'switch'"
									size="sm"
									:model-value="column.checked(row)"
									:aria-label="column.ariaLabel(row)"
									@update:model-value="
										(value: boolean) => column.onChange(row, value)
									"
								/>

								<Dropdown
									v-else-if="column.type === 'actions'"
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
			</List>

			<div v-if="hasNextPage" class="mt-4 flex justify-center">
				<Button @click="emit('loadMore')">
					<template #prefix>
						<span class="lucide-refresh-cw size-3" />
					</template>
					{{ __('Load More') }}
				</Button>
			</div>
		</template>

		<EmptyStateLayout
			v-else-if="search"
			:name="emptyName"
			:title="__('No results')"
			:description="
				__('No {0} match {1}').format(emptyName.toLowerCase(), search)
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
import {
	Avatar,
	Badge,
	Button,
	Dropdown,
	FormControl,
	LoadingIndicator,
	Switch,
} from 'frappe-ui'
import {
	List,
	ListCell,
	ListHeader,
	ListHeaderCell,
	ListRow,
	ListRows,
} from 'frappe-ui/list'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import SettingsLayout from '@/components/Layouts/SettingsLayout.vue'
import type { SettingsListColumn, SettingsListRow } from '@/types'

const props = withDefaults(
	defineProps<{
		title: string
		columns: SettingsListColumn[]
		rows: SettingsListRow[]
		description?: string
		rowKey?: string
		loading?: boolean
		hasNextPage?: boolean
		searchable?: boolean
		searchLabel?: string
		showNew?: boolean
		newLabel?: string
		showBack?: boolean
		emptyName?: string
		emptyIcon?: string
	}>(),
	{
		description: '',
		rowKey: 'name',
		loading: false,
		hasNextPage: false,
		searchable: false,
		searchLabel: '',
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

const tracks = computed(() =>
	props.columns.map((column) => {
		if (column.width) return column.width
		return column.type === 'actions' ? '2.25rem' : 'minmax(0, 1fr)'
	})
)

const stopWhenInteractive = (column: SettingsListColumn, event: Event) => {
	if (column.type === 'switch' || column.type === 'actions')
		event.stopPropagation()
}
</script>
