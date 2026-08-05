<template>
	<div class="w-full">
		<Combobox
			class="w-full"
			:modelValue="modelValue"
			:options="options"
			:placeholder="placeholder"
			:label="label"
			:description="description"
			:error="error"
			:required="required"
			@update:modelValue="
				(value) => emit('update:modelValue', value ? String(value) : null)
			"
		>
			<!-- Clearable variant (frappe-ui docs): an inline clear button via #suffix,
			falling back to the chevron when nothing is selected. -->
			<template #suffix="{ open, selectedOption, clear }">
				<button
					v-if="selectedOption"
					type="button"
					:aria-label="__('Clear')"
					tabindex="-1"
					class="grid size-4 place-items-center rounded-sm text-ink-gray-5 hover:bg-surface-gray-3 hover:text-ink-gray-7"
					@click.stop="clear()"
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
	</div>
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
	label?: string
	description?: string
	error?: string
	required?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [string | null] }>()
</script>
