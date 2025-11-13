<template>
	<div>
		<div class="relative overflow-x-auto border rounded-md">
			<table class="w-full text-sm text-left text-ink-gray-5">
				<thead class="text-xs text-ink-gray-7 uppercase bg-surface-gray-2">
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
						class="bg-white dark:bg-gray-800 dark:border-gray-700 border-gray-200"
					>
						<td class="px-6 py-2">
							<FormControl
								type="select"
								v-model="row.reference_doctype"
								:options="[
									{ label: 'Course', value: 'LMS Course' },
									{ label: 'Batch', value: 'LMS Batch' },
								]"
							/>
						</td>
						<td class="px-6 py-2">
							<Link
								:doctype="row.reference_doctype"
								v-model="row.reference_name"
								class="bg-white"
							/>
						</td>
						<td class="px-6 py-2">
							<Button variant="ghost" @click="removeRow(row)">
								<template #icon>
									<X class="size-4 stroke-1.5" />
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
					<Plus class="size-4 stroke-1.5" />
				</template>
				{{ __('Add Row') }}
			</Button>
		</div>
	</div>
</template>
<script setup lang="ts">
import type { ApplicableItem, Coupon, Coupons } from './types'
import { ref, watch } from 'vue'
import { Button, createListResource, FormControl } from 'frappe-ui'
import { Plus, X } from 'lucide-vue-next'
import Link from '@/components/Controls/Link.vue'

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
