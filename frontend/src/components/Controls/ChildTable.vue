<template>
	<div>
		<div class="text-xs text-ink-gray-5 mb-2">
			{{ label }}
		</div>
		<div class="overflow-x-auto overflow-y-visible border rounded-md">
			<div
				class="grid items-center space-x-4 p-2 border-b"
				:style="{ gridTemplateColumns: getGridTemplateColumns() }"
			>
				<div
					v-for="(column, index) in columns"
					:key="index"
					class="text-sm text-ink-gray-5"
				>
					{{ column }}
				</div>
				<div></div>
			</div>
			<div
				v-for="(row, rowIndex) in rows"
				:key="rowIndex"
				class="grid items-center space-x-4 p-2"
				:style="{ gridTemplateColumns: getGridTemplateColumns() }"
			>
				<template v-for="key in Object.keys(row)" :key="key">
					<input
						v-if="showKey(key)"
						v-model="row[key]"
						class="py-1.5 px-2 border-none focus:ring-0 focus:border focus:border-gray-300 focus:bg-surface-gray-2 rounded-md text-sm focus:outline-none"
					/>
				</template>

				<div class="relative" ref="menuRef">
					<Button
						variant="ghost"
						@click="(event: MouseEvent) => toggleMenu(rowIndex, event)"
					>
						<template #icon>
							<Ellipsis
								class="size-4 text-ink-gray-7 stroke-1.5 cursor-pointer"
							/>
						</template>
					</Button>

					<Teleport to="body">
						<div
							v-if="menuOpenIndex === rowIndex"
							:style="{
								position: 'absolute',
								top: menuTopPosition,
								left: menuLeftPosition,
							}"
							class="top-5 mt-1 w-32 bg-surface-white border border-outline-gray-1 rounded-md shadow-sm"
						>
							<button
								@click="deleteRow(rowIndex)"
								class="flex items-center space-x-2 w-full text-left px-3 py-2 text-sm text-ink-red-3"
							>
								<Trash2 class="size-4 stroke-1.5" />
								<span>
									{{ __('Delete') }}
								</span>
							</button>
						</div>
					</Teleport>
				</div>
			</div>
		</div>

		<div class="mt-2">
			<Button @click="addRow">
				<template #prefix>
					<Plus class="size-4 text-ink-gray-7" />
				</template>
				{{ __('Add Row') }}
			</Button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { Button } from 'frappe-ui'
import { Ellipsis, Plus, Trash2 } from 'lucide-vue-next'
import { onClickOutside } from '@vueuse/core'

const rows = defineModel<Record<string, string>[]>()
const menuRef = ref(null)
const menuOpenIndex = ref<number | null>(null)
const menuTopPosition = ref<string>('')
const menuLeftPosition = ref('0px')

const emit = defineEmits<{
	(e: 'update:modelValue', value: Record<string, string>[]): void
}>()

type Cell = {
	value: string
	editable?: boolean
}

const props = withDefaults(
	defineProps<{
		modelValue?: Record<string, string>[]
		columns?: string[]
		label?: string
	}>(),
	{
		columns: () => [] as string[],
	}
)

const columns = ref(props.columns)

watch(rows, () => {
	if (rows.value && rows.value.length < 1) {
		addRow()
	}
})

const addRow = () => {
	if (!rows.value) {
		rows.value = []
	}
	let newRow: { [key: string]: string } = {}
	columns.value.forEach((column: any) => {
		newRow[column.toLowerCase().split(' ').join('_')] = ''
	})
	rows.value.push(newRow)
	focusNewRowInput()
	emit('update:modelValue', rows.value)
}

const focusNewRowInput = () => {
	nextTick(() => {
		const rowElements = document.querySelectorAll('.overflow-x-auto .grid')[
			rows.value!.length
		]
		const firstInput = rowElements.querySelector('input')
		if (firstInput) {
			;(firstInput as HTMLInputElement).focus()
		}
	})
}

const deleteRow = (index: number) => {
	rows.value?.splice(index, 1)
	emit('update:modelValue', rows.value ?? [])
}

const getGridTemplateColumns = () => {
	return [...Array(columns.value.length).fill('1fr'), '0.25fr'].join(' ')
}

const toggleMenu = (index: number, event: MouseEvent) => {
	const rect = (event.target as HTMLElement).getBoundingClientRect()
	menuOpenIndex.value = index
	menuTopPosition.value = rect.bottom + 'px'
	menuLeftPosition.value = rect.right + 'px'
}

onClickOutside(menuRef, () => {
	menuOpenIndex.value = null
})

const showKey = (key: string) => {
	let columnsLower = columns.value.map((col) =>
		col.toLowerCase().split(' ').join('_')
	)
	return columnsLower.includes(key)
}
</script>
