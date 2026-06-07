<template>
	<div>
		<label v-if="label" class="block mb-1.5" :class="labelClasses">
			{{ label }}
			<span v-if="required" class="text-ink-red-3">*</span>
		</label>
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
import { Select } from 'frappe-ui'
import { computed } from 'vue'
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

const labelClasses = computed<string[]>(() => {
	const sizeMap: Record<string, string> = { sm: 'text-xs', md: 'text-base' }
	return [sizeMap[props.size || 'sm'], 'text-ink-gray-5']
})
</script>
