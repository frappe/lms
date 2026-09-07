<template>
	<div
		class="flex min-h-7 shrink-0 items-center justify-between gap-4"
		data-testid="members-heading-row"
	>
		<span class="text-lg-semibold text-ink-gray-8">{{ __('Members') }}</span>
		<div class="flex items-center gap-2">
			<Combobox
				v-if="members.length"
				:model-value="channel"
				:options="channelOptions"
				:aria-label="__('Filter by channel')"
				:placeholder="__('All channels')"
				size="sm"
				variant="subtle"
				class="w-44 shrink-0"
				@update:model-value="setChannel($event as string | null)"
			/>
			<Select
				v-if="members.length"
				v-model="addedByRule"
				:options="filterOptions"
				:aria-label="__('Filter by added by rules')"
				size="sm"
				variant="subtle"
				class="w-44 shrink-0"
			/>
		</div>
	</div>

	<div class="mt-5 flex min-h-0 flex-1 flex-col">
		<SettingsTable
			v-if="matching.length"
			:columns="columns"
			:visible-rows="9"
			:rows="paged.visible.value"
			:has-next-page="paged.hasNextPage.value"
			row-key="user"
			@load-more="paged.loadMore"
		/>

		<EmptyStateLayout
			v-else-if="members.length"
			:name="__('Members')"
			:title="__('No results')"
			icon="lucide-users"
			:description="emptyFilterHint"
		/>

		<EmptyStateLayout
			v-else-if="failed"
			:name="__('Members')"
			:title="__('Could not load the members')"
			icon="lucide-users"
			:description="__('The list did not come through. Try again in a moment.')"
		>
			<Button
				variant="solid"
				:loading="resource.loading"
				:label="__('Retry')"
				@click="load(workspace)"
			/>
		</EmptyStateLayout>

		<EmptyStateLayout
			v-else-if="!resource.loading"
			:name="__('Members')"
			icon="lucide-users"
			:description="__('Nobody is in a channel of this workspace yet.')"
		/>
	</div>
</template>

<script setup lang="ts">
// The workspace's derived membership, read-only, on the same SettingsTable the
// Channels tab uses, it drew its own `w-*/12` strip before, which did not line
// up with the "Members" heading above it or with its own cells.
//
// Whether a rule put someone here is the one thing about a member that is worth
// filtering on: it is the difference between a row this app will take back when
// the mapping goes and one it will never touch. So it is a column of its own
// rather than a badge tucked beside the name, and the filter reads off it.
//
// The channel a person came in through is the other: workspace membership is
// derived from it, so "who is in #announcements" is the question this list is
// assembled to answer and the one the table cannot be sorted into. It is a
// Combobox rather than a second Select because the option list is the
// workspace's channels, as many as the workspace has, and a list you may have
// to type into is what a combobox is for. Same control CRM's GroupBy picker uses
// (`apps/crm/frontend/src/components/GroupBy.vue`: frappe-ui `Combobox`, options
// in memory, sitting in a list's control bar); frappe-ui's `Autocomplete` is
// deprecated in favour of it.
//
// Filtering is client-side because the endpoint already returns the whole
// membership in one call, it has to, since the channel list per member is
// assembled from every channel row in the workspace.
//
// Both filters are pinned to one width rather than sized to their contents. A
// Select sizes its trigger to its widest option and a Combobox to its selection,
// so a long channel name, or a translation longer than the English, moved the
// pair and pushed the other control along the row. Fixed and `shrink-0`, the
// heading row stays put whatever is picked; frappe-ui truncates inside both
// triggers already, so an overlong name ellipses rather than overflowing.
import { Button, Combobox, Select, createResource, toast } from 'frappe-ui'
import { computed, ref, watch } from 'vue'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import SettingsTable from '@/components/Layouts/SettingsTable.vue'
import { usePagedRows } from '@/composables/usePagedRows'
import type {
	SettingsListColumn,
	SettingsListRow,
	WorkspaceMember,
} from '@/types'

const props = defineProps<{ workspace: string }>()

/** Which rows the filter is showing. `all` is every member. */
type AddedByRuleFilter = 'all' | 'yes' | 'no'

// The empty string stands for "every channel". A channel name is never empty,
// so it cannot collide with one, a word like `all` could, since the options are
// the workspace's own channel names. frappe-ui maps an empty option value to a
// synthetic internal one for the popover and hands it back as `''`.
const ALL_CHANNELS = ''

// A failed fetch settles with no data and nothing in flight, which is the shape
// of a workspace whose channels are genuinely empty, so without this the tab
// answered a fetch it never got with "nobody is in a channel of this workspace
// yet". Held as its own flag rather than read off the resource because it has to
// clear the moment another workspace is asked for.
const failed = ref(false)

