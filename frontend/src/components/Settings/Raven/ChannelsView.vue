<template>
	<SettingsLayout
		:title="workspace.workspace_label"
		:show-back="true"
		@back="emit('back')"
	>
		<template #title-badge>
			<Badge theme="gray" variant="subtle" :label="String(rows.length)" />
		</template>

		<template #header-actions>
			<Button variant="solid" @click="list.create">
				<template #prefix><span class="lucide-plus h-4 w-4" /></template>
				{{ __('Create channel') }}
			</Button>
		</template>
		<div
			:class="
				rows.length
					? '[--list-row-height:3.5rem] max-h-[calc(2rem_+_8_*_var(--list-row-height))] shrink-0 overflow-y-auto'
					: 'flex min-h-0 flex-1 flex-col'
			"
		>
			<MappingListTable
				:list="list"
				:empty-name="__('Channels')"
				empty-icon="lucide-hash"
				:empty-description="__('Add one to get started')"
				label-prefix="#"
				label-class="font-mono"
			/>
		</div>

		<div
			v-if="rows.length"
			class="mt-8 shrink-0 border-t border-outline-gray-1 pt-6"
		>
			<MappingRules
				v-if="selectedRow"
				entity="channel"
				:row="selectedRow"
				:ensure-mapped="list.ensureMapped"
			/>
			<div v-else>
				<h3 class="text-p-lg-semibold text-ink-gray-8">
					{{ __('Channel rules') }}
				</h3>
				<p class="mt-1 text-p-sm text-ink-gray-5">
					{{
						__(
							'Channel members are the workspace members who also match these rules.'
						)
					}}
				</p>
				<p
					class="mt-3 rounded border border-dashed border-outline-gray-2 py-4 text-center text-p-sm text-ink-gray-5"
				>
					{{ __('Select a channel to view its rules.') }}
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
			entity="channel"
			:name="toDelete?.label ?? ''"
			:loading="deleting"
			:message="
				__(
					'This deletes the channel mapping and its membership rules, and stops syncing members. This action cannot be undone.'
				)
			"
			@confirm="list.confirmDelete"
		/>
	</SettingsLayout>
</template>

<script setup lang="ts">
import { Badge, Button } from 'frappe-ui'
import SettingsLayout from '@/components/Layouts/SettingsLayout.vue'
import MappingListTable from './MappingListTable.vue'
import MappingRules from './MappingRules.vue'
import DeleteConfirmDialog from './DeleteConfirmDialog.vue'
import MassRemovalConfirmDialog from './MassRemovalConfirmDialog.vue'
import { useMappingList } from '@/composables/raven/useMappingList'
import type { RavenWorkspace } from '@/types'

const props = defineProps<{ workspace: RavenWorkspace }>()
const emit = defineEmits<{ back: [] }>()

const list = useMappingList({
	entity: 'channel',
	workspace: props.workspace.name ?? undefined,
})
// Destructured so the template unwraps the refs.
const { rows, selectedRow, deleteOpen, toDelete, deleting } = list
</script>
