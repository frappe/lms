<template>
	<div>
		<div
			class="relative overflow-x-auto border border-outline-gray-2 rounded-md"
		>
			<table class="w-full text-sm text-start text-ink-gray-5">
				<thead
					class="text-xs text-ink-gray-7 uppercase bg-surface-gray-2 border-b border-outline-gray-2"
				>
					<tr>
						<td scope="col" class="px-6 py-2">
							{{ __('Document Type') }}
						</td>
						<td scope="col" class="px-6 py-2">
							{{ __('Document Name') }}
						</td>
						<td scope="col" class="px-6 py-2 w-16"></td>
					</tr>
				</thead>
				<tbody>
					<tr
						v-for="(row, index) in items"
						:key="row.name ?? index"
						class="bg-surface-base border-b border-outline-gray-2 last:border-b-0"
					>
						<td class="px-6 py-2">
							<Select
								v-model="row.reference_doctype"
								:options="[
									{ label: 'Course', value: 'LMS Course' },
									{ label: 'Batch', value: 'LMS Batch' },
								]"
								class="w-full"
							/>
						</td>
						<td class="px-6 py-2">
							<Link
								:doctype="row.reference_doctype"
								v-model="row.reference_name"
								class="bg-surface-base w-full"
							/>
						</td>
						<td class="px-6 py-2">
							<Button
								variant="ghost"
								:aria-label="__('Remove row')"
								@click="removeRow(index)"
							>
								<template #icon>
									<span class="lucide-x size-4" />
								</template>
							</Button>
						</td>
					</tr>
				</tbody>
			</table>
		</div>

		<div class="mt-4">
			<Button @click="addRow()">
				<template #prefix>
					<span class="lucide-plus size-4" />
				</template>
				{{ __('Add Row') }}
			</Button>
		</div>
	</div>
</template>
<script setup lang="ts">
import type { ApplicableItem } from './types'
import { Button } from 'frappe-ui'
import Link from '@/components/Controls/Link.vue'
import Select from '@/components/Controls/Select.vue'

// Controlled child-table editor: we mutate the parent doc's `applicable_items`
// array in place. The parent persists the whole doc in a single save, so Frappe
// diffs the rows (insert/update/delete) server-side — no per-row API calls here.
const props = defineProps<{
	items: ApplicableItem[]
}>()

const addRow = () => {
	props.items.push({
		reference_doctype: 'LMS Course',
		reference_name: null,
	} as unknown as ApplicableItem)
}

const removeRow = (index: number) => {
	props.items.splice(index, 1)
}
</script>
