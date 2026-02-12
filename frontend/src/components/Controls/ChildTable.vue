<template>
	<div>
		<div class="text-xs text-ink-gray-5 mb-2">
			{{ label }}
		</div>
		<div class="overflow-visible border border-outline-gray-modals rounded-md">
			<div class="overflow-x-auto">
				<div
					class="grid items-center space-x-4 p-2 border-b border-outline-gray-modals"
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
							class="py-1.5 px-2 w-full border-none bg-transparent text-ink-gray-8 focus:ring-0 focus:border focus:border-outline-gray-3 focus:bg-surface-gray-2 rounded-md text-sm focus:outline-none"
						/>
					</template>

					<div class="relative">
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

						<div
							v-if="menuOpenIndex === rowIndex"
							ref="menuRef"
							class="absolute right-0 w-32 z-50 bg-surface-modal border border-outline-gray-modals rounded-md shadow-sm"
							:class="
								rowIndex == (rows?.length ?? 0) - 1
									? 'bottom-full mb-1'
									: 'top-full mt-1'
							"
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
					</div>
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
	menuOpenIndex.value = menuOpenIndex.value === index ? null : index
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
