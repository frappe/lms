<template>
	<div class="flex shrink-0 items-center justify-between">
		<span class="text-lg-semibold text-ink-gray-8">{{ __('Channels') }}</span>
		<Button
			variant="subtle"
			icon-left="lucide-plus"
			:label="__('New')"
			:tooltip="unsaved ? unsavedHint : undefined"
			:aria-disabled="unsaved || undefined"
			:class="unsaved ? 'cursor-not-allowed opacity-50' : undefined"
			@click="requestNew"
		/>
	</div>

	<div class="mt-5 flex min-h-0 flex-1 flex-col">
		<SettingsTable
			v-if="rows.length"
			:columns="columns"
			:visible-rows="9"
			:rows="paged.visible.value"
			:has-next-page="paged.hasNextPage.value"
			:row-status="rowStatus"
			row-key="key"
			@row-click="open"
			@load-more="paged.loadMore"
		/>

		<EmptyStateLayout
			v-else-if="!list.loading.value"
			:name="__('Channels')"
			icon="lucide-hash"
			:description="__('Add one to give this workspace its first members.')"
		/>
	</div>

	<DeleteConfirmDialog
		v-model:open="list.deleteOpen.value"
		entity="channel"
		:name="list.toDelete.value?.label ?? ''"
		:loading="list.deleting.value"
		:message="
			__(
				'This deletes the channel mapping and its conditions, and removes everyone those conditions added to the channel. Anyone added by hand in Raven stays. This action cannot be undone.'
			)
		"
		@confirm="list.confirmDelete"
	/>
</template>

<script setup lang="ts">
// The workspace's Channels tab: the same table the workspace list is, on the
// same SettingsTable, so a channel row reads exactly like the workspace row that
// led here. It drew its own bordered card of flex rows before, which put a
// second table shape on a page that already had one.
//
// Nothing in a row is editable but Enabled. The channel's type used to be an
// inline Select here; it is the record's own setting and the page a row opens is
// where a record is edited. What is left in the menu is the two things that
// cannot be done from that page: adopting an unmanaged Raven channel, and
// recovering or discarding a mapping whose Raven channel is gone. A stale row
// has no page worth opening.
import { computed } from 'vue'
import { Button } from 'frappe-ui'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import SettingsTable from '@/components/Layouts/SettingsTable.vue'
import DeleteConfirmDialog from './DeleteConfirmDialog.vue'
import {
	useMappingList,
	type MappingRow,
} from '@/composables/raven/useMappingList'
import { usePagedRows } from '@/composables/usePagedRows'
import { openInRavenOptions } from '@/utils/raven/openInRaven'
import type { SettingsListColumn, SettingsListRow } from '@/types'

const props = defineProps<{
	workspace: string
	/** The Raven workspace id a channel's Raven URL nests under. Absent while the
	 *  parent mapping is unadopted, which is also when there is nothing to open. */
	ravenWorkspace?: string | null
	/** The workspace above this tab has never been saved, so there is no docname
	 *  to create a channel under. The tab still renders: it is the same page
	 *  either way, showing its ordinary empty state. */
	unsaved?: boolean
}>()
// Create opens a New Channel page rather than POSTing create_channel: it used to
// write immediately, so an accidental click left a live Raven channel behind.
// The page it opens is owned by RavenSettings, so the click travels up.
const emit = defineEmits<{ open: [row: MappingRow]; new: [] }>()

// `aria-disabled` rather than the native `disabled` attribute, on purpose: a
// disabled button is removed from the tab order and stops firing pointer and
// focus events, which would take the button out of the page for a keyboard user
// AND silence the tooltip that says why it cannot be used. Marked this way it
// stays focusable and is announced as unavailable, and reka's tooltip opens on
// focus, so the reason is reachable by keyboard, not only on hover. The click
// is refused in script instead of by the browser. Copy of CRM's
// Settings/Users.vue:121, which explains an unavailable action with a Tooltip
// around the button rather than a bare greyed-out control.
const unsavedHint = __('Save this workspace before adding channels to it.')

