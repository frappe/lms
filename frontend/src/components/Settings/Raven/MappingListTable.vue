<template>
	<List v-if="rows.length" :columns="tracks" class="list-row-px-3">
		<ListHeader class="sticky top-0 z-10 bg-surface-elevation-1">
			<ListHeaderCell v-for="column in list.columns" :key="column.key">
				{{ column.label }}
			</ListHeaderCell>
		</ListHeader>
		<ListRows :items="rows" row-key="key" v-slot="{ item: row }">
			<ListRow
				:class="row.key === selectedKey ? 'bg-surface-gray-2' : ''"
				@click="onRowClick(row)"
			>
				<ListCell class="gap-1" :class="isMuted(row) ? 'opacity-60' : ''">
					<span
						v-if="labelPrefix"
						class="pe-0.5 text-ink-gray-5"
						:class="labelClass"
					>
						{{ labelPrefix }}
					</span>
					<template v-if="isDulled(row)">
						<span
							class="truncate text-p-base text-ink-gray-6"
							:class="labelClass"
						>
							{{ row.label }}
						</span>
					</template>
					<template v-else-if="editingLabel === row.key">
						<TextInput
							class="w-full text-p-base"
							:class="labelClass"
							size="sm"
							variant="subtle"
							v-model="labelDraft"
							autofocus
							:aria-label="__('Label')"
							@click.stop
							@keydown.enter.stop.prevent="list.saveLabel(row)"
							@keydown.escape.stop.prevent="list.cancelEdit()"
						/>
						<Button
							variant="ghost"
							size="sm"
							:aria-label="__('Save label')"
							@click.stop="list.saveLabel(row)"
						>
							<template #icon>
								<span class="lucide-check size-4" />
							</template>
						</Button>
					</template>
					<template v-else>
						<span
							class="truncate text-p-base"
							:class="[
								labelClass,
								row.stale ? 'text-ink-gray-5' : 'text-ink-gray-8',
							]"
						>
							{{ row.label }}
						</span>
						<Tooltip v-if="row.stale" :text="staleHint">
							<Badge
								variant="subtle"
								theme="orange"
								size="sm"
								:label="__('Stale')"
							/>
						</Tooltip>
						<Button
							v-else
							variant="ghost"
							size="sm"
							:aria-label="__('Rename')"
							@click.stop="list.startEdit(row)"
						>
							<template #icon>
								<span class="lucide-pencil size-3.5 text-ink-gray-5" />
							</template>
						</Button>
					</template>
				</ListCell>

				<!-- Muted rows still show real values, just disabled: only Link (dulled) or
					 Recreate/Delete (stale) can change them. The actions cell never dims. -->
				<ListCell @click.stop :class="isMuted(row) ? 'opacity-60' : ''">
					<Dropdown :options="list.typeMenu(row)">
						<Button
							variant="ghost"
							size="sm"
							:disabled="row.stale || isDulled(row)"
						>
							<span class="text-p-base text-ink-gray-8">{{
								__(row.type)
							}}</span>
							<template #suffix>
								<span class="lucide-chevron-down size-4 text-ink-gray-5" />
							</template>
						</Button>
					</Dropdown>
				</ListCell>

				<ListCell @click.stop :class="isMuted(row) ? 'opacity-60' : ''">
					<Dropdown :options="list.combinatorMenu(row)">
						<Button
							variant="ghost"
							size="sm"
							:disabled="row.stale || isDulled(row)"
						>
							<span class="text-p-base text-ink-gray-8">
								{{ __(row.rule_combinator ?? 'Any (OR)') }}
							</span>
							<template #suffix>
								<span class="lucide-chevron-down size-4 text-ink-gray-5" />
							</template>
						</Button>
					</Dropdown>
				</ListCell>

				<ListCell @click.stop :class="isMuted(row) ? 'opacity-60' : ''">
					<Switch
						size="sm"
						:model-value="!row.paused"
						:disabled="row.stale || isDulled(row)"
						@update:model-value="
							(value: boolean) => list.toggleEnabled(row, value)
						"
					/>
				</ListCell>
				<!-- Stale rows' Recreate/Delete render here, not behind the label cell's old
					 "Take action" select — same place and treatment as every other action. -->
				<ListCell class="justify-end gap-1" @click.stop>
					<Tooltip v-if="isDulled(row)" :text="__('Link')">
						<Button
							variant="ghost"
							size="sm"
							:loading="list.linkingKey.value === row.key"
							:disabled="!!list.linkingKey.value"
							:aria-label="__('Link')"
							@click.stop="list.linkRow(row)"
						>
							<template #icon><span class="lucide-link size-3.5" /></template>
						</Button>
					</Tooltip>
					<template v-else-if="row.stale">
						<Tooltip
							v-for="option in list.takeActionMenu(row)"
							:key="option.label"
							:text="option.label"
						>
							<Button
								variant="ghost"
								size="sm"
								:theme="option.theme"
								:aria-label="option.label"
								@click.stop="option.onClick()"
							>
								<template #icon>
									<span :class="[option.icon, 'size-3.5']" />
								</template>
							</Button>
						</Tooltip>
						<Tooltip
							v-if="singleRowOption(row)"
							:text="singleRowOption(row)?.label"
						>
							<Button
								variant="ghost"
								size="sm"
								:aria-label="singleRowOption(row)?.label"
								@click.stop="singleRowOption(row)?.onClick()"
							>
								<template #icon>
									<span :class="[singleRowOption(row)?.icon, 'size-3.5']" />
								</template>
							</Button>
						</Tooltip>
					</template>
					<Tooltip
						v-else-if="singleRowOption(row)"
						:text="singleRowOption(row)?.label"
					>
						<Button
							variant="ghost"
							size="sm"
							:theme="singleRowOption(row)?.theme"
							:aria-label="singleRowOption(row)?.label"
							@click.stop="singleRowOption(row)?.onClick()"
						>
							<template #icon>
								<span :class="[singleRowOption(row)?.icon, 'size-3.5']" />
							</template>
						</Button>
					</Tooltip>
					<Dropdown
						v-else-if="rowOptions(row).length > 1"
						:options="rowOptions(row)"
						:button="{ icon: 'lucide-more-horizontal', variant: 'ghost' }"
						placement="right"
					/>
				</ListCell>
			</ListRow>
		</ListRows>
	</List>

	<EmptyStateLayout
		v-else-if="!loading"
		:name="emptyName"
		:icon="emptyIcon"
		:description="emptyDescription"
	/>
