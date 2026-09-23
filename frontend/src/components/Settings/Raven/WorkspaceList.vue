<template>
	<SettingsList
		:title="__(label)"
		:description="__(description)"
		:columns="columns"
		:rows="paged.visible.value"
		:has-next-page="paged.hasNextPage.value"
		:loading="list.loading.value"
		v-model:search="search"
		searchable
		:search-label="__('Search workspaces')"
		:row-status="rowStatus"
		:filtered="state !== 'all'"
		row-key="key"
		:empty-name="__('Workspaces')"
		empty-icon="lucide-messages-square"
		@new="emit('new')"
		@row-click="onOpen"
		@load-more="paged.loadMore"
	>
		<template #header-bottom>
			<Select
				v-model="state"
				:options="stateOptions"
				:aria-label="__('Filter by state')"
				size="sm"
				variant="subtle"
				class="w-36 shrink-0"
			/>
		</template>
	</SettingsList>

	<DeleteConfirmDialog
		v-model:open="list.deleteOpen.value"
		entity="workspace"
		:name="list.toDelete.value?.label ?? ''"
		:loading="list.deleting.value"
		:message="
			__(
				'This deletes the workspace mapping and every channel mapping under it, with their conditions, and removes everyone those conditions added to its channels. Anyone added by hand in Raven stays. This action cannot be undone.'
			)
		"
		@confirm="list.confirmDelete"
	/>
</template>

<script setup lang="ts">
// The workspace list, on the same SettingsList every other settings panel uses.
// It listed through its own header strip and row component before, and the two
// were separate flex containers agreeing on `w-*/12` fractions by hand, so the
// column labels never quite sat over their cells, and the whole table was inset
// from the page title by its own padding. SettingsList puts the header and the
// rows in one grid at one inset, which is what lines them up here and with the
// panels either side of this one.
//
// Nothing in a row is editable. Visibility reads as text: it is the record's own
// setting, and the page a row opens is where a record is edited.
//
// Everything that happens *to* a mapping rather than inside it is in the row
// menu: adopting an unmanaged Raven workspace, recovering one whose Raven side
// was deleted, and deleting the mapping. Delete used to be a section at the
// bottom of a General tab, which put the page's most destructive action behind a
// tab you had to already be on to know it existed.
import { computed, ref, watch } from 'vue'
import { Select } from 'frappe-ui'
import SettingsList from '@/components/Layouts/SettingsList.vue'
import DeleteConfirmDialog from './DeleteConfirmDialog.vue'
import {
	useMappingList,
	type MappingRow,
} from '@/composables/raven/useMappingList'
import { usePagedRows } from '@/composables/usePagedRows'
import { openInRavenOptions } from '@/utils/raven/openInRaven'
import type { SettingsListColumn, SettingsListRow } from '@/types'

// Settings.vue hands every panel its label and description.
defineProps<{ label: string; description: string }>()

// Create opens a New Workspace page rather than POSTing create_workspace: it used
// to write immediately, so an accidental click left a live Raven workspace behind
// with an auto-generated name. The page it opens is owned by RavenSettings.
const emit = defineEmits<{ open: [row: MappingRow]; new: [] }>()

const list = useMappingList({ entity: 'workspace' })

// Searched and filtered here rather than by the server, for the same reason
// paging is: the endpoint takes no search argument, because it merges our
// mappings with the unmanaged Raven workspaces that have no row to filter on.
// The box and its no-results state are still SettingsList's, so the panel reads
// like the ones either side of it.
const search = ref('')

// The three states a row can be in, as the list itself distinguishes them. They
// are not a partition: a stale mapping can also be unadopted, and picking Stale
// should still find it, so each is asked as its own question rather than
// derived from one ordered classification.
//
// There is no Disabled here because a workspace mapping has no on/off any more:
// the channels under it carry that. `paused` still reaches the muting below,
// since a mapping switched off before the control was withdrawn genuinely is not
// syncing and the list should not draw it as though it were.
type State = 'all' | 'active' | 'stale' | 'unlinked'

