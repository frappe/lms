<template>
	<section class="mt-5 space-y-3" data-testid="sql-tables">
		<h4 class="text-base-semibold text-ink-gray-9">{{ __('Database') }}</h4>

		<div
			v-if="loading"
			class="flex items-center gap-x-2 text-sm text-ink-gray-6"
		>
			<Spinner class="size-4 shrink-0" />
			{{ __('Loading tables…') }}
		</div>
		<p v-else-if="error" class="text-sm text-ink-red-5">{{ error }}</p>

		<div
			v-for="table in tables"
			:key="table.name"
			class="space-y-1.5"
			data-testid="sql-table"
		>
			<div class="flex items-baseline justify-between gap-x-2">
				<span class="font-mono text-sm-semibold text-ink-gray-9">
					{{ table.name }}
				</span>
				<span class="shrink-0 text-xs text-ink-gray-6">
					{{
						table.total > table.rows.length
							? __('Showing {0} of {1} rows').format(
									table.rows.length,
									table.total
								)
							: __('{0} rows').format(table.total)
					}}
				</span>
			</div>
			<ResultTable :columns="table.columns" :rows="table.rows" />
		</div>

		<details v-if="setup" class="text-sm text-ink-gray-7">
			<summary class="cursor-pointer select-none text-ink-gray-6">
				{{ __('Show the SQL that creates these tables') }}
			</summary>
			<pre
				class="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-surface-gray-2 p-2.5 font-mono text-xs text-ink-gray-8"
				>{{ setup }}</pre>
		</details>
	</section>
</template>

<script lang="ts">
export type SQLTable = {
	name: string
	columns: string[]
	rows: string[][]
	total: number
}
</script>

<script setup lang="ts">
import { Spinner } from 'frappe-ui'
import ResultTable from '@/components/ProgrammingExercises/ResultTable.vue'

withDefaults(
	defineProps<{
		tables: SQLTable[]
		loading?: boolean
		error?: string
		setup?: string
	}>(),
	{ loading: false, error: '', setup: '' }
)
</script>
