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
						v-for="row in rows"
						class="bg-surface-white border-b border-outline-gray-2 last:border-b-0"
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
								class="bg-surface-white w-full"
							/>
						</td>
						<td class="px-6 py-2">
							<Button
								variant="ghost"
								:aria-label="__('Remove row')"
								@click="removeRow(row)"
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
import type { ApplicableItem, Coupon, Coupons } from './types'
import { ref, watch } from 'vue'
import { Button, createListResource } from 'frappe-ui'
import Link from '@/components/Controls/Link.vue'
import Select from '@/components/Controls/Select.vue'

const rows = ref<
	{
		reference_doctype: string
		reference_name: string | null
		name: string | null
	}[]
>([])

const props = defineProps<{
	data: Coupon
	coupons: Coupons
}>()

const applicableItems = createListResource({
	doctype: 'LMS Coupon Item',
	fields: [
		'reference_doctype',
		'reference_name',
		'name',
		'parent',
		'parenttype',
		'parentfield',
	],
	parent: 'LMS Coupon',
	onSuccess(data: ApplicableItem[]) {
		rows.value = data
	},
})

const addRow = () => {
	rows.value.push({
		reference_doctype: 'LMS Course',
		reference_name: null,
		name: null,
	})
}

watch(
	() => props.data,
	() => {
		if (props.data?.name) {
			applicableItems.update({
				filters: {
					parent: props.data.name,
				},
			})
			applicableItems.reload()
		} else {
			addRow()
		}
	},
	{ immediate: true }
)

const saveItems = (parent = null) => {
	return rows.value
}

const removeRow = (rowToRemove: any) => {
	rows.value = rows.value.filter((row) => row !== rowToRemove)
	if (rowToRemove.name) {
		applicableItems.delete.submit(rowToRemove.name, {
			onSuccess() {
				props.coupons.reload()
				applicableItems.reload()
			},
		})
	}
}

defineExpose({
	saveItems,
})
</script>