const state = ref<State>('all')

const stateOptions: { label: string; value: State }[] = [
	{ label: __('All'), value: 'all' },
	{ label: __('Active'), value: 'active' },
	{ label: __('Stale'), value: 'stale' },
	{ label: __('Not linked'), value: 'unlinked' },
]

function matchesState(row: MappingRow): boolean {
	switch (state.value) {
		// Adopted, its Raven side alive, and syncing: the complement of the muting,
		// so the list agrees with itself about what "live" means.
		case 'active':
			return !rowStatus(row)
		case 'stale':
			return row.stale
		case 'unlinked':
			return !row.mapped
		default:
			return true
	}
}

const rows = computed<SettingsListRow[]>(() => {
	const term = search.value.trim().toLowerCase()
	return list.rows.value.filter(
		(row) =>
			matchesState(row) && (!term || row.label.toLowerCase().includes(term))
	)
})

const paged = usePagedRows(() => rows.value)

// A narrowed list is a different list, so it starts at page one, otherwise a
// term typed after Load More keeps showing 26 rows' worth of a shorter result.
watch([search, state], paged.reset)

const columns: SettingsListColumn[] = [
	{
		key: 'workspace',
		label: __('Workspace'),
		// `stacked`, not `text`: the row's name is the thing you came to read, and
		// stacked is what the other panels put a name in, it draws at ink-gray-8
		// against text's ink-gray-6, which is what makes Coupons' Code column read
		// as the row and its neighbours as detail.
		type: 'stacked',
		width: 'minmax(0, 1.5fr)',
		primary: (row) => row.label,
	},
	{
		key: 'channels',
		label: __('Channels'),
		type: 'text',
		width: '7rem',
		// Blank, not 0: an unadopted row manages no channels *here*, which is not
		// the same as a workspace that has none.
		value: (row) => (row.channelCount === null ? '' : String(row.channelCount)),
	},
	{
		key: 'visibility',
		label: __('Visibility'),
		type: 'text',
		width: '8rem',
		value: (row) => __(row.type),
	},
	{
		key: 'actions',
		type: 'actions',
		ariaLabel: (row) => __('Actions for {0}').format(row.label),
		options: (row) => {
			const mapping = row as MappingRow
			// Offered on any row whose Raven workspace is actually there, adopted or
			// not: an unmanaged workspace is one you may well want to go and look at.
			// Empty on a stale row, whose Raven side is gone, Recreate is the useful
			// action there, and the composable already supplies it.
			const open = openInRavenOptions({
				ravenWorkspace: mapping.ravenId,
				stale: mapping.stale,
			})
			// Nothing of ours to act on yet, adopting it is the only move.
			if (!mapping.mapped)
				return [
					...open,
					{
						label: __('Link'),
						icon: 'lucide-link',
						onClick: () => list.linkRow(mapping),
					},
				]
			// A stale row's two ways out, already worded by the composable, with
			// Delete as the second of them.
			if (mapping.stale) return [...open, ...list.takeActionMenu(mapping)]
			return [
				...open,
				{
					label: __('Delete mapping'),
					icon: 'lucide-trash-2',
					theme: 'red' as const,
					onClick: () => list.askDelete(mapping),
				},
			]
		},
	},
]

// Why this row is not syncing, or null when it is. A word rather than a grey
// step: muting alone left the state readable only by colour.
function rowStatus(row: SettingsListRow): string | null {
	const mapping = row as MappingRow
	if (!mapping.mapped) return __('Not linked')
	if (mapping.stale) return __('Stale')
	if (mapping.paused) return __('Disabled')
	return null
}

// A row that is not adopted yet has no page behind it, and a stale one's page
// still opens: its conditions are intact, only the syncing has stopped.
function onOpen(row: SettingsListRow): void {
	const mapping = row as MappingRow
	if (!mapping.mapped) return
	emit('open', mapping)
}
</script>
