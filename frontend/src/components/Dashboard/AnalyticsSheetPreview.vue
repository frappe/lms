<template>
	<div class="w-max">
		<table
			class="table-fixed border-collapse bg-surface-base text-xs text-ink-gray-8"
		>
			<thead>
				<tr class="bg-surface-gray-2 text-ink-gray-6">
					<th scope="col" :class="[HEADING, 'w-9']">
						<span class="sr-only">{{ __('Row') }}</span>
					</th>
					<th
						v-for="letter in letters"
						:key="letter"
						scope="col"
						:class="[HEADING, 'w-32']"
					>
						{{ letter }}
					</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="(row, rowIndex) in sheet.rows" :key="rowIndex">
					<th
						scope="row"
						:class="[HEADING, 'bg-surface-gray-2 text-ink-gray-6']"
					>
						{{ rowIndex + 1 }}
					</th>
					<td
						v-for="cell in cells(row, rowIndex)"
						:key="cell.key"
						:colspan="cell.span"
						class="h-6 max-w-0 truncate border border-outline-gray-1 px-1.5"
						:class="{
							'font-semibold': rowIndex === 0,
							'text-end tabular-nums rtl:text-start':
								typeof cell.value === 'number',
						}"
						:title="String(cell.value ?? '')"
					>
						{{ cell.value }}
					</td>
				</tr>
			</tbody>
		</table>
		<p v-if="hiddenRows" class="mt-3 text-p-sm text-ink-gray-6">
			{{ __('And {0} more rows in the file.').format(String(hiddenRows)) }}
		</p>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AnalyticsPreviewSheet } from '@/types'

const props = defineProps<{
	sheet: AnalyticsPreviewSheet
	hiddenRows: number
}>()

const HEADING =
	'h-6 border border-outline-gray-1 px-1.5 text-center font-normal tabular-nums'

const letters = computed<string[]>(() =>
	Array.from({ length: props.sheet.columns }, (_, column) =>
		String.fromCharCode(65 + column)
	)
)

// Above the student table a row is shorter than the sheet. A spreadsheet lets
// text in its last cell run over the empty ones beside it; a number stays in its
// own, with the empty ones after it.
function cells(row: AnalyticsPreviewSheet['rows'][number], rowIndex: number) {
	const { columns, header_row } = props.sheet
	if (rowIndex >= header_row)
		return row.map((value, key) => ({ key, value, span: 1 }))
	const filled = row.map((value, key) => ({ key, value, span: 1 }))
	const last = filled[filled.length - 1]
	if (typeof last?.value === 'string') last.span = columns - last.key
	else
		filled.push({
			key: filled.length,
			value: '',
			span: columns - filled.length,
		})
	return filled
}
</script>
