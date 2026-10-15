<template>
	<div
		class="max-w-full overflow-x-auto rounded border border-outline-gray-2"
		data-testid="result-table"
	>
		<table class="w-full border-collapse font-mono text-sm">
			<thead class="bg-surface-gray-2">
				<tr>
					<th
						v-for="(column, index) in table.columns"
						:key="index"
						scope="col"
						class="whitespace-nowrap border-b border-outline-gray-2 px-2.5 py-1.5 text-start font-semibold text-ink-gray-9"
					>
						{{ column }}
					</th>
				</tr>
			</thead>
			<tbody>
				<tr
					v-for="(row, rowIndex) in table.rows"
					:key="rowIndex"
					class="border-b border-outline-gray-1 last:border-b-0"
				>
					<td
						v-for="(cell, cellIndex) in row"
						:key="cellIndex"
						class="whitespace-nowrap px-2.5 py-1"
						:class="cell === 'NULL' ? 'italic text-ink-gray-5' : cellClass"
					>
						{{ cell }}
					</td>
				</tr>
				<tr v-if="!table.rows.length">
					<td
						:colspan="table.columns.length || 1"
						class="px-2.5 py-1.5 font-sans italic text-ink-gray-5"
					>
						{{ __('No rows') }}
					</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>

<script lang="ts">
export type TableData = { columns: string[]; rows: string[][] }

// A SQL result as the runner prints it: a header line of column names, then one
// tab-separated line per row.
export function parseResult(text: string): TableData {
	const [header = '', ...lines] = text.replace(/\r/g, '').split('\n')
	return {
		columns: header.split('\t'),
		rows: lines.map((line) => line.split('\t')),
	}
}
</script>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
	defineProps<{
		// Either the runner's text output, or columns and rows.
		text?: string
		columns?: string[]
		rows?: string[][]
		cellClass?: string
	}>(),
	{
		text: undefined,
		columns: undefined,
		rows: undefined,
		cellClass: 'text-ink-gray-8',
	}
)

const table = computed<TableData>(() =>
	props.text !== undefined
		? parseResult(props.text)
		: { columns: props.columns ?? [], rows: props.rows ?? [] }
)
</script>