</template>

<script setup lang="ts">
// Workspace and channel tables are one list; only label decoration and the empty
// state differ. State and endpoints arrive as a `useMappingList()` instance.
import { Badge, Button, Dropdown, Switch, TextInput, Tooltip } from 'frappe-ui'
import {
	List,
	ListCell,
	ListHeader,
	ListHeaderCell,
	ListRow,
	ListRows,
} from 'frappe-ui/list'
import { computed } from 'vue'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import type {
	DropdownOption,
	MappingList,
	MappingRow,
} from '@/composables/raven/useMappingList'

const props = defineProps<{
	list: MappingList
	emptyName: string
	/** EmptyStateLayout icon CSS class, e.g. `lucide-hash`. */
	emptyIcon: string
	emptyDescription: string
	/** Rendered before the label, e.g. the channel "#" sigil. */
	labelPrefix?: string
	/** Extra classes for the label cell, e.g. `font-mono` for channels. */
	labelClass?: string
	/** Row-menu entries shown above Delete, e.g. the workspace "Channels" jump. */
	extraRowOptions?: (row: MappingRow) => DropdownOption[]
}>()

// The composable's refs arrive inside a prop object, so they are not unwrapped
// by the template — alias the ones the markup reads.
const rows = computed<MappingRow[]>(() => props.list.rows.value)
const loading = computed<boolean>(() => props.list.loading.value)
const selectedKey = computed<string | null>(() => props.list.selectedKey.value)
const editingLabel = computed<string | null>(
	() => props.list.editingLabel.value
)

// "Dulled" = no mapping doc (never mapped, or its mapping was deleted). Link-only:
// a half-editable row that silently adopts on any edit is the confusion to avoid.
function isDulled(row: MappingRow): boolean {
	return !row.mapped
}

// Muted = nothing editable yet (dulled) or until recovered (stale). The descriptive
// cells dim; the row's one live control (Link, or Recreate/Delete) never does.
function isMuted(row: MappingRow): boolean {
	return isDulled(row) || row.stale
}

// Dulled rows aren't selectable (nothing to show — they have no rules yet); the
// only action is Link. Everything else selects the row as before.
function onRowClick(row: MappingRow): void {
	if (isDulled(row)) return
	props.list.selectRow(row)
}
const labelDraft = computed<string>({
	get: () => props.list.labelDraft.value,
	set: (value) => (props.list.labelDraft.value = value),
})

// Flexible column is minmax(0, Nfr) so `truncate` works; the rest stay fixed rather
// than max-content, so control columns don't jump width between rows.
const tracks = computed<string[]>(() =>
	props.list.columns.map((column) =>
		typeof column.width === 'number'
			? `minmax(0, ${column.width}fr)`
			: column.width
	)
)

const staleHint = __(
	'The linked Raven record no longer exists, so this mapping has stopped syncing members.'
)

// Healthy mappings get no Delete: delete_* is a plain doc.delete() and Enabled
// already stops syncing. Stale rows keep it — Enabled is inert there.
function rowOptions(row: MappingRow): DropdownOption[] {
	// An unmapped row has no sub-page to jump to yet — it must be adopted (any
	// edit for a workspace) before it gains a "..." menu.
	if (!row.mapped) return []
	return props.extraRowOptions?.(row) ?? []
}

// A row with exactly one action renders it directly instead of behind a "..."
// Dropdown — one fewer click, and a narrower actions column.
function singleRowOption(row: MappingRow): DropdownOption | null {
	const options = rowOptions(row)
	return options.length === 1 ? options[0] : null
}
</script>
