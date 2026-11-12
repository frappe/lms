<template>
	<!-- Only the list scrolls: the header and the pager stay in view. -->
	<div class="flex min-h-0 flex-col rounded-6 border px-4 py-3">
		<div class="mb-3 flex flex-wrap items-center justify-between gap-3">
			<div class="flex items-center gap-2">
				<div class="text-lg-semibold text-ink-gray-9">
					{{ __('Students') }}
				</div>
				<!-- Set by a click on a stage of the progress funnel. -->
				<Button v-if="stage" size="sm" @click="emit('clear-stage')">
					{{ stage.stage }}
					<template #suffix><span class="lucide-x size-3.5" /></template>
				</Button>
			</div>
			<FormControl
				v-model="search"
				class="w-full sm:w-64"
				type="text"
				:placeholder="__('Search by name or email')"
				:aria-label="__('Search students')"
			>
				<template #prefix>
					<span class="lucide-search size-4 text-ink-gray-5" />
				</template>
			</FormControl>
		</div>

		<div class="min-h-0 flex-1 overflow-y-auto">
			<ResponsiveListView
				v-if="visible.length"
				:columns="columns"
				:rows="pageRows"
				row-key="name"
				:options="{
					selectable: false,
					showTooltip: false,
					onRowClick: (row: ListRow) => emit('open', row as Person),
				}"
			>
				<template #cell="{ column, row, value }">
					<span
						v-if="column.key === 'member_name'"
						class="flex items-center gap-2"
					>
						<Avatar :label="String(value)" size="sm" />
						<span class="min-w-0 truncate">{{ value }}</span>
					</span>
					<Badge v-else-if="column.key === 'status'" :theme="statusTheme(row)">
						{{ statusLabel(row) }}
					</Badge>
					<span v-else-if="column.key === 'progress'">
						{{ Number(value) || 0 }}%
					</span>
					<span v-else-if="column.key === 'score'">
						{{ value ? `${value}%` : __('Not yet') }}
					</span>
					<span v-else-if="column.key === 'last_active'">
						{{ value ? timeAgo(String(value)) : __('Not yet') }}
					</span>
					<span v-else-if="column.key === 'creation'">
						{{ dayjs(String(value)).format('DD MMM YYYY') }}
					</span>
					<span v-else>{{ value }}</span>
				</template>
			</ResponsiveListView>
			<p v-else class="py-6 text-center text-p-base text-ink-gray-6">
				{{
					search
						? __('No students match your search.')
						: __('No students here yet.')
				}}
			</p>
		</div>

		<div
			v-if="visible.length > pageSizes[0].value"
			class="mt-3 flex flex-wrap items-center justify-between gap-3"
		>
			<TabButtons v-model="pageSize" :options="pageSizes" />
			<div class="flex items-center gap-2 text-p-sm text-ink-gray-6">
				{{
					__('{0} to {1} of {2}').format(
						page * pageSize + 1,
						Math.min((page + 1) * pageSize, visible.length),
						visible.length
					)
				}}
				<Button :disabled="page === 0" @click="page--">
					{{ __('Previous') }}
				</Button>
				<Button
					:disabled="(page + 1) * pageSize >= visible.length"
					@click="page++"
				>
					{{ __('Next') }}
				</Button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { Avatar, Badge, Button, FormControl, TabButtons } from 'frappe-ui'
import type dayjsType from 'dayjs'
import ResponsiveListView from '@/components/ResponsiveListView.vue'
import { timeAgo } from '@/utils/format'
import type { ListRow } from '@/types'

export interface Person extends ListRow {
	name: string
	member: string
	member_name: string
	status: string
	overdue: boolean
	progress: number
	score: number
	creation: string
}

/** A stage of the progress funnel, as the server sends it. */
export interface Stage {
	key: 'assigned' | 'started' | 'completed' | 'passed'
	stage: string
	students: number
}

const props = defineProps<{
	people: Person[]
	lastActive: Record<string, string>
	stage: Stage | null
	/** Whether the skill has rules past completing, so passed differs from completed. */
	hasRules?: boolean
}>()
const emit = defineEmits<{ 'clear-stage': []; open: [person: Person] }>()
const dayjs = inject<typeof dayjsType>('$dayjs')!

// Kept in step with the funnel's own stages in skill_dashboard.py.
const REACHED: Record<Stage['key'], (person: Person) => boolean> = {
	assigned: () => true,
	started: (p) => p.status !== 'Assigned' || p.progress > 0,
	completed: (p) => p.status === 'Ready' || p.progress >= 100,
	passed: (p) => p.status === 'Ready',
}

const search = ref('')
const visible = computed(() => {
	const query = search.value.trim().toLowerCase()
	return props.people
		.filter((p) => !props.stage || REACHED[props.stage.key](p))
		.filter(
			(p) =>
				!query ||
				p.member_name?.toLowerCase().includes(query) ||
				p.member.toLowerCase().includes(query)
		)
		.map((p) => ({ ...p, last_active: props.lastActive[p.name] || null }))
})

const pageSizes = [
	{ label: '20', value: 20 },
	{ label: '50', value: 50 },
	{ label: '100', value: 100 },
]
const pageSize = ref(20)
const page = ref(0)
watch([search, () => props.stage, pageSize], () => (page.value = 0))
const pageRows = computed(() =>
	visible.value.slice(
		page.value * pageSize.value,
		(page.value + 1) * pageSize.value
	)
)

const columns = [
	{ label: __('Name'), key: 'member_name', width: '23%' },
	{ label: __('Status'), key: 'status', width: '14%' },
	{ label: __('Progress'), key: 'progress', width: '11%' },
	{ label: __('Score'), key: 'score', width: '11%' },
	{ label: __('Last active'), key: 'last_active', width: '16%' },
	{ label: __('Enrolled'), key: 'creation', hideOnMobile: true },
]

// Completed means every activity is done; passed adds the skill's rules. Without rules they
// are the same, so a ready person reads as completed.
const statusLabel = (row: ListRow) => {
	if (row.overdue) return __('Overdue')
	if (row.status === 'Ready')
		return props.hasRules ? __('Passed') : __('Completed')
	if (Number(row.progress) >= 100) return __('Completed')
	if (row.status === 'In Progress') return __('In progress')
	if (row.status === 'Assigned') return __('Not started')
	return __(String(row.status))
}
const statusTheme = (row: ListRow) =>
	row.overdue
		? 'red'
		: row.status === 'Ready'
		? 'green'
		: Number(row.progress) >= 100
		? 'blue'
		: row.status === 'In Progress'
		? 'amber'
		: 'gray'
</script>
