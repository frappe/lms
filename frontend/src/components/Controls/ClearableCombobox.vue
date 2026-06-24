<template>
	<Combobox
		:modelValue="modelValue"
		:options="options"
		:placeholder="placeholder"
		@update:modelValue="(value) => emit('update:modelValue', value || null)"
	>
		<!-- Clearable variant (frappe-ui docs): an inline clear button via #suffix,
		falling back to the chevron when nothing is selected. -->
		<template #suffix="{ open, selectedOption, clearSelection }">
			<button
				v-if="selectedOption"
				type="button"
				:aria-label="__('Clear')"
				tabindex="-1"
				class="grid size-4 place-items-center rounded-sm text-ink-gray-5 hover:bg-surface-gray-3 hover:text-ink-gray-7"
				@click.stop="clearSelection()"
				@pointerdown.stop
			>
				<span class="lucide-x size-4" />
			</button>
			<span
				v-else
				:class="[
					'lucide-chevron-down size-4 text-ink-gray-5 transition-transform duration-200',
					open && 'rotate-180',
				]"
			/>
		</template>
	</Combobox>
</template>

<script setup lang="ts">
import { Combobox } from 'frappe-ui'

interface ComboboxOption {
	label: string
	value: string
}

defineProps<{
	modelValue: string | null
	options: ComboboxOption[]
	placeholder?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [string | null] }>()
</script>
