<template>
	<div class="space-y-1.5">
		<FormLabel v-if="label" :label="label" :required="required" />
		<Select
			v-bind="$attrs"
			:modelValue="modelValue"
			:options="options"
			:size="size"
			:variant="variant"
			:placeholder="placeholder"
			:disabled="disabled"
			:emptyText="emptyText"
			:required="required"
			@update:modelValue="
				(val: SelectOptionValue | undefined) => emit('update:modelValue', val)
			"
		/>
		<p v-if="description" class="mt-1 text-xs text-ink-gray-5">
			{{ description }}
		</p>
	</div>
</template>

<script setup lang="ts">
import { FormLabel, Select } from 'frappe-ui'
import type { SelectOption, SelectOptionValue } from 'frappe-ui'

defineOptions({ inheritAttrs: false })

type SelectSize = 'sm' | 'md' | 'lg' | 'xl'
type SelectVariant = 'subtle' | 'outline' | 'ghost'

const props = withDefaults(
	defineProps<{
		modelValue?: SelectOptionValue
		options?: SelectOption[]
		label?: string
		description?: string
		placeholder?: string
		required?: boolean
		disabled?: boolean
		size?: SelectSize
		variant?: SelectVariant
		emptyText?: string
	}>(),
	{ size: 'sm' }
)

const emit = defineEmits<{
	(e: 'update:modelValue', value: SelectOptionValue | undefined): void
}>()
</script>
