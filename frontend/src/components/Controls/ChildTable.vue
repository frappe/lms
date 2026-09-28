<template>
	<div class="space-y-1.5">
		<InputLabel
			v-if="label"
			:id="labelId"
			:label="label"
			:required="required"
		/>
		<div class="overflow-visible border border-outline-elevation-2 rounded-5">
			<div class="overflow-x-auto">
				<div
					class="grid items-center gap-x-4 p-2 border-b border-outline-elevation-2"
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
					class="grid items-center gap-x-4 p-2"
					:style="{ gridTemplateColumns: getGridTemplateColumns() }"
				>
					<template v-for="key in Object.keys(row)" :key="key">
						<Checkbox
							v-if="showKey(key) && (checkboxKeys ?? []).includes(key)"
							:model-value="!!row[key]"
							:aria-label="columnLabel(key)"
							@update:model-value="(checked) => (row[key] = !!checked)"
						/>
						<input
							v-else-if="showKey(key)"
							v-model="row[key]"
							:aria-label="columnLabel(key)"
							class="py-1.5 px-2 w-full rounded-5 border border-outline-gray-2 bg-surface-base text-sm text-ink-gray-8 placeholder-ink-gray-4 transition-colors hover:border-outline-gray-3 hover:shadow-sm focus:border-outline-gray-4 focus:shadow-sm focus:outline-none focus:ring-0"
						/>
					</template>

					<Button
						variant="ghost"
						:label="__('Delete row {0}').format(rowIndex + 1)"
						@click="deleteRow(rowIndex)"
					>
						<template #icon>
							<span class="lucide-x size-4 text-ink-gray-7" />
						</template>
					</Button>
				</div>
			</div>
		</div>

		<div class="mt-2">
			<Button @click="addRow">
				<template #prefix>
					<span class="lucide-plus size-4 text-ink-gray-7" />
				</template>
				{{ placeholder || __('Add Row') }}
			</Button>
		</div>
		<InputDescription
			v-if="showDescription"
			:id="descriptionId"
			:description="description"
		/>
		<InputError v-if="hasError" :id="errorMessageId" :lines="errorLines" />
	</div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { Button, Checkbox } from 'frappe-ui'
import {
	InputDescription,
	InputError,
	InputLabel,
	useInputLabeling,
} from 'frappe-ui/experimental'

const rows = defineModel<Record<string, string | boolean>[]>()

const emit = defineEmits<{
	(e: 'update:modelValue', value: Record<string, string | boolean>[]): void
}>()

const props = withDefaults(
	defineProps<{
		modelValue?: Record<string, string | boolean>[]
		columns?: string[]
		checkboxKeys?: string[]
		label?: string
		description?: string
		error?: string
		required?: boolean
		/** Add-row button text. Already translated by the caller. */
		placeholder?: string
	}>(),
	{
		columns: () => [] as string[],
	}
)

const columns = ref(props.columns)
const {
	labelId,
	descriptionId,
	errorMessageId,
	hasError,
	errorLines,
	showDescription,
} = useInputLabeling(props)

watch(rows, () => {
	if (rows.value && rows.value.length < 1) {
		addRow()
	}
})

const addRow = () => {
	if (!rows.value) {
		rows.value = []
	}
	let newRow: { [key: string]: string | boolean } = {}
	columns.value.forEach((column: any) => {
		const key = keyFor(column)
		newRow[key] = (props.checkboxKeys ?? []).includes(key) ? true : ''
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

// A fixed actions track: a fraction took ~120px for a 28px button, and each row
// computes its own grid, so a fixed width keeps the header aligned.
const ACTIONS_COLUMN_WIDTH = '2.25rem'

const getGridTemplateColumns = () => {
	return [
		...Array(columns.value.length).fill('minmax(0, 1fr)'),
		ACTIONS_COLUMN_WIDTH,
	].join(' ')
}

const keyFor = (column: string) => column.toLowerCase().split(' ').join('_')

const showKey = (key: string) => {
	return columns.value.some((col) => keyFor(col) === key)
}

const columnLabel = (key: string) => {
	return __(columns.value.find((col) => keyFor(col) === key) || key)
}
</script>
