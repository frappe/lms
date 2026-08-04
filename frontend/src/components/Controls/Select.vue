<template>
	<Select
		class="w-full"
		v-bind="$attrs"
		:modelValue="modelValue"
		:options="options"
		:size="size"
		:variant="variant"
		:placeholder="placeholder"
		:disabled="disabled"
		:emptyText="emptyText"
		:required="required"
		:label="label ? __(label) : undefined"
		:description="description"
		:error="error"
		@update:modelValue="
			(val: SelectOptionValue | undefined) => emit('update:modelValue', val)
		"
	/>
</template>

<script setup lang="ts">
import { Select } from 'frappe-ui'
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
		error?: string
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