const resource = createResource<WorkspaceMember[]>({
	url: 'raven_integration.api.list_workspace_members',
	onError(err: { messages?: string[] }) {
		failed.value = true
		toast.error(err?.messages?.[0] ?? __('Could not load the members'))
	},
})

function load(name: string): void {
	failed.value = false
	resource.submit({ name })
}

const addedByRule = ref<AddedByRuleFilter>('all')
const channel = ref<string>(ALL_CHANNELS)

// Declared after the two filters because the immediate run reads one of them.
watch(
	() => props.workspace,
	(name) => {
		// A channel belongs to the workspace that was on screen when it was picked,
		// so it does not survive the move to another one.
		channel.value = ALL_CHANNELS
		failed.value = false
		if (name) load(name)
	},
	{ immediate: true }
)

// Empty on a failed fetch, so the filters, the table and the two empty states all
// answer from what was actually loaded rather than from the last workspace's rows.
const members = computed<WorkspaceMember[]>(() =>
	failed.value ? [] : resource.data ?? []
)

const filterOptions = computed(() => [
	{ label: __('All members'), value: 'all' },
	{ label: __('Added by rules'), value: 'yes' },
	{ label: __('Not added by rules'), value: 'no' },
])

// Every channel anyone in the workspace belongs to. Taken from the rows rather
// than fetched, because a channel with nobody in it puts nobody in this list and
// would only ever filter it down to nothing.
const channelNames = computed<string[]>(() => {
	const names = new Set<string>()
	for (const member of members.value)
		for (const name of member.channels) names.add(name)
	return [...names].sort((a, b) => a.localeCompare(b))
})

// `#name` matches how the same channel is written in the row's badge, so the
// option and the cell it selects on read as the same thing.
const channelOptions = computed(() => [
	{ label: __('All channels'), value: ALL_CHANNELS },
	...channelNames.value.map((name) => ({ label: `# ${name}`, value: name })),
])

// The combobox clears to `null`, which is this filter's "every channel". Its
// payload is cast at the call site because frappe-ui types the event as
// `unknown`, the same way the condition row's type picker casts it.
const setChannel = (value: string | null) => {
	channel.value = value ?? ALL_CHANNELS
}

// The two filters are independent questions about the same row, a rule added
// them, and a channel put them here, so a row has to answer both.
const matching = computed<SettingsListRow[]>(() =>
	members.value.filter((member) => {
		const byRule =
			addedByRule.value === 'all' ||
			!!member.added_by_rule === (addedByRule.value === 'yes')
		const byChannel =
			channel.value === ALL_CHANNELS || member.channels.includes(channel.value)
		return byRule && byChannel
	})
)

const paged = usePagedRows(() => matching.value)

// A filter change is a different list, so it starts at the first page rather
// than keeping a count that belonged to the rows before it.
watch([addedByRule, channel], paged.reset)

// Says which filter emptied the table, so the reader knows the workspace is not
// the thing that is empty. The channel names the part of the workspace being
// spoken about, since the rule filter is the only one of the two that can empty
// the table on its own, every channel offered has someone in it.
const emptyFilterHint = computed<string>(() => {
	const where = `# ${channel.value}`
	if (addedByRule.value === 'yes')
		return channel.value === ALL_CHANNELS
			? __('No member of this workspace was added by a rule.')
			: __('No member of {0} was added by a rule.').format(where)
	if (addedByRule.value === 'no')
		return channel.value === ALL_CHANNELS
			? __('Every member of this workspace was added by a rule.')
			: __('Every member of {0} was added by a rule.').format(where)
	return __('Nobody is in {0} anymore.').format(where)
})

const columns: SettingsListColumn[] = [
	{
		key: 'member',
		label: __('Member'),
		type: 'stacked',
		width: 'minmax(0, 1.2fr)',
		primary: (row) => row.full_name,
		avatar: (row) => ({
			label: row.full_name,
			image: row.user_image ?? undefined,
		}),
	},
	{
		key: 'channels',
		label: __('Channels'),
		type: 'badge',
		// The channels are what put this person here, so they are the row's reason
		// for existing rather than a detail, they get the room.
		width: 'minmax(0, 2fr)',
		// Grey: a channel name is what this row is, not a status. A coloured badge
		// reads as a state worth noticing, and every row here would carry it.
		badges: (row) =>
			(row.channels as string[]).map((channel) => ({
				label: `# ${channel}`,
				theme: 'gray' as const,
			})),
	},
	{
		key: 'added_by_rule',
		label: __('Added by rules'),
		type: 'text',
		width: '9rem',
		value: (row) => (row.added_by_rule ? __('Yes') : __('No')),
	},
]
</script>
