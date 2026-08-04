<template>
	<div
		:class="
			rows.length
				? '[--list-row-height:3.5rem] max-h-[calc(2rem_+_8_*_var(--list-row-height))] shrink-0 overflow-y-auto'
				: 'flex min-h-0 flex-1 flex-col'
		"
	>
		<MappingListTable
			:list="list"
			:empty-name="__('Workspaces')"
			empty-icon="lucide-messages-square"
			:empty-description="__('Add one to get started')"
			:extra-row-options="workspaceRowOptions"
		/>
	</div>

	<div
		v-if="rows.length"
		class="mt-6 shrink-0 border-t border-outline-gray-1 pt-6"
	>
		<MappingRules
			v-if="selectedRow"
			entity="workspace"
			:row="selectedRow"
			:ensure-mapped="list.ensureMapped"
		/>
		<div v-else>
			<h3 class="text-p-lg-semibold text-ink-gray-8">
				{{ __('Workspace rules') }}
			</h3>
			<p class="mt-1 text-p-sm text-ink-gray-5">
				{{
					__(
						'Users who match these rules are kept in sync as members of this Raven workspace.'
					)
				}}
			</p>
			<p
				class="mt-3 rounded border border-dashed border-outline-gray-2 py-4 text-center text-p-sm text-ink-gray-5"
			>
				{{ __('Select a workspace to view its rules.') }}
			</p>
		</div>
	</div>

	<!-- Either direction rewrites the membership (All (AND) evicts, Any (OR)
		 admits), so any switch that moves someone is confirmed first. -->
	<MassRemovalConfirmDialog
		v-model:open="list.combinatorConfirmOpen.value"
		:removed-count="list.combinatorDiff.value?.removed ?? 0"
		:added-count="list.combinatorDiff.value?.added ?? 0"
		:target-label="list.pendingCombinatorLabel.value"
		@confirm="list.confirmCombinator"
		@cancel="list.cancelCombinator"
	/>

	<DeleteConfirmDialog
		v-model:open="deleteOpen"
		entity="workspace"
		:name="toDelete?.label ?? ''"
		:loading="deleting"
		:message="
			__(
				'This deletes the workspace mapping and its membership rules, and stops syncing members. This action cannot be undone.'
			)
		"
		@confirm="list.confirmDelete"
	/>
</template>

<script setup lang="ts">
import MappingListTable from './MappingListTable.vue'
import MappingRules from './MappingRules.vue'
import DeleteConfirmDialog from './DeleteConfirmDialog.vue'
import MassRemovalConfirmDialog from './MassRemovalConfirmDialog.vue'
import {
	useMappingList,
	type DropdownOption,
	type MappingRow,
} from '@/composables/raven/useMappingList'
import type { RavenWorkspace } from '@/types'

const emit = defineEmits<{ 'open-channels': [workspace: RavenWorkspace] }>()

const list = useMappingList({ entity: 'workspace' })
// Destructured so the template unwraps the refs.
const { rows, selectedRow, deleteOpen, toDelete, deleting } = list

function workspaceRowOptions(row: MappingRow): DropdownOption[] {
	return [
		{
			label: __('Channels'),
			icon: 'lucide-messages-square',
			onClick: () => openChannels(row),
		},
	]
}

function openChannels(row: MappingRow): void {
	if ('workspace_label' in row.record) emit('open-channels', row.record)
}

// Lets the parent (RavenSettings) trigger create from the panel heading.
defineExpose({
	openCreate: list.create,
})
</script>