function requestNew(): void {
	if (props.unsaved) return
	emit('new')
}

const list = useMappingList({ entity: 'channel', workspace: props.workspace })

const rows = computed<SettingsListRow[]>(() => list.rows.value)

const paged = usePagedRows(() => rows.value)

const columns: SettingsListColumn[] = [
	{
		key: 'channel',
		label: __('Channel'),
		// `stacked` for the same reason the workspace list uses it: the first
		// column is the row's name, and a name reads at ink-gray-8 while the
		// detail beside it reads at ink-gray-6.
		type: 'stacked',
		width: 'minmax(0, 1.5fr)',
		// The hash marks it as a channel, spaced off the name so the name reads as
		// the name: Raven writes it closed up, this app does not. Whatever it is,
		// it has to match the page this row opens, the member badges and the
		// channel filter, which is why all four are changed together.
		primary: (row) => `# ${row.label}`,
	},
	{
		key: 'type',
		label: __('Type'),
		type: 'text',
		width: '8rem',
		value: (row) => __(row.type),
	},
	{
		key: 'enabled',
		label: __('Enabled'),
		type: 'switch',
		width: '6rem',
		// Only a row that actually syncs reads as on, and only such a row can be
		// written. Two rows fail that and used to read `!paused`, i.e. on:
		//
		// Unadopted: a raw Raven channel the list offers to adopt. `enabled: 1`
		// is what list_channels synthesises for it and it syncs nobody; most
		// visible right after Delete mapping, which leaves the channel behind as
		// exactly such a row. Flipping it would run through `ensureMapped` and
		// adopt the channel, and a channel is adopted through Link alone.
		//
		// Stale: adopted, but the Raven channel behind it is gone, which is the
		// same "has stopped syncing" state (see RavenChannel.stale) reached from
		// the other side. Writing it posts enabled against a mapping with no
		// target. Every other control on the row already knows this: `open()`
		// refuses, the row menu drops to recreate-or-delete, `rowStatus` badges it.
		// The switch was the last one still claiming the row was live.
		//
		// Both are disabled rather than hidden, so the column stays one column.
		checked: (row) => !!row.mapped && !row.stale && !row.paused,
		disabled: (row) => !row.mapped || !!row.stale,
		ariaLabel: (row) => __('Sync members of {0}').format(row.label),
		onChange: (row, value) => list.toggleEnabled(row as MappingRow, value),
	},
	{
		key: 'actions',
		type: 'actions',
		ariaLabel: (row) => __('Actions for {0}').format(row.label),
		options: (row) => {
			const mapping = row as MappingRow
			// Empty unless both Raven ids are in hand and the record is still there
			// a channel's Raven URL nests under its workspace's, so the parent has to
			// pass its own id down for this row to be able to address anything.
			const open = openInRavenOptions({
				ravenWorkspace: props.ravenWorkspace,
				ravenChannel: mapping.ravenId,
				stale: mapping.stale,
			})
			if (!mapping.mapped)
				return [
					...open,
					{
						label: __('Link'),
						icon: 'lucide-link',
						onClick: () => list.linkRow(mapping),
					},
				]
			if (mapping.stale) return [...open, ...list.takeActionMenu(mapping)]
			// Delete lives on the row, as it does in the workspace list. Before this
			// a live channel's mapping had no way out at all: the menu offered it
			// only once the row had gone stale.
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

// Same rule as the workspace list.
function rowStatus(row: SettingsListRow): string | null {
	const mapping = row as MappingRow
	if (!mapping.mapped) return __('Not linked')
	if (mapping.stale) return __('Stale')
	if (mapping.paused) return __('Disabled')
	return null
}

// An unadopted channel has no page behind it, and a stale one's page could only
// show settings that sync nothing, its two ways out are in the row menu.
function open(row: SettingsListRow): void {
	const mapping = row as MappingRow
	if (!mapping.mapped || mapping.stale) return
	emit('open', mapping)
}
</script>
